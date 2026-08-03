import crypto from 'crypto';

/**
 * HUVI — Admin Session Utility (HMAC-SHA256 Token)
 * Utilidade server-side para emissão e verificação de tokens stateless.
 */

const ISSUER = 'HUVI-Admin';
const AUDIENCE = 'huvi-admin-proxy';
const VERSION = 'v2';
const MAX_AGE_SECONDS = 3600; // 1 hora de validade máxima
const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url');
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function checkRequiredEnvVars() {
  const missing = [];
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_USERNAME.trim()) missing.push('ADMIN_USERNAME');
  if (!process.env.ADMIN_HUVI_PASSWORD || !process.env.ADMIN_HUVI_PASSWORD.trim()) missing.push('ADMIN_HUVI_PASSWORD');
  
  const secret = process.env.ADMIN_SESSION_SECRET ? process.env.ADMIN_SESSION_SECRET.trim() : '';
  if (!secret) {
    missing.push('ADMIN_SESSION_SECRET');
  } else if (Buffer.byteLength(secret, 'utf8') < 32) {
    console.error('[HUVI Admin Security] Configuração inválida: ADMIN_SESSION_SECRET');
    return false;
  }

  if (missing.length > 0) {
    console.error(`[HUVI Admin Security] Configuração ausente: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

export function createAdminToken() {
  const secret = process.env.ADMIN_SESSION_SECRET.trim();
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: 'superadmin',
    iss: ISSUER,
    aud: AUDIENCE,
    ver: VERSION,
    iat: now,
    exp: now + MAX_AGE_SECONDS,
    jti: crypto.randomUUID()
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('base64url');

  return {
    token: `${dataToSign}.${signature}`,
    expiresIn: MAX_AGE_SECONDS
  };
}

export function verifyAdminToken(tokenString) {
  if (!tokenString || typeof tokenString !== 'string' || tokenString.length > 4096) {
    return { valid: false, reason: 'Token ausente, malformado ou excede o tamanho máximo' };
  }

  const secret = process.env.ADMIN_SESSION_SECRET ? process.env.ADMIN_SESSION_SECRET.trim() : '';
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    return { valid: false, reason: 'Configuração indisponível no servidor', configError: true };
  }

  const parts = tokenString.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Estrutura de token inválida' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  if (
    !headerB64 || !BASE64URL_REGEX.test(headerB64) ||
    !payloadB64 || !BASE64URL_REGEX.test(payloadB64) ||
    !signatureB64 || !BASE64URL_REGEX.test(signatureB64)
  ) {
    return { valid: false, reason: 'Segmentos do token inválidos ou com caracteres não autorizados' };
  }

  // 1. Decodificar e validar o Header
  let header;
  try {
    header = JSON.parse(base64UrlDecode(headerB64));
  } catch (e) {
    return { valid: false, reason: 'Header do token malformado' };
  }

  if (!header || typeof header !== 'object' || header.alg !== 'HS256' || header.typ !== 'JWT') {
    return { valid: false, reason: 'Header do token inválido (exige alg=HS256 e typ=JWT)' };
  }

  // 2. Comparar a Assinatura Diretamente via Buffers com timingSafeEqual
  const dataToSign = `${headerB64}.${payloadB64}`;
  const expectedSignatureBuffer = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest();

  let receivedSignatureBuffer;
  try {
    receivedSignatureBuffer = Buffer.from(signatureB64, 'base64url');
  } catch (e) {
    return { valid: false, reason: 'Assinatura base64url malformada' };
  }

  if (
    !receivedSignatureBuffer ||
    receivedSignatureBuffer.length === 0 ||
    receivedSignatureBuffer.length !== expectedSignatureBuffer.length
  ) {
    return { valid: false, reason: 'Comprimento da assinatura do token inválido' };
  }

  try {
    if (!crypto.timingSafeEqual(receivedSignatureBuffer, expectedSignatureBuffer)) {
      return { valid: false, reason: 'Assinatura do token inválida' };
    }
  } catch (e) {
    return { valid: false, reason: 'Erro na verificação da assinatura do token' };
  }

  // 3. Decodificar e validar Payload
  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch (e) {
    return { valid: false, reason: 'Payload do token corrompido' };
  }

  if (!payload || typeof payload !== 'object') {
    return { valid: false, reason: 'Payload do token inválido' };
  }

  // 4. Validar Tempos do Token
  const now = Math.floor(Date.now() / 1000);

  if (!Number.isInteger(payload.iat)) {
    return { valid: false, reason: 'Campo iat ausente ou não inteiro' };
  }

  if (!Number.isInteger(payload.exp)) {
    return { valid: false, reason: 'Campo exp ausente ou não inteiro' };
  }

  if (payload.exp <= payload.iat) {
    return { valid: false, reason: 'Campo exp deve ser maior que iat' };
  }

  if (payload.exp - payload.iat > MAX_AGE_SECONDS) {
    return { valid: false, reason: 'Duração do token excede o limite máximo de 1 hora' };
  }

  if (now >= payload.exp) {
    return { valid: false, reason: 'Token expirado' };
  }

  if (payload.iat > now + 60) {
    return { valid: false, reason: 'Token com iat no futuro' };
  }

  // 5. Validar Issuer, Audience, Subject e Version
  if (payload.iss !== ISSUER || payload.aud !== AUDIENCE || payload.sub !== 'superadmin' || payload.ver !== VERSION) {
    return { valid: false, reason: 'Campos de controle do token inválidos' };
  }

  return { valid: true, payload };
}

export function safeCompareStrings(strA, strB) {
  const hashA = crypto.createHash('sha256').update(String(strA || '')).digest();
  const hashB = crypto.createHash('sha256').update(String(strB || '')).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}
