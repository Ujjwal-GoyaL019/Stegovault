"""
decrypt_stego_v2.py
====================
Decodes images encoded by StegoVault v2 (crypto.js v2).

Payload layout (LSB-encoded):
  [4]  magic  = 0x53 0x54 0x47 0x32  ("STG2")
  [1]  version = 0x01
  [32] salt   (random per encode, PBKDF2 input)
  [12] IV / nonce (AES-GCM nonce)
  [4]  ciphertext length (uint32 big-endian)
  [N]  ciphertext (AES-256-GCM output including 16-byte auth tag)

Crypto:
  Key derivation : PBKDF2-SHA256, 310 000 iterations, 32-byte random salt
  Cipher         : AES-256-GCM  (authentication built-in, no separate HMAC)
"""

import sys
import struct
import cv2
import numpy as np
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.exceptions import InvalidTag

# ── Payload constants ─────────────────────────────────────────
MAGIC       = bytes([0x53, 0x54, 0x47, 0x32])   # "STG2"
VERSION     = 0x01
HEADER_SIZE = 4 + 1 + 32 + 12 + 4               # 53 bytes
ITERATIONS  = 310_000


# ── Extract LSB bytes from image ─────────────────────────────

def extract_lsb_bytes(image_path: str, byte_count: int) -> bytes:
    img = cv2.imread(image_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f"Could not load image: {image_path}")

    h, w = img.shape[:2]

    # Normalise to RGBA channel order
    if img.ndim == 2:
        # Greyscale — expand to 4 channels
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        alpha = np.full((h, w, 1), 255, dtype=np.uint8)
        img = np.concatenate([img[:, :, [2, 1, 0]], alpha], axis=2)
    elif img.shape[2] == 4:
        img = img[:, :, [2, 1, 0, 3]]   # BGRA → RGBA

    flat = img.flatten()
    capacity = len(flat) // 8

    if byte_count > capacity:
        raise ValueError(
            f"Requested {byte_count} bytes but image only holds {capacity} bytes."
        )

    bits = flat[:byte_count * 8] & 1
    bits = bits.reshape(-1, 8)
    # Pack 8 bits → 1 byte (MSB first)
    powers = np.array([128, 64, 32, 16, 8, 4, 2, 1], dtype=np.uint8)
    return (bits * powers).sum(axis=1).astype(np.uint8).tobytes()


# ── Key derivation ────────────────────────────────────────────

def derive_key(password: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=ITERATIONS,
    )
    return kdf.derive(password.encode())


# ── Full decode pipeline ──────────────────────────────────────

def decrypt_stego(image_path: str, password: str) -> str:
    print("[+] Reading header from image LSBs…")
    header_bytes = extract_lsb_bytes(image_path, HEADER_SIZE)

    # Validate magic
    if header_bytes[:4] != MAGIC:
        raise ValueError(
            "Magic bytes not found — this image was not encoded with StegoVault v2, "
            "or it was saved in a lossy format (use PNG)."
        )

    version = header_bytes[4]
    if version != VERSION:
        raise ValueError(f"Unsupported payload version: {version:#04x}")

    salt           = header_bytes[5:37]
    iv             = header_bytes[37:49]
    ciphertext_len = struct.unpack(">I", header_bytes[49:53])[0]

    print(f"[+] Version    : {version}")
    print(f"[+] Salt       : {salt.hex()}")
    print(f"[+] IV (nonce) : {iv.hex()}")
    print(f"[+] Ciphertext : {ciphertext_len} bytes "
          f"(incl. 16-byte GCM tag → plaintext ≈ {ciphertext_len - 16} bytes)")

    total = HEADER_SIZE + ciphertext_len
    print(f"[+] Extracting {total} bytes from LSBs…")
    full_payload = extract_lsb_bytes(image_path, total)
    ciphertext   = full_payload[HEADER_SIZE:]

    print("[+] Deriving AES-256-GCM key (PBKDF2, 310k iterations)…")
    key = derive_key(password, salt)

    print("[+] Decrypting & verifying (AES-256-GCM)…")
    aesgcm = AESGCM(key)
    try:
        plaintext = aesgcm.decrypt(iv, ciphertext, associated_data=None)
    except InvalidTag:
        raise ValueError(
            "Authentication tag invalid — wrong password or image data was modified."
        )

    print("[+] Done.")
    return plaintext.decode("utf-8")


# ── CLI ───────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python decrypt_stego_v2.py <stego_image.png> [password]")
        sys.exit(1)

    img_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) >= 3 else input("Password: ")

    try:
        message = decrypt_stego(img_path, password)
        print("\n" + "=" * 40)
        print("Recovered message:")
        print("=" * 40)
        print(message)
    except Exception as e:
        print(f"\n[ERROR] {e}")
        sys.exit(1)
