# Den Den Security Model

## Threat Model

### Assets to Protect
| Asset | Sensitivity | Impact if Compromised |
|-------|-------------|----------------------|
| Message plaintext | CRITICAL | Total privacy violation |
| Private keys (identity, prekeys) | CRITICAL | Impersonation, decryption of past/future messages |
| Backup encryption password | CRITICAL | Full history recovery |
| Session tokens | HIGH | Account takeover |
| Device identity | HIGH | Device impersonation |
| Contact list | MEDIUM | Social graph exposure |
| Message metadata | MEDIUM | Traffic analysis |

### Adversaries
| Adversary | Capabilities | Motivation |
|-----------|--------------|------------|
| **Network attacker** | MITM, traffic analysis, injection | Surveillance, censorship |
| **Malicious server** | Full server access, logs, database | Data harvesting, legal compulsion |
| **Device thief** | Physical device access | Personal data, messages |
| **Malicious app** | Same device, different app | Key extraction, screen scraping |
| **Insider** | Server admin access | Curiosity, coercion |
| **State actor** | Legal compulsion, infrastructure control | Intelligence, suppression |

### Trust Assumptions
1. **User's device is trusted** - Primary trust anchor
2. **Server is NOT trusted with plaintext** - Only encrypted envelopes
3. **TLS protects in transit** - But server terminates TLS
4. **Platform secure storage** - iOS Keychain / Android Keystore
5. **User verifies safety numbers** - For contact verification

---

## Security Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER DEVICE (TRUSTED)                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Plaintext   │  │  Crypto     │  │ Encrypted Envelope      │  │
│  │ Messages    │──▶│  Operations │──▶│  (Ciphertext + Nonce)   │  │
│  └─────────────┘  └─────────────┘  └───────────┬─────────────┘  │
│        ▲                    ▲                    │              │
│        │                    │                    │ TLS 1.3      │
│        │         ┌──────────┴──────────┐        │              │
│        │         │  Platform Secure    │        │              │
│        └────────▶│  Enclave / Keystore │        │              │
│                  │  (Private Keys)     │        │              │
│                  └─────────────────────┘        │              │
└─────────────────────────────────────────────────│──────────────┘
                                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SERVER (UNTRUSTED)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Relay       │  │ Auth &      │  │ Push                    │  │
│  │ (Encrypted  │  │ Device Mgmt │  │ (Metadata Only)         │  │
│  │  Envelopes) │  │             │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                 │
│  NEVER RECEIVES:                                                │
│  ✗ Message plaintext                                            │
│  ✗ Private keys                                                 │
│  ✗ Backup passwords                                             │
│  ✗ Safety numbers                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authentication Security

### OTP-Based Authentication
- **Email OTP** (primary): 6-digit code, 5 min TTL, 3 attempts
- **SMS OTP** (future): Same params, rate-limited by provider
- **Passkey/WebAuthn** (future): Phishing-resistant, device-bound

### Token Security
- **Access tokens**: JWT, RS256, 15 min TTL, `aud`, `iss`, `sub`, `device_id`
- **Refresh tokens**: Opaque, 30 days, rotated on use, stored httpOnly Secure cookie
- **Device binding**: Each token tied to device ID, validated on each request

### Session Management
- Concurrent session limit: 10 devices
- Automatic revocation on: password change, device removal, security event
- Refresh token rotation with reuse detection (revoke all on reuse)

---

## Device Identity & Registration

### Device Key Generation
```
On first app launch:
1. Generate Identity Key Pair (X25519) → Store private in Secure Enclave/Keystore
2. Generate Signed PreKey Pair (X25519) → Sign with Identity Key (Ed25519)
3. Generate 100 One-Time PreKeys (X25519) → Store encrypted
4. Register public keys with server
```

### Key Storage
| Key | Storage | Access |
|-----|---------|--------|
| Identity Private | Secure Enclave / StrongBox | Biometric + App attestation |
| Signed PreKey Private | Secure Enclave / Keystore | Biometric |
| One-Time PreKeys Private | Encrypted in SQLite | App unlock |
| Sender Keys (groups) | Encrypted in SQLite | App unlock |

### Key Rotation
- **Signed PreKey**: Weekly rotation, server stores last 2
- **One-Time PreKeys**: Consumed on use, replenish when < 20 remain
- **Sender Keys**: Rotated on group membership change

---

## Message Encryption

### Encryption Envelope
```json
{
  "messageId": "uuidv7",
  "senderDeviceId": "uuid",
  "recipientDeviceId": "uuid",
  "ciphertext": "base64",
  "nonce": "base64",
  "senderKeyId": 123,
  "encryptionAlgorithm": "X25519-AES256GCM",
  "contentType": "TEXT",
  "createdAt": "2026-01-15T10:30:00.000Z"
}
```

### Algorithm: X25519 + AES-256-GCM (Primary)
1. **Ephemeral key agreement**: Sender generates ephemeral X25519 keypair
2. **Shared secret**: `X25519(ephemeral_private, recipient_identity_public)`
3. **Key derivation**: `HKDF-SHA256(shared_secret, "DenDen Message v1", 32)`
4. **Encryption**: `AES-256-GCM(key, nonce, plaintext, aad)`
5. **AAD**: `messageId || senderDeviceId || recipientDeviceId || conversationId`

### Algorithm: X25519 + ChaCha20-Poly1305 (Alternative)
- For devices without AES-NI hardware acceleration
- Same key derivation, different AEAD

### Group Messages (Sender Keys)
1. Group creator generates random **Sender Key** (32 bytes)
2. Encrypt Sender Key to each member's identity key (individual envelopes)
3. Messages encrypted with Sender Key using AES-256-GCM
4. Sender Key rotated on membership change

---

## Forward Secrecy

### Current Implementation (Phase 1)
- **Ephemeral key per message** provides forward secrecy for individual messages
- Compromise of identity key → cannot decrypt past messages (ephemeral keys discarded)
- **No backward secrecy** - Future messages vulnerable if identity key compromised

### Future: Double Ratchet (Signal Protocol)
- Per-message ratchet for both forward and backward secrecy
- Requires libsignal integration
- Deferred to Phase 2+

---

## Backup Encryption

### Backup File Format
```
Den Den Backup v1
├── Header (unencrypted)
│   ├── Magic: "DENDEN_BACKUP"
│   ├── Version: 1
│   ├── Algorithm: "AES-256-GCM"
│   ├── KDF: "ARGON2ID"
│   ├── KDF Params: {mem: 64MB, iter: 3, parallel: 4, salt: 32 bytes}
│   └── Nonce: 12 bytes
├── Encrypted Payload
│   ├── Database dump (SQL)
│   ├── Schema version
│   └── Metadata JSON
└── Authentication Tag (16 bytes)
```

### Key Derivation
```
Backup Key = Argon2id(password, salt, mem=64MB, iter=3, parallel=4, 32 bytes)
File Key = HKDF-SHA256(Backup Key, "DenDen Backup File v1", 32)
```

### Security Properties
- **Offline brute-force resistance**: Argon2id memory-hard
- **Integrity**: GCM authentication tag
- **No server involvement**: Encrypted before leaving device
- **Versioned**: Future format changes supported

---

## Network Security

### TLS Configuration
- **Minimum**: TLS 1.2 (enforce 1.3 where available)
- **Cipher suites**: TLS_AES_256_GCM_SHA384, TLS_CHACHA20_POLY1305_SHA256
- **Certificate pinning**: Planned for production (HPKP alternative)
- **HSTS**: Preload list submission planned

### Certificate Validation
- System trust store + custom CA for internal services
- No user-overridable certificate errors in production

---

## Server-Side Security

### Data Minimization
| Data | Stored | Retention |
|------|--------|-----------|
| Encrypted message envelopes | Yes | 72 hours max (TTL) |
| Delivery receipts | Yes | 30 days |
| User accounts | Yes | Until deletion |
| Device public keys | Yes | Until revocation |
| Push tokens | Yes | Until revocation |
| Attachment metadata | Yes | 7 days |
| Access logs | No | N/A |
| Message plaintext | **NEVER** | N/A |

### Database Security
- **Row-level security**: Users only access own data
- **Encrypted columns**: Refresh token hashes, OTP code hashes
- **No plaintext secrets** in database
- **Audit logging**: All auth events, device changes, admin actions

### API Security
- **Rate limiting**: Per-IP, per-user, per-device
- **Input validation**: Zod schemas on all endpoints
- **Output encoding**: JSON serialization only
- **CORS**: Restricted to app domains
- **Security headers**: HSTS, CSP, X-Frame-Options, etc.

### Logging & Monitoring
```
ALLOWED in logs:
✓ Request path, method, status
✓ User ID (hashed), Device ID (hashed)
✓ Latency, error codes
✓ Security events (login, device add, failures)

NEVER in logs:
✗ Message content (plaintext or ciphertext)
✗ Private keys
✗ Passwords, OTP codes, tokens
✗ Backup passwords
✗ Safety numbers
✗ Contact lists
✗ IP addresses (full) - only /24 prefix
```

---

## Client-Side Security

### Secure Storage
| Data | iOS | Android |
|------|-----|---------|
| Identity private key | Secure Enclave (kSecAttrAccessControl) | StrongBox / Keystore |
| Session tokens | Keychain (kSecAttrAccessibleWhenUnlockedThisDeviceOnly) | EncryptedSharedPreferences |
| Database encryption key | Keychain | Keystore + SQLCipher |
| Backup password | Never stored | Never stored |

### App Hardening
- **Jailbreak/Root detection**: Warn user, optional lock
- **Screen capture prevention**: `FLAG_SECURE` on sensitive screens
- **Biometric lock**: Optional app-level lock (FaceID/TouchID)
- **Auto-lock**: Configurable timeout (default 5 min)
- **Keyboard cache prevention**: Secure text entry fields

### Code Integrity
- **Hermes bytecode** (React Native) - Obfuscated
- **Expo updates** - Signed, verified on load
- **App Store / Play Store** - Certificate pinning for updates

---

## Privacy by Design

### Data Collection
| Data | Collected | Purpose | Opt-out |
|------|-----------|---------|---------|
| Crash reports | Yes (opt-in) | Stability | Yes |
| Performance metrics | Yes (opt-in) | Performance | Yes |
| Usage analytics | **No** | N/A | N/A |
| Message content | **Never** | N/A | N/A |
| Contact list | **Never** | N/A | N/A |
| Location | **Never** | N/A | N/A |

### Metadata Protection
- **No message metadata on server** - Only encrypted envelopes
- **Push notifications** - Conversation ID + sender ID only, no content
- **Sealed sender** (future) - Hide sender from server
- **Traffic analysis resistance** - Fixed-size padding (future)

---

## Incident Response

### Compromise Scenarios

| Scenario | Detection | Response |
|----------|-----------|----------|
| Server database breach | Monitoring, audits | Rotate all keys, notify users, force re-registration |
| TLS certificate compromise | CT logs, monitoring | Revoke cert, deploy new, pin new cert |
| Device theft | User report | Remote wipe (via server device revocation) |
| Backup password leak | User report | Invalidate backup, create new |
| Insider access | Audit logs, SIEM | Immediate revocation, forensic analysis |

### Key Compromise Recovery
1. User detects/reports compromise
2. Server revokes all device sessions
3. User re-registers devices (new identity keys)
4. Contacts notified of safety number change
5. Old backups invalidated (cannot decrypt with new keys)

---

## Compliance

| Regulation | Status | Notes |
|------------|--------|-------|
| GDPR | Designed for | Data minimization, right to deletion, portability |
| CCPA | Designed for | No sale of data, deletion rights |
| ePrivacy | Designed for | Metadata protection |
| SOC 2 Type II | Planned | Post-launch audit |

---

## Security Checklist (Pre-Launch)

- [ ] Penetration test (mobile + backend)
- [ ] Cryptographic review (external auditor)
- [ ] Dependency audit (`npm audit`, `cargo audit`)
- [ ] TLS configuration test (SSL Labs A+)
- [ ] Rate limiting stress test
- [ ] Backup/restore security test
- [ ] Device revocation flow test
- [ ] Key rotation test
- [ ] Log sanitization verification
- [ ] Binary hardening verification

---

## References

- [Architecture](architecture.md)
- [Encryption Design](encryption.md)
- [API Design](api.md)
- [Database](database.md)
- [Backup & Recovery](backup-recovery.md)