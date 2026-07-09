// Serverless Function para autenticar o superadmin no backend Vercel
export default function handler(req, res) {
  // CORS para desenvolvimento local se necessário
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { username, password } = req.body;
  
  // Em produção, isso virá das Environment Variables da Vercel
  const envUser = process.env.ADMIN_USERNAME || 'superadmin';
  const envPass = process.env.ADMIN_PASSWORD || 'huvi@2026';

  if (username === envUser && password === envPass) {
    // Retorna um token simples. Num cenário real usaríamos JWT assinado.
    // O backend /api/admin-supabase exigirá este token para operar.
    return res.status(200).json({ success: true, token: 'huvi-superadmin-token-v1' });
  }

  return res.status(401).json({ success: false, message: 'Credenciais inválidas' });
}
