import { createClient } from '@supabase/supabase-js';

// Proxy Serverless para acessar o Supabase com Service Role Key
// Isso protege a Service Role Key no backend Vercel.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Verifica token enviado pelo AdminProxyQueryBuilder do frontend
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== 'Bearer huvi-superadmin-token-v1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Contrato de campos alinhado com AdminProxyQueryBuilder (admin-client.js)
  const { operation, table, payload, filters, orderCol, orderAsc, isSingle } = req.body;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Aplica filtros (eq, neq, in) a uma query Supabase
  function applyFilters(query, filters) {
    if (!Array.isArray(filters)) return query;
    for (const f of filters) {
      if (f.op === 'eq')  query = query.eq(f.col, f.val);
      if (f.op === 'neq') query = query.neq(f.col, f.val);
      if (f.op === 'in')  query = query.in(f.col, f.val);
    }
    return query;
  }

  try {
    let result;

    if (operation === 'select') {
      let query = supabase.from(table).select('*');
      query = applyFilters(query, filters);
      if (orderCol) query = query.order(orderCol, { ascending: orderAsc !== false });
      if (isSingle) query = query.maybeSingle();
      result = await query;

    } else if (operation === 'insert') {
      result = await supabase.from(table).insert(payload).select();
      // Se isSingle, retorna o primeiro item (compatível com .single() do cliente)
      if (isSingle && result.data && Array.isArray(result.data)) {
        result = { ...result, data: result.data[0] || null };
      }

    } else if (operation === 'update') {
      let query = supabase.from(table).update(payload);
      query = applyFilters(query, filters);
      result = await query.select();

    } else if (operation === 'delete') {
      let query = supabase.from(table).delete();
      query = applyFilters(query, filters);
      result = await query;

    } else {
      return res.status(400).json({ error: `Invalid operation: "${operation}"` });
    }

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({ data: result.data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

