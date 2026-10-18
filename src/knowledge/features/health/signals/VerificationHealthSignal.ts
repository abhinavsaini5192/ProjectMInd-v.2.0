import type { IFeatureHealthSignal, HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { HealthSignalType } from '../models/HealthSignalType.js';
import { HealthSignalHelper } from './HealthSignalHelper.js';

export class VerificationHealthSignal implements IFeatureHealthSignal {
  public readonly id = 'VerificationHealthSignal';
  public readonly signalType: HealthSignalType = 'MISSING_TESTS';

  public async compute(context: HealthContext): Promise<HealthSignal[]> {
    const signals: HealthSignal[] = [];
    const mappings = context.mappings || [];
    const featureId = context.feature.featureId;

    const testMappings = mappings.filter((m) => {
      const isTestRole = m.role === 'TEST';
      const isTestPath = /test|spec|\.test\.|\.spec\./i.test(m.resourceId);
      return isTestRole || isTestPath;
    });

    const integrationTests = testMappings.filter((m) =>
      /integration|e2e|system|api\.test/i.test(m.resourceId)
    );

    const totalResources = mappings.length;
    const testRatio = totalResources > 0 ? testMappings.length / totalResources : 0;
    const lowTestRatioThreshold = context.config?.lowTestRatioThreshold ?? 0.2;

    // Signal: Completely missing tests
    if (testMappings.length === 0 && totalResources > 0) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'MISSING_TESTS',
          severity: 'HIGH',
          value: 0,
          normalizedValue: 100, // 100% problematic
          description: `Feature "${context.feature.name}" has no associated test files or test resources.`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'VERIFICATION_AUDIT',
              sourceId: featureId,
              evidenceType: 'TEST_ABSENCE',
              description: `Total resources: ${totalResources}, test resources: 0.`,
              strength: 1.0,
              confidence: 0.95
            })
          ],
          source: this.id,
          confidence: 0.95
        })
      );
    } else if (testRatio < lowTestRatioThreshold && totalResources >= 5) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'LOW_TEST_COVERAGE',
          severity: 'MEDIUM',
          value: `${Math.round(testRatio * 100)}%`,
          normalizedValue: Math.round((1 - testRatio) * 100),
          description: `Low test resource ratio: ${Math.round(testRatio * 100)}% of feature resources are tests (threshold: ${Math.round(lowTestRatioThreshold * 100)}%).`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'VERIFICATION_AUDIT',
              sourceId: featureId,
              evidenceType: 'TEST_RATIO',
              description: `Found ${testMappings.length} test resources out of ${totalResources} total resources.`,
              confidence: 0.9
            })
          ],
          source: this.id,
          confidence: 0.9
        })
      );
    }

    // No integration tests if it exposes endpoints or external integrations
    const hasEndpoints = mappings.some((m) => m.resourceType === 'ENDPOINT' || /endpoint|controller|api/i.test(m.resourceId));
    if (hasEndpoints && integrationTests.length === 0) {
      signals.push(
        HealthSignalHelper.createSignal({
          featureId,
          signalType: 'NO_INTEGRATION_TESTS',
          severity: 'MEDIUM',
          value: 0,
          normalizedValue: 70,
          description: `Feature exposes endpoints/APIs but has no detected integration or E2E tests.`,
          evidence: [
            HealthSignalHelper.createEvidence({
              sourceType: 'VERIFICATION_AUDIT',
              sourceId: featureId,
              evidenceType: 'MISSING_INTEGRATION_TESTS',
              description: `Endpoints detected without integration test coverage.`,
              confidence: 0.85
            })
          ],
          source: this.id,
          confidence: 0.85
        })
      );
    }

    // Inspect behavior flows for untested critical flows
    if (context.behavior && context.behavior.flows) {
      for (const flow of context.behavior.flows) {
        const isVerified = (flow as unknown as { isVerified?: boolean }).isVerified;
        const isCritical =
          flow.flowType === 'AUTHENTICATION' ||
          flow.flowType === 'AUTHORIZATION' ||
          flow.flowType === 'TRANSACTION';
        if (isVerified === false || (isVerified === undefined && testMappings.length === 0)) {
          if (isCritical) {
            signals.push(
              HealthSignalHelper.createSignal({
                featureId,
                signalType: 'UNTESTED_CRITICAL_FLOW',
                severity: 'CRITICAL',
                value: flow.name,
                normalizedValue: 90,
                description: `Critical flow "${flow.name}" (${flow.flowType}) lacks automated test verification.`,
                evidence: [
                  HealthSignalHelper.createEvidence({
                    sourceType: 'FEATURE_FLOW',
                    sourceId: flow.flowId,
                    evidenceType: 'FLOW_UNVERIFIED',
                    description: `Critical flow ${flow.flowId} has no corresponding test verification.`,
                    strength: 0.95,
                    confidence: 0.9
                  })
                ],
                source: this.id,
                confidence: 0.9
              })
            );
          }
        }
      }
    }

    return signals;
  }
}
