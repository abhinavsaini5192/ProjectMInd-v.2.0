/**
 * Production Readiness & Certification Model for ProjectMind.
 * Defines canonical statuses, severities, gate structures, evidence links, findings,
 * risk acceptance records, and platform certification artifacts.
 */

export type ProductionReadinessStatus =
  | 'NOT_ASSESSED'
  | 'IMPLEMENTED'
  | 'VERIFIED'
  | 'PARTIALLY_VERIFIED'
  | 'ABSTRACTED'
  | 'NOT_IMPLEMENTED'
  | 'DEFERRED'
  | 'RISK_ACCEPTED'
  | 'BLOCKED';

export type ProductionReadinessSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'
  | 'BLOCKER';

export type ProductionReadinessCategory =
  | 'ARCHITECTURE'
  | 'SECURITY'
  | 'DATA_PERSISTENCE'
  | 'INFRASTRUCTURE_OPERATIONS'
  | 'AGENT_INTELLIGENCE'
  | 'QUALITY_RELEASE';

export type ProductionGateId =
  | 'GATE_1_ARCHITECTURE'
  | 'GATE_2_CONFIGURATION'
  | 'GATE_3_DEPLOYMENT'
  | 'GATE_4_API'
  | 'GATE_5_SECURITY'
  | 'GATE_6_IDENTITY_AUTHORIZATION'
  | 'GATE_7_PERSISTENCE'
  | 'GATE_8_DATA_LIFECYCLE'
  | 'GATE_9_OBSERVABILITY'
  | 'GATE_10_BACKGROUND_JOBS'
  | 'GATE_11_CONCURRENCY_SCALING'
  | 'GATE_12_RELIABILITY_RECOVERY'
  | 'GATE_13_BACKUP_RESTORE'
  | 'GATE_14_AGENT_RUNTIME'
  | 'GATE_15_CONTEXT_ORCHESTRATION'
  | 'GATE_16_KNOWLEDGE_UPDATE_LOOP'
  | 'GATE_17_VERIFICATION'
  | 'GATE_18_FEATURE_INTELLIGENCE'
  | 'GATE_19_INTEGRATION'
  | 'GATE_20_PERFORMANCE'
  | 'GATE_21_SECURITY_REGRESSION'
  | 'GATE_22_DOCUMENTATION'
  | 'GATE_23_RELEASE_ROLLBACK'
  | 'GATE_24_OPERATIONAL_READINESS';

export interface ProductionReadinessEvidence {
  readonly id: string;
  readonly type: 'TEST' | 'CONFIGURATION' | 'CODE' | 'METRIC' | 'DOCUMENTATION' | 'DRILL';
  readonly description: string;
  readonly reference: string;
  readonly verified: boolean;
  readonly timestamp: string;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ProductionReadinessFinding {
  readonly id: string;
  readonly category: string;
  readonly title: string;
  readonly description: string;
  readonly severity: ProductionReadinessSeverity;
  readonly status: ProductionReadinessStatus;
  readonly impact: string;
  readonly remediation: string;
  readonly evidence?: string[] | undefined;
  readonly owner?: string | undefined;
}

export interface ProductionReadinessCheck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly status: ProductionReadinessStatus;
  readonly severity: ProductionReadinessSeverity;
  readonly evidence: readonly ProductionReadinessEvidence[];
  readonly findings: readonly ProductionReadinessFinding[];
  readonly verifiedAt?: string | undefined;
}

export interface ProductionReadinessGate {
  readonly id: ProductionGateId;
  readonly gateNumber: number;
  readonly name: string;
  readonly purpose: string;
  readonly category: ProductionReadinessCategory;
  readonly status: ProductionReadinessStatus;
  readonly severity: ProductionReadinessSeverity;
  readonly checks: readonly ProductionReadinessCheck[];
  readonly evidence: readonly ProductionReadinessEvidence[];
  readonly findings: readonly ProductionReadinessFinding[];
  readonly blockers: readonly string[];
  readonly recommendations: readonly string[];
  readonly verifiedAt: string;
  readonly version: string;
}

export interface ProductionBlocker {
  readonly id: string;
  readonly gateId: ProductionGateId;
  readonly title: string;
  readonly description: string;
  readonly severity: 'CRITICAL' | 'BLOCKER';
  readonly identifiedAt: string;
  readonly resolutionPlan: string;
}

export interface ProductionRisk {
  readonly id: string;
  readonly title: string;
  readonly affectedSubsystem: string;
  readonly severity: ProductionReadinessSeverity;
  readonly description: string;
  readonly mitigation: string;
  readonly residualRisk: string;
}

export interface ProductionRiskAcceptance {
  readonly riskId: string;
  readonly title: string;
  readonly affectedSubsystem: string;
  readonly severity: ProductionReadinessSeverity;
  readonly description: string;
  readonly mitigation: string;
  readonly residualRisk: string;
  readonly reasonForAcceptance: string;
  readonly acceptedBy: string;
  readonly acceptedAt: string;
  readonly reviewDue: string;
}

export interface ProductionReadinessSummary {
  readonly totalGates: number;
  readonly gatesVerified: number;
  readonly gatesPartiallyVerified: number;
  readonly gatesAbstracted: number;
  readonly gatesBlocked: number;
  readonly gatesDeferred: number;
  readonly totalChecks: number;
  readonly checksVerified: number;
  readonly checksImplemented: number;
  readonly checksPartiallyVerified: number;
  readonly checksAbstracted: number;
  readonly checksRiskAccepted: number;
  readonly checksBlocked: number;
  readonly findingsBySeverity: Readonly<Record<ProductionReadinessSeverity, number>>;
  readonly overallStatus: ProductionReadinessStatus;
  readonly readyForProduction: boolean;
}

export interface ProductionCertification {
  readonly certificationId: string;
  readonly projectVersion: string;
  readonly evaluatedAt: string;
  readonly evaluator: string;
  readonly decision: 'CERTIFIED_WITH_CONDITIONS' | 'BLOCKED' | 'NOT_CERTIFIED';
  readonly statement: string;
  readonly verifiedCapabilities: readonly string[];
  readonly partiallyVerifiedCapabilities: readonly string[];
  readonly abstractedCapabilities: readonly string[];
  readonly deferredCapabilities: readonly string[];
  readonly acceptedRisks: readonly ProductionRiskAcceptance[];
  readonly blockers: readonly ProductionBlocker[];
  readonly operationalLimitations: readonly string[];
}

export type StrategicGateId =
  | 'GATE_A_ARCHITECTURE'
  | 'GATE_B_FUNCTIONALITY'
  | 'GATE_C_SECURITY'
  | 'GATE_D_QUALITY'
  | 'GATE_E_OPERATIONS'
  | 'GATE_F_DOCUMENTATION'
  | 'GATE_G_RELEASE';

export interface StrategicReleaseGate {
  readonly id: StrategicGateId;
  readonly code: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  readonly name: string;
  readonly description: string;
  readonly status: ProductionReadinessStatus;
  readonly contributingGateIds: readonly ProductionGateId[];
  readonly evidence: readonly ProductionReadinessEvidence[];
  readonly outstandingIssues: readonly string[];
  readonly verifiedAt: string;
}

export interface CanonicalFeatureInventoryItem {
  readonly featureId: string;
  readonly featureName: string;
  readonly owningSubsystem: string;
  readonly phase: string;
  readonly implementationStatus: ProductionReadinessStatus;
  readonly integrationStatus: ProductionReadinessStatus;
  readonly testStatus: ProductionReadinessStatus;
  readonly securityStatus: ProductionReadinessStatus;
  readonly documentationStatus: ProductionReadinessStatus;
  readonly dependencies: readonly string[];
  readonly knownLimitations: readonly string[];
  readonly evidenceReferences: readonly string[];
  readonly releaseBlocking: boolean;
}

export interface ProductionReadinessAssessment {
  readonly assessmentId: string;
  readonly projectVersion: string;
  readonly evaluatedAt: string;
  readonly summary: ProductionReadinessSummary;
  readonly gates: readonly ProductionReadinessGate[];
  readonly strategicGates: readonly StrategicReleaseGate[];
  readonly featureInventory: readonly CanonicalFeatureInventoryItem[];
  readonly certification: ProductionCertification;
  readonly riskAcceptances: readonly ProductionRiskAcceptance[];
}

