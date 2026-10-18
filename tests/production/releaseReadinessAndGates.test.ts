import { describe, it, expect } from 'vitest';
import {
  ProductionReadinessEngine,
  CanonicalReleaseMetadata,
} from '../../src/production/index.js';
import type {
  StrategicGateId,
  ProductionGateId,
} from '../../src/production/models/ProductionReadinessModel.js';

describe('Phase 9.10 — Strategic Release Gates (Gates A–G) & Feature Inventory Audit', () => {
  it('should evaluate all 7 Strategic Release Gates (Gates A through G) successfully', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    expect(assessment).toBeDefined();
    expect(assessment.strategicGates).toBeDefined();
    expect(assessment.strategicGates).toHaveLength(7);

    const expectedStrategicGateIds: StrategicGateId[] = [
      'GATE_A_ARCHITECTURE',
      'GATE_B_FUNCTIONALITY',
      'GATE_C_SECURITY',
      'GATE_D_QUALITY',
      'GATE_E_OPERATIONS',
      'GATE_F_DOCUMENTATION',
      'GATE_G_RELEASE',
    ];

    const actualGateIds = assessment.strategicGates.map((g) => g.id);
    expect(actualGateIds).toEqual(expectedStrategicGateIds);

    for (const gate of assessment.strategicGates) {
      expect(gate.status).toBe('VERIFIED');
      expect(gate.contributingGateIds.length).toBeGreaterThan(0);
      expect(gate.evidence.length).toBeGreaterThan(0);
      expect(gate.outstandingIssues).toHaveLength(0);
      expect(gate.verifiedAt).toBeDefined();
    }
  });

  it('should verify Gate A (Architecture) aggregates core boundary and contract evidence', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const gateA = assessment.strategicGates.find((g) => g.id === 'GATE_A_ARCHITECTURE');
    expect(gateA).toBeDefined();
    expect(gateA?.code).toBe('A');
    expect(gateA?.name).toContain('Architecture');
    expect(gateA?.status).toBe('VERIFIED');

    const expectedContributing: ProductionGateId[] = [
      'GATE_1_ARCHITECTURE',
      'GATE_14_AGENT_RUNTIME',
      'GATE_15_CONTEXT_ORCHESTRATION',
      'GATE_18_FEATURE_INTELLIGENCE',
      'GATE_19_INTEGRATION',
    ];
    expect(gateA?.contributingGateIds).toEqual(expectedContributing);
  });

  it('should verify Gate B (Functionality) covers end-to-end lifecycle capabilities', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const gateB = assessment.strategicGates.find((g) => g.id === 'GATE_B_FUNCTIONALITY');
    expect(gateB).toBeDefined();
    expect(gateB?.code).toBe('B');
    expect(gateB?.status).toBe('VERIFIED');
    expect(gateB?.contributingGateIds).toContain('GATE_4_API');
    expect(gateB?.contributingGateIds).toContain('GATE_16_KNOWLEDGE_UPDATE_LOOP');
    expect(gateB?.contributingGateIds).toContain('GATE_17_VERIFICATION');
  });

  it('should verify Gate C (Security) checks scope authorization, isolation, and regression tests', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const gateC = assessment.strategicGates.find((g) => g.id === 'GATE_C_SECURITY');
    expect(gateC).toBeDefined();
    expect(gateC?.code).toBe('C');
    expect(gateC?.status).toBe('VERIFIED');
    expect(gateC?.contributingGateIds).toContain('GATE_5_SECURITY');
    expect(gateC?.contributingGateIds).toContain('GATE_6_IDENTITY_AUTHORIZATION');
    expect(gateC?.contributingGateIds).toContain('GATE_21_SECURITY_REGRESSION');
  });

  it('should verify Gate D (Quality) includes automated test evidence and zero blocker regressions', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const gateD = assessment.strategicGates.find((g) => g.id === 'GATE_D_QUALITY');
    expect(gateD).toBeDefined();
    expect(gateD?.code).toBe('D');
    expect(gateD?.status).toBe('VERIFIED');
    const testEvidence = gateD?.evidence.find((e) => e.id === 'EVD-STRAT-D-01');
    expect(testEvidence).toBeDefined();
    expect(testEvidence?.description).toContain('Vitest test suite');
  });

  it('should verify Gate E (Operations), Gate F (Documentation), and Gate G (Release)', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    const gateE = assessment.strategicGates.find((g) => g.id === 'GATE_E_OPERATIONS');
    expect(gateE?.status).toBe('VERIFIED');
    expect(gateE?.contributingGateIds).toContain('GATE_13_BACKUP_RESTORE');
    expect(gateE?.contributingGateIds).toContain('GATE_24_OPERATIONAL_READINESS');

    const gateF = assessment.strategicGates.find((g) => g.id === 'GATE_F_DOCUMENTATION');
    expect(gateF?.status).toBe('VERIFIED');
    expect(gateF?.contributingGateIds).toContain('GATE_22_DOCUMENTATION');

    const gateG = assessment.strategicGates.find((g) => g.id === 'GATE_G_RELEASE');
    expect(gateG?.status).toBe('VERIFIED');
    expect(gateG?.contributingGateIds).toContain('GATE_23_RELEASE_ROLLBACK');
  });

  it('should audit canonical feature inventory covering all phases with explicit statuses', () => {
    const engine = new ProductionReadinessEngine();
    const assessment = engine.evaluate();

    expect(assessment.featureInventory).toBeDefined();
    expect(assessment.featureInventory.length).toBeGreaterThanOrEqual(16);

    const featureIds = assessment.featureInventory.map((f) => f.featureId);
    expect(featureIds).toContain('FEAT-EXT-001'); // Extraction
    expect(featureIds).toContain('FEAT-REP-001'); // Repository Intelligence
    expect(featureIds).toContain('FEAT-CTX-001'); // Context Orchestration
    expect(featureIds).toContain('FEAT-MEM-001'); // Project Memory
    expect(featureIds).toContain('FEAT-PLG-001'); // Plugin Platform
    expect(featureIds).toContain('FEAT-AGT-001'); // Agent Runtime & MCP
    expect(featureIds).toContain('FEAT-CLI-001'); // CLI Platform
    expect(featureIds).toContain('FEAT-WKS-001'); // Workspace Management
    expect(featureIds).toContain('FEAT-CTX-002'); // Advanced Context Intelligence
    expect(featureIds).toContain('FEAT-RET-001'); // Semantic Retrieval & Memory
    expect(featureIds).toContain('FEAT-COL-001'); // Multi-Agent Collaboration
    expect(featureIds).toContain('FEAT-PLN-001'); // Task Planning & Orchestration
    expect(featureIds).toContain('FEAT-LRN-001'); // Learning & Feedback Intelligence
    expect(featureIds).toContain('FEAT-SDK-001'); // Plugin & SDK Ecosystem
    expect(featureIds).toContain('FEAT-ENT-001'); // Enterprise Analytics
    expect(featureIds).toContain('FEAT-REL-001'); // Release Certification

    for (const item of assessment.featureInventory) {
      expect(item.implementationStatus).toBe('VERIFIED');
      expect(item.integrationStatus).toBe('VERIFIED');
      expect(item.testStatus).toBe('VERIFIED');
      expect(item.securityStatus).toBe('VERIFIED');
      expect(item.documentationStatus).toBe('VERIFIED');
      expect(item.evidenceReferences.length).toBeGreaterThan(0);
      expect(item.releaseBlocking).toBe(true);
    }
  });

  it('should propagate blocking status from technical gate to strategic release gate', () => {
    class MockBlockedEngine extends ProductionReadinessEngine {
      public override evaluate() {
        const assessment = super.evaluate();
        const modifiedGates = assessment.gates.map((g) => {
          if (g.id === 'GATE_5_SECURITY') {
            return {
              ...g,
              status: 'BLOCKED' as const,
              blockers: ['CVE-SIMULATED-01: Critical auth bypass identified'],
            };
          }
          return g;
        });
        const strategicGates = this.evaluateStrategicGates(assessment.evaluatedAt, modifiedGates);
        return {
          ...assessment,
          gates: modifiedGates,
          strategicGates,
        };
      }
    }

    const blockedEngine = new MockBlockedEngine();
    const blockedAssessment = blockedEngine.evaluate();

    const gateC = blockedAssessment.strategicGates.find((g) => g.id === 'GATE_C_SECURITY');
    expect(gateC?.status).toBe('BLOCKED');
    expect(gateC?.outstandingIssues).toContain('CVE-SIMULATED-01: Critical auth bypass identified');
  });

  it('should verify CanonicalReleaseMetadata reflects Phase 9.10 production v1.0 specifications', () => {
    expect(CanonicalReleaseMetadata.version).toBe('1.0.0');
    expect(CanonicalReleaseMetadata.buildId).toContain('v1.0.0');
    expect(CanonicalReleaseMetadata.apiVersion).toBe('v1');
    expect(CanonicalReleaseMetadata.schemaVersion).toBe('2.0.0');
    expect(CanonicalReleaseMetadata.releaseDate).toBeDefined();
    expect(CanonicalReleaseMetadata.releaseNotes).toContain('Phase 9');
    expect(CanonicalReleaseMetadata.releaseNotes).toContain('1.0.0');
    expect(CanonicalReleaseMetadata.compatibility.minNodeVersion).toBe('>=20.0.0');
    expect(CanonicalReleaseMetadata.rollbackGuidance.supported).toBe(true);
    expect(CanonicalReleaseMetadata.breakingChanges).toHaveLength(0);
  });
});
