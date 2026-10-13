# Contributing to Den Den

Thank you for your interest in contributing to Den Den! This guide will help you get started.

## Code of Conduct

By participating, you agree to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior to conduct@den-den.app.

## Getting Started

### Prerequisites

- Node.js 20 LTS
- npm or bun
- Expo CLI: `npm install -g @expo/cli`
- iOS Simulator (macOS) / Android Studio
- Docker (for backend development)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/den-den-app.git
cd den-den-app

# Install mobile app dependencies
npm install --legacy-peer-deps

# Install backend dependencies
cd backend
npm install
cd ..

# Copy environment templates
cp .env.example .env
cp backend/.env.example backend/.env

# Start development servers
# Terminal 1: Mobile app
npx expo start

# Terminal 2: Backend
cd backend && npm run start:dev
```

## Development Workflow

### Branching Strategy

```
main
├── feature/description     # New features
├── fix/description         # Bug fixes
├── chore/description       # Maintenance tasks
├── refactor/description    # Code improvements
├── docs/description        # Documentation updates
└── security/description    # Security fixes
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `refactor` | Code refactor (no behavior change) |
| `docs` | Documentation only |
| `security` | Security fix |
| `chore` | Maintenance (deps, build, etc.) |
| `test` | Test additions/changes |

**Breaking Changes:** Append `!` after type or add `BREAKING CHANGE:` in footer.

```
feat(chat)!: change message envelope format

BREAKING CHANGE: envelope now includes senderKeyId
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Write code** with tests
3. **Run checks locally**:
   ```bash
   # Mobile
   npx tsc --noEmit
   npx expo lint
   npm run test:unit -- --run
   
   # Backend
   cd backend && npm run build && npm run test
   ```
4. **Push and create PR** against `main`
5. **Ensure CI passes** (typecheck, lint, tests, build, security)
6. **Request review** from maintainers
6. **Merge after approval** (squash and merge)

### PR Requirements

- [ ] All CI checks pass
- [ ] Tests added for new functionality
- [ ] Documentation updated (README, docs/, code comments)
- [ ] No new ESLint warnings
- [ ] TypeScript strict mode passes
- [ ] Conventional commit messages

## Coding Standards

### TypeScript

- Strict mode enabled (`strict: true`)
- No `any` types (use `unknown` or proper types)
- Explicit return types for public APIs
- Prefer `interface` over `type` for object shapes

### React Native / Expo

- Functional components with hooks
- Feature-based architecture (`src/features/`)
- Zustand for global state, TanStack Query for server state
- Expo Router for navigation

### Backend (NestJS)

- Modular architecture per feature
- Drizzle ORM for database
- Zod + class-validator for validation
- Pino for logging

### Security

- **Never** commit secrets, keys, or tokens
- All crypto operations in `src/crypto/` or `backend/src/security/`
- Use libsodium (X25519, AES-256-GCM, Argon2id)
- Certificate pinning for production WebSocket connections

### Database

- Migrations only (no direct schema changes)
- SQLite for mobile, PostgreSQL for backend
- Encrypted columns for sensitive data

## Testing

### Mobile App

```bash
# Unit tests
npm run test:unit -- --run

# Integration tests (requires backend)
npm run test:integration -- --run

# E2E tests (requires macOS for iOS)
npx detox build -c ios.sim.release
npx detox test -c ios.sim.release --headless
```

### Backend

```bash
cd backend

# All tests
npm run test

# Unit only
npm run test:unit

# Integration only
npm run test:integration

# E2E only
npm run test:e2e
```

### Coverage Requirements

- New code: ≥80% coverage
- Critical paths (crypto, auth, sync): ≥95%

## Documentation

Update relevant docs in `docs/` for any changes:

| Change Type | Docs to Update |
|-------------|----------------|
| Architecture | `architecture.md` |
| Database schema | `database.md` |
| Backend API | `backend.md`, `api.md` |
| Encryption | `encryption.md` |
| Security | `security.md` |
| Frontend | `frontend.md` |
| Testing | `testing.md` |
| DevOps | `devops.md` |

## Security Reporting

**Do not** open public issues for security vulnerabilities.

Report security issues privately to: security@den-den.app

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We'll acknowledge within 48 hours and coordinate disclosure.

## Release Process

1. **Automatic** on push to `main`
2. **Semantic Versioning** via `semantic-release`
3. **Changelog** generated from conventional commits
4. **GitHub Release** with artifacts
5. **Only `main` branch** triggers releases

## Getting Help

- **Discord**: [Den Den Community](https://discord.gg/den-den)
- **Discussions**: GitHub Discussions tab
- **Issues**: Bug reports and feature requests

## License

By contributing, you agree your contributions will be licensed under the MIT License.

---

*Thank you for making Den Den more secure and private!* 🔒