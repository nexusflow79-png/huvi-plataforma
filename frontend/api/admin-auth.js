import { checkRequiredEnvVars, createAdminToken, safeCompareStrings } from './_admin-session.js';

// Serverless Function para autenticar o superadmin no backend Vercel
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // Exigir todas as variáveis de ambiente obrigatórias sem fallback
  if (!checkRequiredEnvVars()) {
    return res.status(503).json({
      success: false,
      message: 'Configuração administrativa indisponível no servidor'
    });
  }

  const { username, password } = req.body || {};

  // Validação estrita do payload (somente strings, não nulas e com tamanho máximo)
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    !username.trim() ||
    !password.trim() ||
    username.length > 200 ||
    password.length > 500
  ) {
    return res.status(400).json({
      success: false,
      message: 'Requisição inválida'
    });
  }

  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_HUVI_PASSWORD;

  // Comparação em tempo constante para evitar timing attacks
  const userMatch = safeCompareStrings(username, envUser);
  const passMatch = safeCompareStrings(password, envPass);

  if (userMatch && passMatch) {
    const { token, expiresIn } = createAdminToken();
    return res.status(200).json({
      success: true,
      token,
      expiresIn
    });
  }

  // Mensagem genérica para credenciais inválidas
  return res.status(401).json({
    success: false,
    message: 'Credenciais inválidas'
  });
}
