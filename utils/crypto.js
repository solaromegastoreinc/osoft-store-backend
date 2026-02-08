//backend/utils/crypto.js
import crypto from 'crypto';
import dotenv from "dotenv";
dotenv.config();

const algorithm = 'aes-256-cbc';
const secretKey = process.env.CRYPTO_SECRET_KEY;

if (!secretKey) {
  throw new Error("CRYPTO_SECRET_KEY missing from env");
}

// Ensure key length exactly 32 bytes for AES-256
const keyBuf = Buffer.from(secretKey);
if (keyBuf.length !== 32) {
  throw new Error(`CRYPTO_SECRET_KEY must be 32 bytes. Current length: ${keyBuf.length}. Update your .env to a 32-character secret.`);
}

export function encryptCode(code) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey), iv);
  let encrypted = cipher.update(code);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptCode(encryptedCode) {
  const [ivHex, encryptedHex] = encryptedCode.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(algorithm, Buffer.from(secretKey), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}