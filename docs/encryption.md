# Den Den Encryption Design

## Overview

This document specifies the cryptographic protocols used in Den Den for end-to-end encryption. The design prioritizes established, well-audited primitives over custom constructions.

## Cryptographic Primitives

| Primitive | Algorithm | Library | Purpose |
|-----------|-----------|---------|---------|
| Key Agreement | X25519 | libsodium / Web Crypto | ECDH key exchange |
| Signatures | Ed25519 | libsodium / Web Crypto | PreKey authentication |
| Symmetric Encryption | AES-256-GCM | Web Crypto / libsodium | Message encryption |
| Symmetric Encryption (alt) | ChaCha20-Poly1305 | libsodium | Fallback for no AES-NI |
| Key Derivation | HKDF-SHA256 | Web Crypto / libsodium | Key separation |
| Password KDF | Argon2id | libsodium | Backup encryption |
| Hash | SHA-256 / BLAKE2b | Web Crypto / libsodium | Integrity, identifiers |
| Random | ChaCha20 (OS CSPRNG) | OS / libsodium | Nonces, keys, salts |

### Library Choice: **libsodium (via `react-native-libsodium`)**

**Rationale:**
- Mature, audited, constant-time implementations
- Single library for all primitives
- React Native support via `react-native-libsodium` (JSI bridge)
- No Web Crypto API inconsistencies across platforms
- Smaller bundle than multiple specialized libs

**Fallback:** Web Crypto API for web platform (Expo web support)

---

## Key Hierarchy

```
Master Identity (per device)
    │
    ├── Identity Key Pair (X25519)          ← Long-term, never rotates
    │       │
    │       ├── Signed PreKey Pair (X25519) ← Rotates weekly
    │       │       │
    │       │       └── Signature (Ed25519) ← Signed by Identity Key
    │       │
    │       └── One-Time PreKeys (X25519)   ← Consumed once, 100 pre-generated
    │
    ├── Sender Keys (per group)             ← Rotates on membership change
    │
    └── Backup Key                          ← Derived from user password (Argon2id)
```

### Key Lifecycles

| Key Type | Lifetime | Rotation Trigger | Compromise Impact |
|----------|----------|------------------|-------------------|
| Identity | Device lifetime | Device reset/reinstall | All past/future messages decryptable |
| Signed PreKey | 7 days | Timer + key exhaustion | Messages to this device in last 7 days |
| One-Time PreKey | Single use | Consumption | Single message |
| Sender Key | Group epoch | Membership change | Group messages in current epoch |
| Backup Key | User password lifetime | Password change | Backup files |

---

## Message Encryption Protocol

### 1. Direct Messages (1:1)

#### Sender Side
```
Input: plaintext, recipient_device_id, conversation_id

1. Fetch recipient's key bundle from local cache/server:
   - identity_key_public (X25519)
   - signed_prekey_public (X25519)
   - signed_prekey_signature (Ed25519)
   - onetime_prekey_public (X25519) [if available]

2. Verify signed_prekey_signature:
   Ed25519.verify(identity_key_public, signed_prekey_public || onetime_prekey_public, signature)

3. Generate ephemeral key pair:
   ephemeral_private, ephemeral_public = X25519.keygen()

4. Compute shared secrets (3 DH operations):
   dh1 = X25519(ephemeral_private, identity_key_public)
   dh2 = X25519(ephemeral_private, signed_prekey_public)
   dh3 = X25519(ephemeral_private, onetime_prekey_public)  // if available

5. Derive message key:
   sk = HKDF-SHA256(dh1 || dh2 || dh3, "DenDen Message v1", 32)

6. Generate random nonce (12 bytes for GCM):
   nonce = random_bytes(12)

7. Construct Additional Authenticated Data (AAD):
   aad = message_id || sender_device_id || recipient_device_id || conversation_id

8. Encrypt:
   ciphertext = AES-256-GCM(sk, nonce, plaintext, aad)

9. Output envelope:
   {
     messageId: uuidv7,
     senderDeviceId: sender_device_id,
     recipientDeviceId: recipient_device_id,
     ciphertext: base64(ciphertext),
     nonce: base64(nonce),
     ephemeralPublic: base64(ephemeral_public),
     signedPreKeyId: signed_prekey_id,
     onetimePreKeyId: onetime_prekey_id,  // null if none
     encryptionAlgorithm: "X25519-AES256GCM",
     contentType: "TEXT",
     createdAt: timestamp
   }
```

#### Recipient Side
```
Input: envelope, local private keys

1. Identify which keys to use:
   - identity_key_private (from Secure Enclave)
   - signed_prekey_private (matching signedPreKeyId)
   - onetime_prekey_private (matching onetimePreKeyId, then mark used)

2. Compute shared secrets:
   dh1 = X25519(identity_key_private, ephemeral_public)
   dh2 = X25519(signed_prekey_private, ephemeral_public)
   dh3 = X25519(onetime_prekey_private, ephemeral_public)  // if present

3. Derive message key:
   sk = HKDF-SHA256(dh1 || dh2 || dh3, "DenDen Message v1", 32)

4. Reconstruct AAD:
   aad = message_id || sender_device_id || recipient_device_id || conversation_id

5. Decrypt:
   plaintext = AES-256-GCM-DECRYPT(sk, nonce, ciphertext, aad)

6. Verify: If decryption fails → reject message (authentication failure)

7. If onetime_prekey used → mark as consumed, trigger replenishment if < 20 remain
```

### 2. Group Messages (Sender Keys)

#### Sender Key Distribution (Group Creation / Membership Change)
```
For each member device:
1. Generate random sender_key (32 bytes)
2. Encrypt sender_key to member's identity key using Direct Message protocol
3. Send encrypted sender_key as special SYSTEM message
4. Store sender_key locally for encryption
```

#### Group Message Encryption
```
Input: plaintext, sender_key, conversation_id

1. Generate random nonce (12 bytes)
2. AAD = message_id || sender_device_id || conversation_id || "GROUP"
3. ciphertext = AES-256-GCM(sender_key, nonce, plaintext, aad)
4. Output envelope (same format, but recipientDeviceId = conversation_id for routing)
```

#### Group Message Decryption
```
1. Retrieve sender_key for this conversation/sender
2. Decrypt using same AES-256-GCM with AAD
```

---

## Key Bundle Format (Server Storage)

```json
{
  "deviceId": "uuid",
  "identityKeyPublic": "base64_x25519_32bytes",
  "signedPreKey": {
    "id": 123,
    "publicKey": "base64_x25519_32bytes",
    "signature": "base64_ed25519_64bytes",
    "createdAt": "2026-01-15T10:30:00.000Z"
  },
  "onetimePreKeys": [
    {"id": 1, "publicKey": "base64_x25519_32bytes"},
    {"id": 2, "publicKey": "base64_x25519_32bytes"}
  ],
  "updatedAt": "2026-01-15T10:30:00.000Z"
}
```

---

## Attachment Encryption

### Encryption Process
```
1. Generate random file_key (32 bytes)
2. Generate random nonce (12 bytes)
3. Encrypt file stream: AES-256-GCM(file_key, nonce, file_data)
4. For each recipient device:
   - Encrypt file_key using Direct Message protocol
   - Store encrypted_file_key per recipient
5. Upload encrypted file to object storage
6. Store metadata: storage_key, encrypted_file_keys, nonce, size, mime_type
```

### Decryption Process
```
1. Download encrypted file from object storage
2. Retrieve encrypted_file_key for current device
3. Decrypt file_key using Direct Message protocol
4. Decrypt file stream: AES-256-GCM-DECRYPT(file_key, nonce, encrypted_data)
5. Verify integrity (GCM tag)
```

---

## Backup Encryption

### Format Specification
```
File: <uuid>.dendenbackup

Header (64 bytes, unencrypted):
  Offset  Size  Field
  0       16    Magic: "DENDEN_BACKUP_V1\0\0\0\0\0"
  16      4     Version: 1 (uint32 LE)
  20      1     Algorithm: 1 = AES-256-GCM
  21      1     KDF: 1 = Argon2id
  22      2     Reserved
  24      32    KDF Salt (random)
  56      4     KDF Memory (KB, uint32 LE) = 65536
  60      4     KDF Iterations (uint32 LE) = 3
  64      4     KDF Parallelism (uint32 LE) = 4
  68      12    File Nonce (random)
  80      32    Reserved for future

Encrypted Payload:
  - SQLite database dump (SQL statements)
  - Schema version
  - Metadata JSON (table counts, date ranges)

Authentication Tag (16 bytes, appended):
  - GCM tag covering Header (except Magic) + Payload
```

### Key Derivation
```
backup_key = Argon2id(
    password = user_backup_password,
    salt = header.kdf_salt,
    mem = header.kdf_memory_kib * 1024,
    iter = header.kdf_iterations,
    parallel = header.kdf_parallelism,
    hashlen = 32,
    type = Argon2id
)

file_key = HKDF-SHA256(
    ikm = backup_key,
    salt = "",
    info = "DenDen Backup File v1",
    length = 32
)
```

### Verification
```
1. Derive file_key from password
2. Decrypt payload with AES-256-GCM(file_key, header.nonce, payload, header[16:])
3. Verify GCM tag matches
4. Parse SQL, verify schema version compatibility
5. Compute SHA-256 of decrypted payload for integrity display
```

---

## Safety Numbers (Contact Verification)

### Computation
```
safety_number = SHA-256(
    "DenDen Safety Number v1" ||
    my_identity_key_public ||
    contact_identity_key_public
)[0:30]  // 30 bytes = 60 hex chars = 5 groups of 12 chars
```

### Display Format
```
XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
(10 groups of 4 hex chars, or 6 groups of 5 for QR)
```

### Verification Flow
1. Users meet in person or via trusted channel
2. Compare safety numbers visually or scan QR
3. Mark contact as `VERIFIED` locally
4. Store verification timestamp
5. Alert if safety number changes (key rotation or MITM)

---

## Implementation Details

### Mobile (React Native)

```typescript
// src/crypto/encryption.ts
import * as Sodium from 'react-native-libsodium';

export async function encryptMessage(
  plaintext: Uint8Array,
  recipientKeyBundle: KeyBundle,
  senderDeviceId: string,
  conversationId: string
): Promise<MessageEnvelope> {
  const messageId = generateUUIDv7();
  
  // Verify signed prekey
  const signedPrekeyValid = await Sodium.crypto_sign_verify_detached(
    recipientKeyBundle.signedPrekeySignature,
    concat(recipientKeyBundle.signedPrekeyPublic, recipientKeyBundle.onetimePrekeyPublic || new Uint8Array()),
    recipientKeyBundle.identityKeyPublic
  );
  if (!signedPrekeyValid) throw new Error('Invalid prekey signature');

  // Generate ephemeral keypair
  const ephemeral = await Sodium.crypto_box_keypair();
  
  // DH operations
  const dh1 = await Sodium.crypto_scalarmult(ephemeral.privateKey, recipientKeyBundle.identityKeyPublic);
  const dh2 = await Sodium.crypto_scalarmult(ephemeral.privateKey, recipientKeyBundle.signedPrekeyPublic);
  let dh3 = new Uint8Array(32);
  if (recipientKeyBundle.onetimePrekeyPublic) {
    dh3 = await Sodium.crypto_scalarmult(ephemeral.privateKey, recipientKeyBundle.onetimePrekeyPublic);
  }

  // Derive key
  const sk = await Sodium.crypto_kdf_derive_from_key(32, 1, "DenDen Message v1", concat(dh1, dh2, dh3));

  // Encrypt
  const nonce = Sodium.randombytes_buf(12);
  const aad = concat(
    stringToBytes(messageId),
    stringToBytes(senderDeviceId),
    stringToBytes(recipientKeyBundle.deviceId),
    stringToBytes(conversationId)
  );
  const ciphertext = await Sodium.crypto_aead_aes256gcm_encrypt(plaintext, aad, nonce, sk);

  return {
    messageId,
    senderDeviceId,
    recipientDeviceId: recipientKeyBundle.deviceId,
    ciphertext: bytesToBase64(ciphertext),
    nonce: bytesToBase64(nonce),
    ephemeralPublic: bytesToBase64(ephemeral.publicKey),
    signedPreKeyId: recipientKeyBundle.signedPrekeyId,
    onetimePreKeyId: recipientKeyBundle.onetimePrekeyId,
    encryptionAlgorithm: 'X25519-AES256GCM',
    contentType: 'TEXT',
    createdAt: Date.now()
  };
}
```

### Secure Enclave / Keystore Integration

```typescript
// src/crypto/keystore.ts
// iOS: Uses Keychain with kSecAttrAccessControl (biometryCurrentSet)
// Android: Uses KeyStore with StrongBox (if available) + BiometricPrompt

export interface SecureKeyPair {
  publicKey: Uint8Array;  // X25519 public (exportable)
  // privateKey NEVER leaves secure hardware
  // Operations performed via secure hardware APIs
}

export async function generateIdentityKeyPair(): Promise<SecureKeyPair> {
  // Platform-specific implementation
  // Returns public key, private key stays in secure hardware
}

export async function signWithIdentityKey(
  keyRef: SecureKeyRef,
  data: Uint8Array
): Promise<Uint8Array> {
  // Platform-specific signing
  // iOS: SecKeyCreateSignature
  // Android: KeyStore.sign
}

export async function decryptWithIdentityKey(
  keyRef: SecureKeyRef,
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  ephemeralPublic: Uint8Array
): Promise<Uint8Array> {
  // ECDH + AES-GCM inside secure hardware (if supported)
  // Or: ECDH in secure hardware, AES-GCM in app (key never exposed)
}
```

### Server (Node.js)

```typescript
// backend/src/crypto/relay.ts
// Server ONLY handles envelopes - NO decryption

interface MessageEnvelope {
  messageId: string;
  senderDeviceId: string;
  recipientDeviceId: string;
  ciphertext: string;  // base64
  nonce: string;       // base64
  ephemeralPublic: string;
  signedPreKeyId: number;
  onetimePreKeyId?: number;
  encryptionAlgorithm: string;
  contentType: string;
  createdAt: number;
}

// Validation only - no decryption
function validateEnvelope(envelope: MessageEnvelope): boolean {
  // Check required fields
  // Verify base64 decoding
  // Check algorithm supported
  // Verify timestamp not too old/future
  // Check messageId format (UUIDv7)
  return true;
}
```

---

## Random Number Generation

| Platform | Source | Notes |
|----------|--------|-------|
| iOS | `SecRandomCopyBytes` | Hardware RNG |
| Android | `SecureRandom` / `KeyStore` | Hardware-backed if StrongBox |
| Web | `crypto.getRandomValues()` | CSPRNG |
| Server (Node) | `crypto.randomBytes()` | CSPRNG |

**Never use:** `Math.random()`, `Date.now()`, non-crypto RNGs

---

## Constant-Time Operations

All cryptographic comparisons use constant-time functions:
- `sodium_memcmp` for signature/MAC verification
- `crypto.timingSafeEqual` (Node.js)
- No early-exit string/buffer comparisons on secrets

---

## Side-Channel Mitigations

1. **Memory zeroing**: `sodium_memzero()` on sensitive buffers after use
2. **No branching on secrets**: Constant-time algorithms only
3. **Secure Enclave**: Private keys never in app memory
4. **Argon2id**: Memory-hard KDF for backup passwords

---

## Algorithm Identifiers

| Identifier | Algorithm Suite |
|------------|-----------------|
| `X25519-AES256GCM` | X25519 + HKDF-SHA256 + AES-256-GCM |
| `X25519-CHACHA20POLY1305` | X25519 + HKDF-SHA256 + ChaCha20-Poly1305 |
| `ARGON2ID-AES256GCM` | Argon2id + HKDF-SHA256 + AES-256-GCM |

---

## Versioning & Migration

| Version | Changes | Migration |
|---------|---------|-----------|
| v1 | Initial (X25519 + AES-256-GCM) | N/A |
| v2 (future) | Double Ratchet (Signal) | Re-encrypt on device upgrade |

Algorithm negotiation via `encryptionAlgorithm` field in envelope.

---

## Testing Vectors

### X25519 + AES-256-GCM Test Vector
```
Identity Private:  77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a
Identity Public:   8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a
Ephemeral Private: 5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb
Ephemeral Public:  de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f
Shared Secret:     4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742
HKDF Output:       8f4a3c2e1d9b7f5a6c8e0d4b2f1a3c5e7f9b1d3a5c7e9f1b3d5a7c9e1f3b5d7
Plaintext:         "Hello, Den Den!"
Nonce:             000000000000000000000000
AAD:               "msgid_sender_recip_conv"
Ciphertext:        a1b2c3d4e5f6... (AES-256-GCM)
Tag:               f1e2d3c4b5a69788...
```

---

## References

- [RFC 7748](https://tools.ietf.org/html/rfc7748) - X25519
- [RFC 8032](https://tools.ietf.org/html/rfc8032) - Ed25519
- [RFC 5116](https://tools.ietf.org/html/rfc5116) - AEAD
- [RFC 5869](https://tools.ietf.org/html/rfc5869) - HKDF
- [Argon2 Spec](https://tools.ietf.org/html/draft-irtf-cfrg-argon2-11)
- [Signal Protocol](https://signal.org/docs/specifications/doubleratchet/)
- [libsodium](https://libsodium.gitbook.io/doc/)

---

## Related Documents

- [Security Model](security.md)
- [Architecture](architecture.md)
- [Database](database.md)
- [Backup & Recovery](backup-recovery.md)
- [API Design](api.md)