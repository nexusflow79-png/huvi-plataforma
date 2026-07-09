// Health check do proxy
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  return res.status(200).json({
    status: 'ok',
    environment: process.env.VERCEL_ENV || 'production',
    message: 'HUVI Admin Proxy is running',
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });
}
