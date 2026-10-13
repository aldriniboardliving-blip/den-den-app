// src/security/secure-logging.ts
// Secure logging utility - no PII, no message content

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  userId?: string;
  deviceId?: string;
}

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'privateKey',
  'ciphertext',
  'nonce',
  'signature',
  'otp',
  'code',
  'authorization',
  'cookie',
  'session',
  'credential',
  'biometric',
  'fingerprint',
  'face',
  'passcode',
  'pin',
];

function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));
    
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else if (typeof value === 'string' && value.length > 1000) {
      sanitized[key] = value.substring(0, 1000) + '... [TRUNCATED]';
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

function formatLogEntry(entry: LogEntry): string {
  const sanitized = {
    ...entry,
    metadata: entry.metadata ? sanitizeMetadata(entry.metadata) : undefined,
  };
  return JSON.stringify(sanitized);
}

class SecureLogger {
  private minLevel: LogLevel = 'INFO';
  private isProduction = !__DEV__;
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 100;

  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    return levels.indexOf(level) >= levels.indexOf(this.minLevel);
  }

  private log(level: LogLevel, category: string, message: string, metadata?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return;

    const meta = metadata as Record<string, unknown> | undefined;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      requestId: meta?.['requestId'] as string,
      userId: meta?.['userId'] as string,
      deviceId: meta?.['deviceId'] as string,
    };

    // Add to buffer for debugging
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Console output in development
    if (!this.isProduction) {
      const prefix = `[${entry.timestamp}] [${level}] [${category}]`;
      switch (level) {
        case 'DEBUG':
          console.debug(prefix, message, sanitizeMetadata(metadata || {}));
          break;
        case 'INFO':
          console.info(prefix, message, sanitizeMetadata(metadata || {}));
          break;
        case 'WARN':
          console.warn(prefix, message, sanitizeMetadata(metadata || {}));
          break;
        case 'ERROR':
        case 'CRITICAL':
          console.error(prefix, message, sanitizeMetadata(metadata || {}));
          break;
      }
    }

    // In production, send to logging service
    if (this.isProduction) {
      this.sendToLoggingService(entry);
    }
  }

  private async sendToLoggingService(entry: LogEntry): Promise<void> {
    // In a real implementation, this would send to a logging service
    // For now, we just ensure it doesn't block
    try {
      // await fetch('https://logs.den-den.app/ingest', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: formatLogEntry(entry),
      // });
    } catch {
      // Fail silently - logging should never break the app
    }
  }

  debug(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('DEBUG', category, message, metadata);
  }

  info(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('INFO', category, message, metadata);
  }

  warn(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('WARN', category, message, metadata);
  }

  error(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('ERROR', category, message, metadata);
  }

  critical(category: string, message: string, metadata?: Record<string, unknown>): void {
    this.log('CRITICAL', category, message, metadata);
  }

  // Convenience methods for common categories
  auth(message: string, metadata?: Record<string, unknown>): void {
    this.info('AUTH', message, metadata);
  }

  crypto(message: string, metadata?: Record<string, unknown>): void {
    this.debug('CRYPTO', message, metadata);
  }

  network(message: string, metadata?: Record<string, unknown>): void {
    this.info('NETWORK', message, metadata);
  }

  sync(message: string, metadata?: Record<string, unknown>): void {
    this.info('SYNC', message, metadata);
  }

  security(message: string, metadata?: Record<string, unknown>): void {
    this.warn('SECURITY', message, metadata);
  }

  performance(message: string, metadata?: Record<string, unknown>): void {
    this.info('PERF', message, metadata);
  }

  getBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  clearBuffer(): void {
    this.logBuffer = [];
  }
}

export const secureLogger = new SecureLogger();

// Export sanitize function for use in other modules
export { sanitizeMetadata, SENSITIVE_FIELDS };