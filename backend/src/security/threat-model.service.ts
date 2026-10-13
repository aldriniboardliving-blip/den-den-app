import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DrizzleService } from '../common/database/drizzle.service';
import { syncOperations } from '../common/database/schema';
import { eq, and, gte, desc } from 'drizzle-orm';
import { createId } from '../common/utils/id';

export interface Threat {
  id: string;
  category: ThreatCategory;
  title: string;
  description: string;
  likelihood: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  impact: 'NEGLIGIBLE' | 'MINOR' | 'MODERATE' | 'MAJOR' | 'CATASTROPHIC';
  riskScore: number;
  mitigations: Mitigation[];
  status: 'IDENTIFIED' | 'ASSESSED' | 'MITIGATED' | 'ACCEPTED' | 'RESIDUAL';
  identifiedAt: Date;
  lastAssessedAt: Date;
  owner: string;
}

export type ThreatCategory =
  | 'SPOOFING'
  | 'TAMPERING'
  | 'REPUDIATION'
  | 'INFORMATION_DISCLOSURE'
  | 'DENIAL_OF_SERVICE'
  | 'ELEVATION_OF_PRIVILEGE'
  | 'CRYPTOGRAPHIC_FAILURE'
  | 'SUPPLY_CHAIN'
  | 'PHYSICAL'
  | 'HUMAN_FACTOR';

export interface Mitigation {
  id: string;
  description: string;
  type: 'PREVENTIVE' | 'DETECTIVE' | 'CORRECTIVE' | 'COMPENSATING';
  effectiveness: 'LOW' | 'MEDIUM' | 'HIGH';
  implemented: boolean;
  implementationDate?: Date;
  verificationMethod?: string;
}

export interface ThreatModelReport {
  modelVersion: string;
  generatedAt: Date;
  systemScope: string;
  threats: Threat[];
  summary: {
    total: number;
    byCategory: Record<ThreatCategory, number>;
    byRiskLevel: Record<string, number>;
    byStatus: Record<string, number>;
    mitigatedCount: number;
    residualRiskCount: number;
  };
  recommendations: string[];
}

@Injectable()
export class ThreatModelService {
  private readonly logger = new Logger(ThreatModelService.name);
  private threats = new Map<string, Threat>();

  constructor(
    private config: ConfigService,
    private drizzle: DrizzleService,
  ) {
    this.initializeDefaultThreats();
  }

  private initializeDefaultThreats(): void {
    const defaultThreats: Omit<Threat, 'id' | 'identifiedAt' | 'lastAssessedAt'>[] = [
      {
        category: 'SPOOFING',
        title: 'Impersonation via stolen device keys',
        description: 'Attacker gains access to device private keys and impersonates legitimate user',
        likelihood: 'LOW',
        impact: 'CATASTROPHIC',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-001',
            description: 'Hardware-backed key storage (Secure Enclave / StrongBox)',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-002',
            description: 'Device verification via safety numbers (QR code comparison)',
            type: 'DETECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-003',
            description: 'Biometric app lock required for key access',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Security Team',
      },
      {
        category: 'TAMPERING',
        title: 'Message modification in transit',
        description: 'Attacker modifies encrypted message ciphertext before delivery',
        likelihood: 'LOW',
        impact: 'MAJOR',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-004',
            description: 'AES-256-GCM authenticated encryption with AAD binding',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-005',
            description: 'Message integrity verification on decryption',
            type: 'DETECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Crypto Team',
      },
      {
        category: 'REPUDIATION',
        title: 'Sender denies sending message',
        description: 'Sender claims they did not send a message that was delivered',
        likelihood: 'MEDIUM',
        impact: 'MODERATE',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-006',
            description: 'Non-repudiation via Signal Protocol (sender keys for groups)',
            type: 'PREVENTIVE',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
          {
            id: 'mit-007',
            description: 'Delivery receipts stored with cryptographic proof',
            type: 'DETECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Protocol Team',
      },
      {
        category: 'INFORMATION_DISCLOSURE',
        title: 'Metadata leakage via push notifications',
        description: 'Push notification payload contains sensitive metadata',
        likelihood: 'LOW',
        impact: 'MODERATE',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-008',
            description: 'Push payloads contain only metadata (no message content)',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-009',
            description: 'Optional push notification disable per conversation',
            type: 'COMPENSATING',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Platform Team',
      },
      {
        category: 'DENIAL_OF_SERVICE',
        title: 'Relay server message flooding',
        description: 'Attacker floods relay with messages causing storage exhaustion',
        likelihood: 'MEDIUM',
        impact: 'MAJOR',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-010',
            description: 'Rate limiting per device and per user',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-011',
            description: 'Message TTL (30 days) with automatic cleanup',
            type: 'CORRECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-012',
            description: 'Max relay messages per recipient limit',
            type: 'PREVENTIVE',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Infrastructure Team',
      },
      {
        category: 'ELEVATION_OF_PRIVILEGE',
        title: 'Unauthorized device linking',
        description: 'Attacker links new device to user account without approval',
        likelihood: 'LOW',
        impact: 'CATASTROPHIC',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-013',
            description: 'Explicit user approval required on primary device',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-014',
            description: 'Time-limited link challenges (10 minutes)',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-015',
            description: 'WebSocket notification to all linked devices on new link',
            type: 'DETECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Security Team',
      },
      {
        category: 'CRYPTOGRAPHIC_FAILURE',
        title: 'Weak random number generation',
        description: 'Predictable keys due to insufficient entropy',
        likelihood: 'VERY_LOW',
        impact: 'CATASTROPHIC',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-016',
            description: 'Platform CSPRNG (Web Crypto / Secure Enclave / StrongBox)',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-017',
            description: 'libsodium for all cryptographic operations',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Crypto Team',
      },
      {
        category: 'SUPPLY_CHAIN',
        title: 'Compromised dependency',
        description: 'Malicious code injected via npm supply chain attack',
        likelihood: 'LOW',
        impact: 'CATASTROPHIC',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-018',
            description: 'npm audit and dependabot alerts',
            type: 'DETECTIVE',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
          {
            id: 'mit-019',
            description: 'Lockfile integrity verification in CI',
            type: 'DETECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-020',
            description: 'Minimal dependency policy',
            type: 'PREVENTIVE',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'DevOps Team',
      },
      {
        category: 'PHYSICAL',
        title: 'Device theft with unlocked app',
        description: 'Attacker gains physical access to unlocked device with app open',
        likelihood: 'MEDIUM',
        impact: 'MAJOR',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-021',
            description: 'Biometric app lock with configurable timeout',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-022',
            description: 'Automatic lock on app background',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
          {
            id: 'mit-023',
            description: 'Remote device revocation from another linked device',
            type: 'CORRECTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'MITIGATED',
        owner: 'Security Team',
      },
      {
        category: 'HUMAN_FACTOR',
        title: 'Social engineering / phishing',
        description: 'User tricked into revealing OTP or approving malicious device link',
        likelihood: 'HIGH',
        impact: 'MAJOR',
        riskScore: 0,
        mitigations: [
          {
            id: 'mit-024',
            description: 'Clear UI showing device name/platform in link requests',
            type: 'PREVENTIVE',
            effectiveness: 'MEDIUM',
            implemented: true,
          },
          {
            id: 'mit-025',
            description: 'User education in onboarding',
            type: 'COMPENSATING',
            effectiveness: 'LOW',
            implemented: true,
          },
          {
            id: 'mit-026',
            description: 'Rate limiting on OTP requests',
            type: 'PREVENTIVE',
            effectiveness: 'HIGH',
            implemented: true,
          },
        ],
        status: 'RESIDUAL',
        owner: 'Product Team',
      },
    ];

    for (const threat of defaultThreats) {
      const id = `THR-${String(this.threats.size + 1).padStart(4, '0')}`;
      const now = new Date();
      const fullThreat: Threat = {
        ...threat,
        id,
        riskScore: this.calculateRiskScore(threat.likelihood, threat.impact),
        identifiedAt: now,
        lastAssessedAt: now,
      };
      this.threats.set(id, fullThreat);
    }
  }

  private calculateRiskScore(likelihood: string, impact: string): number {
    const likelihoodScores = {
      VERY_LOW: 1, LOW: 2, MEDIUM: 3, HIGH: 4, VERY_HIGH: 5,
    };
    const impactScores = {
      NEGLIGIBLE: 1, MINOR: 2, MODERATE: 3, MAJOR: 4, CATASTROPHIC: 5,
    };
    return likelihoodScores[likelihood as keyof typeof likelihoodScores] * impactScores[impact as keyof typeof impactScores];
  }

  async getThreats(category?: ThreatCategory, status?: string): Promise<Threat[]> {
    let threats = Array.from(this.threats.values());

    if (category) {
      threats = threats.filter(t => t.category === category);
    }
    if (status) {
      threats = threats.filter(t => t.status === status);
    }

    return threats.sort((a, b) => b.riskScore - a.riskScore);
  }

  async getThreat(id: string): Promise<Threat | null> {
    return this.threats.get(id) || null;
  }

  async addThreat(threat: Omit<Threat, 'id' | 'identifiedAt' | 'lastAssessedAt'>): Promise<Threat> {
    const id = `THR-${String(this.threats.size + 1).padStart(4, '0')}`;
    const now = new Date();
    const fullThreat: Threat = {
      ...threat,
      id,
      riskScore: this.calculateRiskScore(threat.likelihood, threat.impact),
      identifiedAt: now,
      lastAssessedAt: now,
    };
    this.threats.set(id, fullThreat);
    return fullThreat;
  }

  async updateThreatStatus(id: string, status: Threat['status']): Promise<Threat | null> {
    const threat = this.threats.get(id);
    if (!threat) return null;

    threat.status = status;
    threat.lastAssessedAt = new Date();
    return threat;
  }

  async addMitigation(threatId: string, mitigation: Omit<Mitigation, 'id'>): Promise<Threat | null> {
    const threat = this.threats.get(threatId);
    if (!threat) return null;

    const mitigationWithId: Mitigation = {
      ...mitigation,
      id: `mit-${String(threat.mitigations.length + 1).padStart(3, '0')}`,
    };
    threat.mitigations.push(mitigationWithId);
    threat.lastAssessedAt = new Date();
    return threat;
  }

  async generateReport(): Promise<ThreatModelReport> {
    const threats = Array.from(this.threats.values());

    const byCategory: Record<ThreatCategory, number> = {} as Record<ThreatCategory, number>;
    const byRiskLevel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const threat of threats) {
      byCategory[threat.category] = (byCategory[threat.category] || 0) + 1;
      
      const riskLevel = this.getRiskLevel(threat.riskScore);
      byRiskLevel[riskLevel] = (byRiskLevel[riskLevel] || 0) + 1;
      
      byStatus[threat.status] = (byStatus[threat.status] || 0) + 1;
    }

    const mitigatedCount = threats.filter(t => t.status === 'MITIGATED').length;
    const residualRiskCount = threats.filter(t => t.status === 'RESIDUAL' || t.status === 'ACCEPTED').length;

    return {
      modelVersion: '1.0.0',
      generatedAt: new Date(),
      systemScope: 'Den Den E2E Encrypted Messaging Platform (Mobile Client + Backend)',
      threats,
      summary: {
        total: threats.length,
        byCategory,
        byRiskLevel,
        byStatus,
        mitigatedCount,
        residualRiskCount,
      },
      recommendations: this.generateRecommendations(threats),
    };
  }

  private getRiskLevel(score: number): string {
    if (score >= 20) return 'CRITICAL';
    if (score >= 12) return 'HIGH';
    if (score >= 6) return 'MEDIUM';
    if (score >= 3) return 'LOW';
    return 'VERY_LOW';
  }

  private generateRecommendations(threats: Threat[]): string[] {
    const recommendations: string[] = [];

    const residual = threats.filter(t => t.status === 'RESIDUAL' || t.status === 'ACCEPTED');
    if (residual.length > 0) {
      recommendations.push(
        `Review ${residual.length} residual/accepted risks: ${residual.map(t => t.title).join(', ')}`
      );
    }

    const unimplementedMitigations = threats.flatMap(t => 
      t.mitigations.filter(m => !m.implemented).map(m => `${t.title}: ${m.description}`)
    );
    if (unimplementedMitigations.length > 0) {
      recommendations.push(`Implement ${unimplementedMitigations.length} pending mitigations`);
    }

    const highRisk = threats.filter(t => t.riskScore >= 12);
    if (highRisk.length > 0) {
      recommendations.push(`Priority review for ${highRisk.length} HIGH/CRITICAL risk threats`);
    }

    const categoriesWithoutMitigations = Array.from(
      new Set(threats.filter(t => t.mitigations.length === 0).map(t => t.category))
    );
    if (categoriesWithoutMitigations.length > 0) {
      recommendations.push(`Add mitigations for categories: ${categoriesWithoutMitigations.join(', ')}`);
    }

    return recommendations;
  }

  async exportModel(): Promise<string> {
    const report = await this.generateReport();
    return JSON.stringify(report, null, 2);
  }

  async importModel(json: string): Promise<void> {
    const report: ThreatModelReport = JSON.parse(json);
    for (const threat of report.threats) {
      this.threats.set(threat.id, threat);
    }
  }
}