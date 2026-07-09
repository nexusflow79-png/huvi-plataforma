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

  // Verifica token básico enviado pelo frontend
  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== 'Bearer huvi-superadmin-token-v1') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, table, payload, match, select } = req.body;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    let result;
    if (action === 'select') {
      let query = supabase.from(table).select(select || '*');
      if (match) {
        for (const [key, val] of Object.entries(match)) {
          query = query.eq(key, val);
        }
      }
      result = await query;
    } else if (action === 'insert') {
      result = await supabase.from(table).insert(payload).select();
    } else if (action === 'update') {
      let query = supabase.from(table).update(payload);
      if (match) {
        for (const [key, val] of Object.entries(match)) {
          query = query.eq(key, val);
        }
      }
      result = await query.select();
    } else if (action === 'delete') {
      let query = supabase.from(table).delete();
      if (match) {
        for (const [key, val] of Object.entries(match)) {
          query = query.eq(key, val);
        }
      }
      result = await query;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(200).json({ success: true, ...result });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
