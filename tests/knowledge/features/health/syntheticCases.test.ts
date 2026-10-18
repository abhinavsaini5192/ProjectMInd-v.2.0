import { describe, it, expect } from 'vitest';
import { HealthTestHelper } from './HealthTestHelper.js';
import { FeatureHealthAnalyzer } from '../../../../src/knowledge/features/health/core/FeatureHealthAnalyzer.js';

describe('Phase 6.6 Section 50: 10 Mandatory Synthetic Test Cases', () => {
  const analyzer = new FeatureHealthAnalyzer();

  // Case 1: Authentication Feature (High Criticality, Endpoints, Missing Integration Tests)
  it('Case 1: Authentication Feature — high criticality, endpoints present, missing integration tests', async () => {
    const authFeature = HealthTestHelper.createFeature('feat_auth_c1', 'User Authentication', {
      type: 'CORE'
    });
    const epMap = HealthTestHelper.createMapping('feat_auth_c1', '/api/auth/login', 'ENDPOINT');
    const unitTest = HealthTestHelper.createMapping('feat_auth_c1', 'tests/auth.test.ts', 'FILE', 'TEST');
    const authGuard = HealthTestHelper.createMapping('feat_auth_c1', 'src/auth/jwtGuard.ts', 'FILE', 'IMPLEMENTATION');
    const dep1 = HealthTestHelper.createDependency('feat_checkout', 'feat_auth_c1');
    const dep2 = HealthTestHelper.createDependency('feat_admin', 'feat_auth_c1');

    const ctx = HealthTestHelper.createContext({
      feature: authFeature,
      mappings: [epMap, unitTest, authGuard],
      dependents: [dep1, dep2]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.criticality.level).toBe('HIGH');
    expect(health.criticality.metrics.coreDomain).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'NO_INTEGRATION_TESTS')).toBe(true);
  });

  // Case 2: Payment Feature (Critical Criticality, Remote Gateway, Unhandled Error)
  it('Case 2: Payment Feature — critical domain, remote gateway, unhandled error in flow', async () => {
    const paymentFeature = HealthTestHelper.createFeature('feat_payment_c2', 'Payment Processing', {
      type: 'CORE'
    });
    const stripeMap = HealthTestHelper.createMapping('feat_payment_c2', 'src/stripeClient.ts', 'FILE', 'INTEGRATION', {
      isExternalIntegration: true,
      hasTimeout: false
    });
    const epMap = HealthTestHelper.createMapping('feat_payment_c2', '/api/charge', 'ENDPOINT', 'ENTRY_POINT');
    const dep = HealthTestHelper.createDependency('feat_order', 'feat_payment_c2', 0.9);
    const flow = HealthTestHelper.createFlow('feat_payment_c2', 'flow_pay', 'Charge Card', 'TRANSACTION', 5, {
      hasErrorStep: false
    });

    const ctx = HealthTestHelper.createContext({
      feature: paymentFeature,
      mappings: [stripeMap, epMap],
      dependents: [dep],
      flows: [flow]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.criticality.level).toBe('CRITICAL');
    expect(health.signals.some((s) => s.signalType === 'UNHANDLED_ERROR_PATH')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'MISSING_TIMEOUT_CONFIGURATION')).toBe(true);
    expect(health.riskAssessment.risks.some((r) => r.riskType === 'BEHAVIOR' || r.riskType === 'INTEGRATION')).toBe(true);
  });

  // Case 3: God Feature / High Complexity (35 Cyclomatic Complexity, Deep Nesting, Large LOC)
  it('Case 3: God Feature — 35 cyclomatic complexity, deep nesting, 1200 LOC', async () => {
    const godFeature = HealthTestHelper.createFeature('feat_god_c3', 'OmniService');
    const godFile = HealthTestHelper.createMapping('feat_god_c3', 'src/OmniService.ts', 'FILE', 'IMPLEMENTATION', {
      cyclomaticComplexity: 35,
      nestingDepth: 8,
      linesOfCode: 1400
    });

    const ctx = HealthTestHelper.createContext({
      feature: godFeature,
      mappings: [godFile]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.healthScore.dimensionScores.COMPLEXITY_HEALTH.score).toBeLessThan(50);
    expect(health.signals.some((s) => s.signalType === 'HIGH_CYCLOMATIC_COMPLEXITY')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'DEEP_NESTING')).toBe(true);
    expect(health.riskAssessment.risks.some((r) => r.riskType === 'COMPLEXITY')).toBe(true);
  });

  // Case 4: Highly Coupled Hub Feature (15 Inbound & Outbound Dependencies)
  it('Case 4: Highly Coupled Hub Feature — excessive efferent & afferent coupling', async () => {
    const hubFeature = HealthTestHelper.createFeature('feat_hub_c4', 'EventBus Hub');
    const deps = [];
    const dependents = [];
    for (let i = 0; i < 12; i++) {
      deps.push(HealthTestHelper.createDependency('feat_hub_c4', `provider_${i}`, 0.9));
      dependents.push(HealthTestHelper.createDependency(`consumer_${i}`, 'feat_hub_c4', 0.9));
    }

    const ctx = HealthTestHelper.createContext({
      feature: hubFeature,
      dependencies: deps,
      dependents
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'HIGH_EFFERENT_COUPLING')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'HIGH_AFFERENT_COUPLING')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'UNBALANCED_COUPLING')).toBe(true);
    expect(health.riskAssessment.risks.some((r) => r.riskType === 'COUPLING')).toBe(true);
  });

  // Case 5: Circular Feature Dependency (Caught in Cycle Loop -> CRITICAL)
  it('Case 5: Circular Feature Dependency — caught in cycle loop, CRITICAL risk', async () => {
    const cycleFeature = HealthTestHelper.createFeature('feat_cycle_c5', 'Order Service');
    const cycle = HealthTestHelper.createCycle(['feat_cycle_c5', 'feat_inventory', 'feat_billing', 'feat_cycle_c5']);

    const ctx = HealthTestHelper.createContext({
      feature: cycleFeature,
      cycles: [cycle]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'CIRCULAR_FEATURE_DEPENDENCY')).toBe(true);
    const circRisk = health.riskAssessment.risks.find((r) => r.riskType === 'CIRCULAR_DEPENDENCY');
    expect(circRisk).toBeDefined();
    expect(circRisk?.severity).toBe('CRITICAL');
  });

  // Case 6: Deprecated Dependency Feature (Uses Deprecated/Unpinned Packages)
  it('Case 6: Deprecated Dependency Feature — relies on deprecated external package', async () => {
    const depFeature = HealthTestHelper.createFeature('feat_dep_c6', 'Legacy Serializer');
    const libMap = HealthTestHelper.createMapping('feat_dep_c6', 'npm:legacy-xml', 'DEPENDENCY', 'DEPENDENCY', {
      isDeprecated: true,
      isUnpinned: true
    });

    const ctx = HealthTestHelper.createContext({
      feature: depFeature,
      mappings: [libMap]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'DEPRECATED_DEPENDENCY')).toBe(true);
    expect(health.riskAssessment.risks.some((r) => r.riskType === 'DEPENDENCY')).toBe(true);
  });

  // Case 7: Untested Critical Flow Feature (High Criticality with 0 Test Resources)
  it('Case 7: Untested Critical Flow Feature — critical domain with zero test coverage', async () => {
    const untestedFeature = HealthTestHelper.createFeature('feat_trans_c7', 'Transfer Funds', {
      type: 'CORE'
    });
    const codeMap = HealthTestHelper.createMapping('feat_trans_c7', 'src/transfer.ts', 'FILE');
    const flow = HealthTestHelper.createFlow('feat_trans_c7', 'flow_xfer', 'Wire Transfer', 'TRANSACTION', 4, {
      isVerified: false
    });

    const ctx = HealthTestHelper.createContext({
      feature: untestedFeature,
      mappings: [codeMap],
      flows: [flow]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'MISSING_TESTS')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'UNTESTED_CRITICAL_FLOW')).toBe(true);
    expect(health.verificationQuality.level).toBe('NONE');
    const verifRisk = health.riskAssessment.risks.find((r) => r.riskType === 'VERIFICATION');
    expect(verifRisk?.severity).toBe('CRITICAL');
  });

  // Case 8: Rapid Churn Hotspot Feature (High Commit Velocity, Frequent Bug Fixes)
  it('Case 8: Rapid Churn Hotspot Feature — volatile commit history and frequent fixes', async () => {
    const churnFeature = HealthTestHelper.createFeature('feat_churn_c8', 'Volatile UI Component', {
      metadata: {
        churnScore: 35,
        commitCount: 50,
        bugFixCount: 12,
        isHotspot: true,
        recentChangesCount: 25
      }
    });

    const ctx = HealthTestHelper.createContext({
      feature: churnFeature
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'HIGH_CHURN_RATE')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'FREQUENT_BUG_FIXES')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'HOTSPOT_DETECTED')).toBe(true);
    expect(health.stability.level).toBe('HIGHLY_UNSTABLE');
  });

  // Case 9: Insecure Configuration / Exposed Secret (Hardcoded Secret & Permissive CORS)
  it('Case 9: Insecure Configuration — hardcoded API key and wildcard CORS', async () => {
    const secFeature = HealthTestHelper.createFeature('feat_sec_c9', 'Integration API');
    const cfgMap = HealthTestHelper.createMapping('feat_sec_c9', 'src/config.ts', 'CONFIGURATION', 'CONFIGURATION', {
      rawContent: 'SECRET_API_TOKEN = "test_secret_token_123456789"',
      permissiveCors: true
    });

    const ctx = HealthTestHelper.createContext({
      feature: secFeature,
      mappings: [cfgMap]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.signals.some((s) => s.signalType === 'EXPOSED_SECRET')).toBe(true);
    expect(health.signals.some((s) => s.signalType === 'PERMISSIVE_CORS')).toBe(true);
    const secRisk = health.riskAssessment.risks.find((r) => r.riskType === 'SECURITY');
    expect(secRisk?.severity).toBe('CRITICAL');
    expect(health.healthScore.status).not.toBe('HEALTHY');
  });

  // Case 10: Pristine Healthy Feature (Comprehensive Tests, No Circulars, Low Churn -> HEALTHY)
  it('Case 10: Pristine Healthy Feature — comprehensive tests, clean architecture, HEALTHY status', async () => {
    const pristineFeature = HealthTestHelper.createFeature('feat_pristine_c10', 'Telemetry Metrics');
    const codeMap = HealthTestHelper.createMapping('feat_pristine_c10', 'src/metrics.ts', 'FILE', 'IMPLEMENTATION', {
      cyclomaticComplexity: 5,
      linesOfCode: 120
    });
    const unitTest = HealthTestHelper.createMapping('feat_pristine_c10', 'tests/metrics.unit.test.ts', 'FILE', 'TEST');
    const intTest = HealthTestHelper.createMapping('feat_pristine_c10', 'tests/metrics.integration.test.ts', 'FILE', 'TEST');
    const dep = HealthTestHelper.createDependency('feat_pristine_c10', 'feat_logger', 0.2);
    const flow = HealthTestHelper.createFlow('feat_pristine_c10', 'flow_metric', 'Record Metric', 'PRIMARY', 3, {
      isVerified: true
    });

    const ctx = HealthTestHelper.createContext({
      feature: pristineFeature,
      mappings: [codeMap, unitTest, intTest],
      dependencies: [dep],
      flows: [flow]
    });

    const health = await analyzer.analyzeFeature(ctx);
    expect(health.healthScore.status).toBe('HEALTHY');
    expect(health.healthScore.overallScore).toBeGreaterThanOrEqual(85);
    expect(health.riskAssessment.overallRiskScore).toBeLessThan(20);
    expect(health.riskAssessment.highestRiskSeverity).toBe('INFO');
  });
});
