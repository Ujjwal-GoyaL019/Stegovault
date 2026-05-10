// ============================================================
//  StegoVault crypto.js  —  v2
//
//  Upgrades over v1:
//    • AES-256-GCM  (authenticated encryption, replaces CBC + HMAC)
//    • Random 32-byte salt per message  (fixes fixed-salt weakness)
//    • PBKDF2 iterations raised to 310 000
//    • Clean length-prefix framing  (replaces FF-escape encoding)
//    • 4-byte magic + 1-byte version header for future compatibility
//
//  Payload layout written into LSBs:
//    [4]  magic  = 0x53 0x54 0x47 0x32  ("STG2")
//    [1]  version = 0x01
//    [32] salt   (random per encode)
//    [12] IV / nonce (random per encode)
//    [4]  ciphertext length  (uint32 big-endian)
//    [N]  ciphertext  (AES-256-GCM output, includes 16-byte auth tag)
//
//  Total overhead: 4+1+32+12+4 = 53 bytes + ciphertext
// ============================================================

const MAGIC    = new Uint8Array([0x53, 0x54, 0x47, 0x32]); // "STG2"
const VERSION  = 0x01;
const ITERATIONS = 310_000;

// ── helpers ──────────────────────────────────────────────────

function utf8Bytes(str) { return new TextEncoder().encode(str); }

function concatBytes(...arrays) {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

function uint32BE(n) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, false);
  return b;
}

function readUint32BE(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, false);
}

// ── key derivation ────────────────────────────────────────────

async function deriveKey(password, salt) {
  const pwKey = await crypto.subtle.importKey(
    'raw', utf8Bytes(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ── AES-256-GCM encrypt ───────────────────────────────────────

async function aesGcmEncrypt(key, iv, plaintext) {
  return new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  );
  // returned bytes = ciphertext + 16-byte GCM auth tag (Web Crypto appends it)
}

// ── AES-256-GCM decrypt ───────────────────────────────────────

async function aesGcmDecrypt(key, iv, ciphertextWithTag) {
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertextWithTag)
  );
  // throws DOMException if auth tag is wrong (tampered data or wrong password)
}

// ── capacity ─────────────────────────────────────────────────

export function getCapacity(width, height) {
  // 1 bit per channel, 4 channels (RGBA), 8 bits per byte
  return Math.floor((width * height * 4) / 8);
}

// ── LSB write/read ────────────────────────────────────────────

function writeLSBs(pixels, payload) {
  for (let i = 0; i < payload.length; i++) {
    const byte = payload[i];
    const base = i * 8;
    for (let bit = 0; bit < 8; bit++) {
      pixels[base + bit] = (pixels[base + bit] & 0xFE) | ((byte >> (7 - bit)) & 1);
    }
  }
}

function readLSBs(pixels, byteCount) {
  const out = new Uint8Array(byteCount);
  for (let i = 0; i < byteCount; i++) {
    let byte = 0;
    const base = i * 8;
    for (let bit = 0; bit < 8; bit++) {
      byte = (byte << 1) | (pixels[base + bit] & 1);
    }
    out[i] = byte;
  }
  return out;
}

// ============================================================
//  ENCODE
// ============================================================
export async function encodeMessage(imageData, message, password, onProgress) {
  onProgress?.('Generating salt & IV…', 10);
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  onProgress?.('Deriving key (PBKDF2)…', 20);
  const key = await deriveKey(password, salt);

  onProgress?.('Encrypting (AES-256-GCM)…', 45);
  const plaintext   = utf8Bytes(message);
  const ciphertext  = await aesGcmEncrypt(key, iv, plaintext);
  // ciphertext already includes the 16-byte GCM auth tag

  // Build payload
  const payload = concatBytes(
    MAGIC,
    new Uint8Array([VERSION]),
    salt,
    iv,
    uint32BE(ciphertext.length),
    ciphertext
  );

  const capacity = getCapacity(imageData.width, imageData.height);
  if (payload.length > capacity) {
    throw new Error(
      `Message too large: needs ${payload.length} B, image holds ${capacity} B.`
    );
  }

  onProgress?.('Writing LSBs into image…', 75);
  const pixels = new Uint8ClampedArray(imageData.data);
  writeLSBs(pixels, payload);

  onProgress?.('Done!', 100);
  return new ImageData(pixels, imageData.width, imageData.height);
}

// ============================================================
//  DECODE
// ============================================================
export async function decodeMessage(imageData, password, onProgress) {
  const pixels = imageData.data;
  const maxBytes = Math.floor(pixels.length / 8);

  // ── Read and validate header (53 bytes) ──
  onProgress?.('Reading header…', 10);
  const HEADER_SIZE = 4 + 1 + 32 + 12 + 4; // magic+ver+salt+iv+len = 53
  if (maxBytes < HEADER_SIZE) {
    throw new Error('Image too small to contain a payload.');
  }

  const header = readLSBs(pixels, HEADER_SIZE);

  // Check magic bytes
  for (let i = 0; i < 4; i++) {
    if (header[i] !== MAGIC[i]) {
      throw new Error('No STG2 payload found — image was not encoded with this tool.');
    }
  }

  // Check version
  if (header[4] !== VERSION) {
    throw new Error(`Unsupported payload version: ${header[4]}.`);
  }

  const salt          = header.slice(5, 37);
  const iv            = header.slice(37, 49);
  const ciphertextLen = readUint32BE(header, 49);

  const totalPayload = HEADER_SIZE + ciphertextLen;
  if (totalPayload > maxBytes) {
    throw new Error('Payload length exceeds image capacity — data is corrupt.');
  }

  onProgress?.('Extracting ciphertext…', 25);
  const fullPayload = readLSBs(pixels, totalPayload);
  const ciphertext  = fullPayload.slice(HEADER_SIZE);

  onProgress?.('Deriving key (PBKDF2)…', 40);
  const key = await deriveKey(password, salt);

  onProgress?.('Decrypting & verifying (AES-256-GCM)…', 70);
  let plaintext;
  try {
    plaintext = await aesGcmDecrypt(key, iv, ciphertext);
  } catch {
    // GCM auth tag failure = wrong password OR tampered data
    throw new Error('Decryption failed — wrong password or data was tampered.');
  }

  onProgress?.('Done!', 100);
  return new TextDecoder().decode(plaintext);
}
