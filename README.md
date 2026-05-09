# StegoVault

> Hide encrypted messages inside images. No server. No accounts. Nothing leaves your device.

![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white)
![Web Crypto](https://img.shields.io/badge/Web%20Crypto%20API-native-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
---

## How it works

Pick any PNG image, write your message, set a password. StegoVault encrypts the message with AES-256-GCM and hides the ciphertext inside the image by overwriting the least significant bit of each pixel channel. The result looks pixel-for-pixel identical to the original. Anyone with the image and the correct password can recover the message — nobody else can.

All cryptography runs natively in the browser via the Web Crypto API. No libraries, no network requests, no telemetry.

---

## Security

| What | How |
|---|---|
| Encryption | AES-256-GCM |
| Key derivation | PBKDF2-SHA256, 310,000 iterations |
| Salt | 32 bytes, random per message |
| Nonce | 12 bytes, random per message |
| Integrity | GCM auth tag (built-in, 16 bytes) |
| Steganography | 1-bit LSB across all RGBA channels |

Because the salt is random and embedded in the image, two encodes of the same message with the same password produce completely different ciphertext every time.

**Payload structure written into LSBs:**

```
┌─────────────┬─────────┬──────────────┬───────────┬──────────────┬─────────────────────┐
│  magic [4]  │ ver [1] │  salt  [32]  │  iv [12]  │  length [4]  │   ciphertext [N]    │
│   "STG2"    │  0x01   │   random     │  random   │   uint32 BE  │  AES-GCM + auth tag │
└─────────────┴─────────┴──────────────┴───────────┴──────────────┴─────────────────────┘
```

Total fixed overhead: 53 bytes + ciphertext length.

---

## Getting started

```bash
git clone https://github.com/yourname/stegovault
cd stegovault
npm install
npm run dev
```

App runs at `http://localhost:5173`.

```bash
npm run build   # production build → dist/
```

---

## Python decoder

Decode from the terminal instead of the browser:

```bash
pip install cryptography opencv-python numpy
```

```bash
# prompts for password
python decrypt_stego_v2.py stego_output.png

# or pass it directly
python decrypt_stego_v2.py stego_output.png mypassword
```

---

## Limitations

**PNG only** — JPEG and WebP with lossy compression destroy the LSB data during re-encoding. The app saves output as PNG regardless of what you upload, but decoding a re-saved JPEG will fail.

**Password is unrecoverable** — if you lose the password, the message is gone. Wrong password causes GCM auth tag verification to fail immediately.

**Steganography ≠ invisibility** — LSB encoding leaves statistical fingerprints that tools like StegExpose can detect. StegoVault protects *what* is hidden, not *whether* something is hidden. If you need the image to pass steganalysis, this isn't the right tool.

---

## Project structure

```
stegovault/
├── src/
│   ├── crypto.js          # all crypto + LSB logic
│   ├── App.jsx
│   └── components/
│       ├── EncodePanel.jsx
│       ├── DecodePanel.jsx
│       ├── Header.jsx
│       ├── TabBar.jsx
│       ├── ImageDropZone.jsx
│       ├── PasswordInput.jsx
│       └── ProgressBar.jsx
├── decrypt_stego_v2.py    # CLI decoder (Python)
├── index.html
└── vite.config.js
```

---

## License

MIT
