export interface EncryptedPinPayload {
  alg: 'AES-256-GCM';
  iv: string;
  salt: string;
  ciphertext: string;
}

const APP_KEY_MATERIAL = 'BicaraKu-AAC-Caregiver-PIN-Key-v1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(salt: Uint8Array, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(APP_KEY_MATERIAL),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    usage
  );
}

export async function encryptPin(pin: string): Promise<EncryptedPinPayload> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(salt, ['encrypt']);
  const encoded = new TextEncoder().encode(pin);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoded
  );

  return {
    alg: 'AES-256-GCM',
    iv: toBase64(iv),
    salt: toBase64(salt),
    ciphertext: toBase64(new Uint8Array(encryptedBuffer)),
  };
}

export async function decryptPin(payload: EncryptedPinPayload): Promise<string | null> {
  try {
    if (!payload || payload.alg !== 'AES-256-GCM' || !payload.iv || !payload.salt || !payload.ciphertext) {
      return null;
    }

    const salt = fromBase64(payload.salt);
    const iv = fromBase64(payload.iv);
    const ciphertext = fromBase64(payload.ciphertext);
    const key = await deriveAesKey(salt, ['decrypt']);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    );

    const decoded = new TextDecoder().decode(decryptedBuffer);
    return /^\d{4}$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
