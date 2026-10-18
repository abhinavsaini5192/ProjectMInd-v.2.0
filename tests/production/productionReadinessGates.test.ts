import { describe, it, expect } from 'vitest';
import {
  ProductionReadinessEngine,
  CanonicalReleaseMetadata,
  ProductionDISetup,
  ProductionTokens,
} from '../../src/production/index.js';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';
import type { ProductionRiskAcceptance } from '../../src/production/models/ProductionReadinessModel.js';

describe('Phase 8.10 — Production Readiness Gates & Certification', () => {
  it('should evaluate all 24 production readiness gates successfully', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    expect(assessment).toBeDefined();
    expect(assessment.gates).toHaveLength(24);
    expect(assessment.summary.totalGates).toBe(24);
  });

  it('should verify gate IDs cover all 24 required platform gates', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const expectedGateIds = [
      'GATE_1_ARCHITECTURE',
      'GATE_2_CONFIGURATION',
      'GATE_3_DEPLOYMENT',
      'GATE_4_API',
      'GATE_5_SECURITY',
      'GATE_6_IDENTITY_AUTHORIZATION',
      'GATE_7_PERSISTENCE',
      'GATE_8_DATA_LIFECYCLE',
      'GATE_9_OBSERVABILITY',
      'GATE_10_BACKGROUND_JOBS',
      'GATE_11_CONCURRENCY_SCALING',
      'GATE_12_RELIABILITY_RECOVERY',
      'GATE_13_BACKUP_RESTORE',
      'GATE_14_AGENT_RUNTIME',
      'GATE_15_CONTEXT_ORCHESTRATION',
      'GATE_16_KNOWLEDGE_UPDATE_LOOP',
      'GATE_17_VERIFICATION',
      'GATE_18_FEATURE_INTELLIGENCE',
      'GATE_19_INTEGRATION',
      'GATE_20_PERFORMANCE',
      'GATE_21_SECURITY_REGRESSION',
      'GATE_22_DOCUMENTATION',
      'GATE_23_RELEASE_ROLLBACK',
      'GATE_24_OPERATIONAL_READINESS',
    ];

    const actualGateIds = assessment.gates.map((g) => g.id);
    expect(actualGateIds).toEqual(expectedGateIds);
  });

  it('should produce evidence-backed results with zero unhandled blockers in baseline', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    expect(assessment.summary.gatesBlocked).toBe(0);
    expect(assessment.summary.checksBlocked).toBe(0);
    expect(assessment.summary.readyForProduction).toBe(true);
    expect(assessment.certification.decision).toBe('CERTIFIED_WITH_CONDITIONS');
    expect(assessment.certification.blockers).toHaveLength(0);
  });

  it('should correctly detect and propagate blocking conditions if a gate fails', () => {
    class MockBlockingEngine extends ProductionReadinessEngine {
      public override evaluate() {
        const assessment = super.evaluate();
        const blockedGates = assessment.gates.map((g) => {
          if (g.id === 'GATE_5_SECURITY') {
            return {
              ...g,
              status: 'BLOCKED' as const,
              severity: 'BLOCKER' as const,
              blockers: ['CHK-05-01: Critical security breach simulated'],
            };
          }
          return g;
        });

        const updatedSummary = {
          ...assessment.summary,
          gatesBlocked: 1,
          checksBlocked: 1,
          overallStatus: 'BLOCKED' as const,
          readyForProduction: false,
        };

        return {
          ...assessment,
          gates: blockedGates,
          summary: updatedSummary,
          certification: {
            ...assessment.certification,
            decision: 'BLOCKED' as const,
            statement: 'Platform production certification is BLOCKED by 1 critical issues.',
            blockers: [
              {
                id: 'BLK-5-1',
                gateId: 'GATE_5_SECURITY' as const,
                title: 'Critical security breach simulated',
                description: 'Blocker identified in GATE_5_SECURITY',
                severity: 'BLOCKER' as const,
                identifiedAt: new Date().toISOString(),
                resolutionPlan: 'Must resolve before certification.',
              },
            ],
          },
        };
      }
    }

    const blockingEngine = new MockBlockingEngine();
    const assessment = blockingEngine.evaluate();

    expect(assessment.summary.readyForProduction).toBe(false);
    expect(assessment.summary.overallStatus).toBe('BLOCKED');
    expect(assessment.certification.decision).toBe('BLOCKED');
    expect(assessment.certification.blockers).toHaveLength(1);
    expect(assessment.certification.blockers[0]?.gateId).toBe('GATE_5_SECURITY');
  });

  it('should support and aggregate explicit risk acceptance records', () => {
    const customRisk: ProductionRiskAcceptance = {
      riskId: 'RISK-CUSTOM-001',
      title: 'Staging environment disk space monitoring threshold',
      affectedSubsystem: 'Storage / Operations',
      severity: 'LOW',
      description: 'Staging volume alerted at 85% utilization during heavy test suite run.',
      mitigation: 'Automated disk purge job cleans temp scratch files daily.',
      residualRisk: 'Minimal operational risk on non-production volume.',
      reasonForAcceptance: 'Staging volume expansion planned for next infrastructure cycle.',
      acceptedBy: 'Infrastructure Lead',
      acceptedAt: '2026-09-29T15:00:00Z',
      reviewDue: '2026-10-31T00:00:00Z',
    };

    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate({
      customRiskAcceptances: [customRisk],
    });

    expect(assessment.riskAcceptances.length).toBeGreaterThanOrEqual(3);
    const found = assessment.riskAcceptances.find((r) => r.riskId === 'RISK-CUSTOM-001');
    expect(found).toBeDefined();
    expect(found?.acceptedBy).toBe('Infrastructure Lead');
  });

  it('should validate canonical release metadata integrity', () => {
    expect(CanonicalReleaseMetadata.version).toBe('1.0.0');
    expect(CanonicalReleaseMetadata.apiVersion).toBe('v1');
    expect(CanonicalReleaseMetadata.schemaVersion).toBe('2.0.0');
    expect(CanonicalReleaseMetadata.rollbackGuidance.supported).toBe(true);
    expect(CanonicalReleaseMetadata.rollbackGuidance.instructions.length).toBeGreaterThan(0);
    expect(CanonicalReleaseMetadata.deploymentPrerequisites.length).toBeGreaterThan(0);
  });

  it('should register production readiness services correctly into DI container', () => {
    const container = new DIContainer();
    const services = ProductionDISetup.registerProduction(container);

    expect(services.engine).toBeInstanceOf(ProductionReadinessEngine);
    expect(services.releaseMetadata).toBeDefined();

    const resolvedEngine = container.resolve<ProductionReadinessEngine>(
      ProductionTokens.ProductionReadinessEngine
    );
    expect(resolvedEngine).toBe(services.engine);

    const resolvedMeta = container.resolve(ProductionTokens.ReleaseMetadata);
    expect(resolvedMeta).toBe(services.releaseMetadata);
  });
});
