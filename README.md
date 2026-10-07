# Den Den

> **A private communication app built with end-to-end encryption to safeguard messages. Designed for security-conscious users and provides seamless messaging without compromising data privacy.**

## Philosophy

> **The user's device owns the conversation. The server temporarily transports encrypted messages.**

Den Den is:
- **Offline-first** — Works without internet, syncs when connectivity returns
- **Device-first** — Local SQLite is the source of truth
- **End-to-end encrypted** — Server never sees plaintext
- **Privacy-focused** — Minimal server-side data, no analytics
- **Reliable** — At-least-once delivery with acknowledgments
- **Recoverable** — Encrypted backup export/import

---

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | System overview, trust boundaries, data flow |
| [Database](docs/database.md) | SQLite schema, migrations, encryption at rest |
| [Backend](docs/backend.md) | NestJS + Drizzle ORM, module structure |
| [API](docs/api.md) | REST + WebSocket endpoints, authentication |
| [Security](docs/security.md) | Threat model, trust assumptions, hardening |
| [Encryption](docs/encryption.md) | X25519 + AES-256-GCM, key hierarchy, protocols |
| [Offline-First](docs/offline-first.md) | Sync queue, message states, conflict resolution |
| [Frontend](docs/frontend.md) | Feature-based architecture, state management |
| [Testing](docs/testing.md) | Unit, integration, E2E strategy |
| [DevOps](docs/devops.md) | CI/CD, semantic release, deployment |
| [Backup & Recovery](docs/backup-recovery.md) | Encrypted export/import, device migration |
| [Realtime](docs/realtime.md) | WebSocket protocol, push fallback |
| [AI](docs/ai.md) | On-device AI strategy, privacy guardrails |

---

## Tech Stack

### Mobile (Expo + React Native)
| Layer | Technology |
|-------|------------|
| Framework | Expo SDK 51+ |
| Navigation | Expo Router (file-based) |
| Language | TypeScript (strict) |
| Local DB | Expo SQLite (SQLite) |
| State | Zustand |
| Server State | TanStack Query |
| Crypto | react-native-libsodium (libsodium) |
| Background | expo-task-manager / expo-background-fetch |
| Testing | Vitest, React Native Testing Library, Detox |

### Backend (NestJS)
| Layer | Technology |
|-------|------------|
| Framework | NestJS 10 |
| Language | TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Realtime | WebSocket (ws) |
| Push | Expo Push / FCM / APNs |
| Auth | JWT + OTP (Email/SMS abstraction) |
| Validation | Zod + class-validator |
| Logging | Pino |

---

## Project Structure

```
den-den-app/
├── docs/                    # Documentation (see above)
├── src/                     # Mobile app (Expo)
│   ├── app/                 # Expo Router routes
│   ├── components/          # Shared UI components
│   ├── features/            # Feature modules (auth, chat, contacts, backup, settings)
│   ├── database/            # SQLite schema, repositories
│   ├── crypto/              # Core encryption, key management
│   ├── api/                 # API client, endpoints
│   ├── realtime/            # WebSocket connection
│   ├── sync/                # Offline sync engine
│   ├── store/               # Global Zustand stores
│   ├── hooks/               # Shared React hooks
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Utilities
│   └── constants/           # Config, theme
├── backend/                 # NestJS backend (separate folder)
│   ├── src/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── devices/
│   │   ├── conversations/
│   │   ├── messages/
│   │   ├── relay/
│   │   ├── delivery/
│   │   ├── attachments/
│   │   ├── notifications/
│   │   ├── health/
│   │   └── common/
│   ├── drizzle.config.ts
│   └── package.json
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── release.yml
│       └── security.yml
├── .env.example
├── package.json
├── tsconfig.json
├── app.json
├── eas.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 20 LTS
- npm / bun
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (macOS) / Android Studio

### Mobile App

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on platforms
npx expo run:ios      # iOS simulator
npx expo run:android  # Android emulator
npx expo start --web  # Web browser
```

### Backend

```bash
cd backend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Run migrations
npm run db:migrate

# Start development server
npm run start:dev
```

---

## Development Workflow

### Branching
```
main
├── feature/*
├── fix/*
├── chore/*
├── refactor/*
└── docs/*
```

### Commits (Conventional Commits)
```
feat(chat): add message reactions
fix(auth): handle expired refresh token
refactor(crypto): simplify key derivation
docs: update encryption design
security(backup): increase Argon2id memory cost
feat(api)!: change message envelope format

BREAKING CHANGE: envelope now includes senderKeyId
```

### CI Pipeline
- Type checking (`tsc --noEmit`)
- Linting (`expo lint`)
- Unit tests (`vitest run`)
- Integration tests (`vitest run --project=integration`)
- Build validation (`expo export`)

### Releases
- **Automatic** on push to `main`
- **Semantic Versioning** via `semantic-release`
- **GitHub Releases** with changelog
- **Only `main` branch** triggers releases

---

## Security

- **No plaintext messages** ever leave the device
- **X25519 + AES-256-GCM** for message encryption
- **Argon2id** for backup encryption
- **Secure Enclave / StrongBox** for private key storage
- **Safety numbers** for contact verification
- **Certificate pinning** planned for production

See [Security Model](docs/security.md) and [Encryption Design](docs/encryption.md) for details.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Contributing

1. Read the [Architecture](docs/architecture.md) and [Security](docs/security.md) docs
2. Follow the [Development Workflow](#development-workflow)
3. Ensure all CI checks pass
4. Write tests for new functionality
5. Update relevant documentation

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [NestJS Documentation](https://docs.nestjs.com/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [libsodium](https://libsodium.gitbook.io/doc/)
- [Signal Protocol](https://signal.org/docs/specifications/doubleratchet/)