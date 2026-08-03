import { createClient } from '@supabase/supabase-js';
import { checkRequiredEnvVars, verifyAdminToken } from './_admin-session.js';

// Proxy Serverless para acessar o Supabase com Service Role Key
// Exige token de sessão assinado e válido no cabeçalho Authorization.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. Verificar variáveis obrigatórias do servidor
  if (!checkRequiredEnvVars()) {
    return res.status(503).json({ error: 'Configuração administrativa indisponível no servidor' });
  }

  // 2. Extrair e verificar o token do cabeçalho Authorization
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sessão administrativa ausente ou inválida' });
  }

  const tokenString = authHeader.substring(7).trim();
  const authResult = verifyAdminToken(tokenString);

  if (!authResult.valid) {
    if (authResult.configError) {
      return res.status(503).json({ error: 'Configuração administrativa indisponível no servidor' });
    }
    return res.status(401).json({ error: 'Sessão administrativa inválida ou expirada' });
  }

  // 3. Obter configurações do Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(503).json({ error: 'Configuração administrativa indisponível no servidor' });
  }

  // Contrato de campos alinhado com AdminProxyQueryBuilder (admin-client.js)
  const { operation, table, payload, filters, orderCol, orderAsc, isSingle } = req.body || {};

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

    } else if (operation === 'change_tenant_password') {
      const { email, password, full_name } = payload || {};
      if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
      }

      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return res.status(500).json({ error: 'Erro ao buscar usuários: ' + listError.message });
      }

      const existingUser = (users || []).find(u => u.email === email);

      if (existingUser) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password,
        });
        if (updateError) {
          return res.status(400).json({ error: 'Erro ao atualizar senha: ' + updateError.message });
        }
        result = { data: { action: 'updated', user_id: existingUser.id }, error: null };
      } else {
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: full_name || '' },
        });
        if (createError) {
          return res.status(400).json({ error: 'Erro ao criar usuário: ' + createError.message });
        }
        result = { data: { action: 'created', user_id: newUser?.user?.id }, error: null };
      }

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
