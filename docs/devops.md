# Den Den DevOps & Deployment

## Overview

CI/CD pipeline using GitHub Actions. Automated testing, type checking, linting, and semantic versioning releases.

## Repository Structure

```
den-den-app/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml              # Continuous Integration
│   │   ├── release.yml         # Semantic Release (main only)
│   │   └── security.yml        # Dependency scanning
│   └── dependabot.yml          # Automated dependency updates
├── docs/                       # Documentation (this folder)
├── src/                        # Mobile app (Expo)
├── backend/                    # NestJS backend (separate repo or monorepo)
├── .env.example                # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── app.json                    # Expo config
├── eas.json                    # EAS Build config
└── README.md
```

---

## GitHub Actions Workflows

### 1. Continuous Integration (`.github/workflows/ci.yml`)

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '20'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

jobs:
  # ──────────────────────────────────────────────
  # Type Checking
  # ──────────────────────────────────────────────
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit
      # Backend typecheck (if monorepo)
      - run: cd backend && npm ci && npx tsc --noEmit

  # ──────────────────────────────────────────────
  # Linting
  # ──────────────────────────────────────────────
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx expo lint
      # Backend lint
      - run: cd backend && npm ci && npm run lint

  # ──────────────────────────────────────────────
  # Unit Tests
  # ──────────────────────────────────────────────
  test-unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          flags: unit
          files: ./coverage/lcov.info

  # ──────────────────────────────────────────────
  # Integration Tests
  # ──────────────────────────────────────────────
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: denden_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/denden_test
      - uses: codecov/codecov-action@v3
        with:
          flags: integration

  # ──────────────────────────────────────────────
  # Build Validation
  # ──────────────────────────────────────────────
  build:
    name: Build Validation
    runs-on: ubuntu-latest
    needs: [typecheck, lint]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npx expo export --platform web
        # Validates Metro bundler, assets, etc.
      # Backend build
      - run: cd backend && npm ci && npm run build

  # ──────────────────────────────────────────────
  # Security Scan
  # ──────────────────────────────────────────────
  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
      - run: npx audit-ci --config audit-ci.json
      # Snyk (optional)
      - uses: snyk/actions/node@master
        if: ${{ secrets.SNYK_TOKEN }}
        with:
          command: test
          args: --severity-threshold=high

  # ──────────────────────────────────────────────
  # E2E Tests (scheduled, not on every PR)
  # ──────────────────────────────────────────────
  test-e2e:
    name: E2E Tests
    runs-on: macos-latest  # For iOS simulator
    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
    timeout-minutes: 60
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: '15.4'
      - run: npm ci
      - run: npx detox build -c ios.sim.release
      - run: npx detox test -c ios.sim.release --headless
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: detox-artifacts
          path: artifacts/

  # ──────────────────────────────────────────────
  # Dependency Check
  # ──────────────────────────────────────────────
  deps:
    name: Dependency Review
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          config-file: '.github/dependency-review-config.yml'
```

### 2. Semantic Release (`.github/workflows/release.yml`)

```yaml
name: Release

on:
  push:
    branches: [main]  # ONLY main branch triggers release

permissions:
  contents: write
  issues: write
  pull-requests: write
  id-token: write

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for semantic-release
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'

      - name: Install Dependencies
        run: npm ci

      - name: Verify Build
        run: |
          npx tsc --noEmit
          npx expo lint
          npm run test:unit

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: npx semantic-release
```

### 3. Semantic Release Config (`.releaserc.json`)

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    "@semantic-release/npm",
    "@semantic-release/github",
    "@semantic-release/git"
  ],
  "commitAnalyzer": {
    "preset": "conventionalcommits"
  },
  "releaseNotesGenerator": {
    "preset": "conventionalcommits",
    "presetConfig": {
      "types": [
        { "type": "feat", "section": "Features" },
        { "type": "fix", "section": "Bug Fixes" },
        { "type": "perf", "section": "Performance" },
        { "type": "refactor", "section": "Refactoring" },
        { "type": "docs", "section": "Documentation", "hidden": false },
        { "type": "security", "section": "Security", "hidden": false }
      ]
    }
  },
  "changelog": {
    "changelogFile": "CHANGELOG.md"
  },
  "git": {
    "assets": ["CHANGELOG.md", "package.json", "backend/package.json"],
    "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
  },
  "github": {
    "assets": [
      { "path": "dist/**", "label": "Distribution" }
    ]
  }
}
```

### 4. Commit Message Convention

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | Version Bump | Description |
|------|--------------|-------------|
| `feat` | MINOR | New feature |
| `fix` | PATCH | Bug fix |
| `perf` | PATCH | Performance improvement |
| `refactor` | PATCH | Code refactor (no behavior change) |
| `docs` | PATCH | Documentation only |
| `security` | PATCH | Security fix |
| `feat!` / `fix!` | MAJOR | Breaking change (exclamation mark) |
| `BREAKING CHANGE:` | MAJOR | In footer |

**Examples:**
```
feat(chat): add message reactions
fix(auth): handle expired refresh token
refactor(crypto): simplify key derivation
docs: update encryption design
security(backup): increase Argon2id memory cost
feat(api)!: change message envelope format

BREAKING CHANGE: envelope now includes senderKeyId
```

### 5. Version Bumping Logic

```
Initial:           0.1.0
Bug fix:           0.1.1
Feature:           0.2.0
Breaking change:   1.0.0
```

Pre-1.0: Minor = breaking, Patch = features/fixes
Post-1.0: Major = breaking, Minor = features, Patch = fixes

---

## EAS Build Configuration (`eas.json`)

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium",
        "simulator": false
      },
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium",
        "buildConfiguration": "Release"
      },
      "android": {
        "buildType": "aab",
        "gradleCommand": ":app:bundleRelease"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "123456789",
        "appleTeamId": "TEAM_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "production"
      }
    }
  }
}
```

---

## Environment Management

### Development
```bash
# .env.development
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000/realtime
EXPO_PUBLIC_APP_ENV=development
```

### Staging (EAS secrets)
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://staging-api.den-den.app
eas secret:create --scope project --name EXPO_PUBLIC_WS_URL --value wss://staging-api.den-den.app/realtime
```

### Production (EAS secrets)
```bash
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value https://api.den-den.app
eas secret:create --scope project --name EXPO_PUBLIC_WS_URL --value wss://api.den-den.app/realtime
```

---

## Backend Deployment

### Docker Compose (Development)
```yaml
# backend/docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: denden
      POSTGRES_USER: denden
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports: ["5432:5432"]
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U denden"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redis_data:/data

  backend:
    build: .
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgresql://denden:${DB_PASSWORD}@postgres:5432/denden
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: development
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes (Production)

```yaml
# k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: denden-backend
  namespace: denden
spec:
  replicas: 3
  selector:
    matchLabels:
      app: denden-backend
  template:
    metadata:
      labels:
        app: denden-backend
    spec:
      containers:
        - name: backend
          image: ghcr.io/your-org/denden-backend:${VERSION}
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: denden-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: denden-backend
  namespace: denden
spec:
  selector:
    app: denden-backend
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP
```

---

## Monitoring & Observability

### Health Checks
```typescript
// backend/src/health/health.controller.ts
@Get('health')
liveness() {
  return { status: 'ok', timestamp: new Date().toISOString() };
}

@Get('health/ready')
async readiness() {
  const db = await this.db.execute(sql`SELECT 1`);
  const redis = await this.redis.ping();
  const storage = await this.storage.healthCheck();
  
  const checks = { database: db ? 'ok' : 'fail', redis, storage };
  const ready = Object.values(checks).every(c => c === 'ok');
  
  return { status: ready ? 'ready' : 'not ready', checks, timestamp: new Date().toISOString() };
}
```

### Metrics (Prometheus)
```typescript
// backend/src/common/metrics/metrics.interceptor.ts
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        const route = context.switchToHttp().getRequest().route?.path;
        httpRequestDuration.observe({ route, method }, duration);
        httpRequestsTotal.inc({ route, method, status: 'success' });
      }),
      catchError(err => {
        httpRequestsTotal.inc({ route, method, status: 'error' });
        throw err;
      })
    );
  }
}
```

### Logging (Pino)
```typescript
// backend/src/main.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.cookies.refreshToken',
      'req.body.password',
      'req.body.code',
      'req.body.ciphertext',
      'req.body.privateKey',
      '*.privateKey',
      '*.password',
      '*.token',
      '*.secret'
    ],
    censor: '[REDACTED]'
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});
```

---

## Backup & Disaster Recovery

### Database Backups
```bash
# Daily automated backup (cron in Kubernetes)
pg_dump -h $DB_HOST -U $DB_USER -d denden | gzip > s3://denden-backups/db/$(date +%F).sql.gz

# Point-in-time recovery (WAL archiving)
archive_mode = on
archive_command = 'aws s3 cp %p s3://denden-wal/%f'
```

### Mobile App Rollback
```bash
# EAS rollback
eas build:rollback --platform ios --version 1.2.3
eas build:rollback --platform android --version 1.2.3

# Or promote previous build
eas submit --platform ios --latest --profile production
```

---

## Security in CI/CD

### Secrets Management
- **GitHub Secrets**: API keys, tokens, certificates
- **EAS Secrets**: Build-time environment variables
- **Kubernetes Secrets**: Runtime secrets
- **Never**: Commit secrets to repo

### Supply Chain Security
```yaml
# .github/workflows/security.yml
- name: Verify Dependencies
  run: |
    npm audit signatures
    npx npm-audit-resolver

- name: SLSA Provenance
  uses: slsa-framework/slsa-github-generator/.github/workflows/generator_generic_slsa3.yml@v1.8.0
```

---

## Rollout Strategy

| Environment | Trigger | Approval |
|-------------|---------|----------|
| Development | Push to any branch | Auto |
| Staging | PR merged to develop | Auto |
| Production | Release tag (main) | Manual (GitHub Environment) |

### Feature Flags
```typescript
// src/constants/config.ts
export const FEATURE_FLAGS = {
  GROUP_CHATS: __DEV__ || process.env.EXPO_PUBLIC_FEATURE_GROUPS === 'true',
  BACKUP_ENCRYPTION: true,
  MESSAGE_REACTIONS: false,
  VOICE_MESSAGES: false,
} as const;
```

---

## References

- [Architecture](architecture.md)
- [Testing](testing.md)
- [Backend](backend.md)
- [API Design](api.md)
- [Security](security.md)