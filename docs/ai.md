# Den Den AI Strategy

## Position Statement

**AI is NOT part of the core security architecture.**

Den Den's primary promise is privacy through end-to-end encryption. Any AI features must:
1. Be opt-in (explicit user consent)
2. Run on-device whenever possible
3. Never send plaintext E2EE messages to external providers
4. Be clearly separated from core messaging functionality

---

## Potential Future Features

| Feature | Approach | Privacy Model |
|---------|----------|---------------|
| Smart Replies | On-device ML (Core ML / ML Kit) | Fully local |
| Translation | On-device (ML Kit) or opt-in cloud | Local default, cloud opt-in |
| Conversation Summary | On-device LLM (llama.cpp, MLC) | Fully local |
| Writing Assistance | On-device LLM | Fully local |
| Spam Detection | On-device classifier | Fully local |
| Search Assistance | On-device index + semantic search | Fully local |

---

## On-Device AI Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER DEVICE                            │
│  ┌─────────────┐    ┌─────────────────────────────────┐    │
│  │ E2EE Messages │    │          AI Engine            │    │
│  │  (Encrypted)  │    │  ┌─────────────────────────┐  │    │
│  └──────┬────────┘    │  │ Local Model Runtime     │  │    │
│         │             │  │ (Core ML / ML Kit /     │  │    │
│         ▼             │  │  llama.cpp / MLC LLM)   │  │    │
│  ┌─────────────┐      │  └───────────┬─────────────┘  │    │
│  │ Decrypted   │──────▶│              │              │    │
│  │ Messages    │      │  ┌───────────▼─────────────┐  │    │
│  │ (In Memory) │      │  │ Feature Processors     │  │    │
│  └─────────────┘      │  │ • Smart Reply          │  │    │
│                       │  │ • Translation          │  │    │
│                       │  │ • Summarization        │  │    │
│                       │  │ • Writing Assist       │  │    │
│                       │  │ • Spam Detection       │  │    │
│                       │  └───────────┬─────────────┘  │    │
│                       │              │                │    │
│                       │              ▼                │    │
│                       │  ┌─────────────────────────┐  │    │
│                       │  │ Output (UI only)       │  │    │
│                       │  │ • Suggestions          │  │    │
│                       │  │ • Translations         │  │    │
│                       │  │ • Summaries            │  │    │
│                       │  └─────────────────────────┘  │    │
│                       └─────────────────────────────────┘    │
│                              │                                │
│                              ▼                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ NEVER: Send plaintext to external AI provider          │  │
│  │ NEVER: Train on user messages without explicit consent │  │
│  │ NEVER: Log message content for AI telemetry            │  │
│  └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Opt-In External AI (If Ever Needed)

### Strict Requirements

1. **Explicit per-feature consent** - Separate toggle for each feature
2. **Clear data disclosure** - What data leaves device, where it goes, retention
3. **No persistent storage** - Provider must not store messages
4. **Zero-training guarantee** - Contractual + technical (no logging)
5. **Audit trail** - User can see what was sent when

### Implementation Guardrails

```typescript
// src/ai/guardrails.ts

interface AIProviderConfig {
  endpoint: string;
  apiKey: string;           // User-provided or app-managed
  features: AIFeature[];
  dataRetentionDays: 0;     // MUST be 0
  trainingOptOut: true;     // MUST be true
}

class AIService {
  private userConsent = new Map<AIFeature, boolean>();
  
  async process(feature: AIFeature, input: string): Promise<string> {
    // 1. Check explicit consent
    if (!this.userConsent.get(feature)) {
      throw new Error(`No consent for ${feature}`);
    }
    
    // 2. Verify provider config
    const config = this.getProviderConfig(feature);
    this.validateConfig(config);
    
    // 3. Send ONLY the specific input (no context, no history)
    const response = await this.callProvider(config, input);
    
    // 4. No logging of input/output
    return response;
  }
  
  private validateConfig(config: AIProviderConfig) {
    if (config.dataRetentionDays !== 0) {
      throw new Error('Provider must have zero data retention');
    }
    if (!config.trainingOptOut) {
      throw new Error('Provider must opt out of training');
    }
  }
}
```

---

## Model Candidates (On-Device)

| Task | Model | Size | Platform |
|------|-------|------|----------|
| Smart Reply | MobileBERT / DistilBERT | ~25 MB | Core ML, TFLite |
| Translation | MarianMT / NLLB-200 distilled | ~50-100 MB | Core ML, TFLite |
| Summarization | DistilBART / Pegasus distilled | ~100 MB | Core ML, TFLite |
| Writing Assist | Phi-2 / Gemma-2B / Llama-3.2-1B | 1-2 GB | llama.cpp, MLC LLM |
| Spam Detection | Custom TinyBERT | ~10 MB | Core ML, TFLite |
| Semantic Search | all-MiniLM-L6-v2 | ~80 MB | Core ML, TFLite |

### Integration Options

| Runtime | Pros | Cons |
|---------|------|------|
| **Core ML** | Native iOS, hardware accelerated | iOS only |
| **ML Kit (TensorFlow Lite)** | Cross-platform, Google maintained | Limited model zoo |
| **llama.cpp** | Runs any GGUF model, CPU/GPU/NPU | C++ integration complexity |
| **MLC LLM** | Apache TVM, GPU acceleration | Larger binary |
| **ONNX Runtime** | Cross-platform, many models | Mobile support evolving |

---

## Privacy-First Design Principles

1. **Local-first**: Default to on-device processing
2. **Minimal data**: Send only what's needed for the specific request
3. **No context leakage**: Never send conversation history unless explicitly requested for that feature
4. **Ephemeral processing**: Input processed and discarded immediately
5. **User control**: Granular toggles, clear indicators when AI is active
6. **Transparency**: Open-source models preferred, auditable pipelines

---

## Threat Model for AI

| Threat | Mitigation |
|--------|------------|
| Model extracts private info from activations | On-device only; no external inference |
| Provider logs messages | Zero-retention contracts; on-device default |
| Model memorizes training data | No training on user data |
| Side-channel attacks | Constant-time inference; secure enclave for keys |
| Prompt injection | Input sanitization; structured outputs |
| Supply chain (model weights) | Signed model artifacts; reproducible builds |

---

## Implementation Roadmap

| Phase | Features | Timeline |
|-------|----------|----------|
| 0 | **None** - Core E2EE messaging only | Launch |
| 1 | On-device spam detection | Post-launch |
| 2 | On-device smart replies (short) | +3 months |
| 3 | On-device translation | +6 months |
| 4 | On-device summarization (optional) | +9 months |
| 5 | Opt-in cloud LLM for writing assist | +12 months (if demanded) |

**No AI features in MVP.**

---

## References

- [Security](security.md)
- [Encryption](encryption.md)
- [Architecture](architecture.md)
- [Privacy Requirements](architecture.md#privacy-requirements)