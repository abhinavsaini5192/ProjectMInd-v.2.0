import type { IFeatureHealthSignal, HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { HealthSignalType } from '../models/HealthSignalType.js';
import { HealthSignalHelper } from './HealthSignalHelper.js';

export class BehaviorHealthSignal implements IFeatureHealthSignal {
  public readonly id = 'BehaviorHealthSignal';
  public readonly signalType: HealthSignalType = 'COMPLEX_EXECUTION_FLOW';

  public async compute(context: HealthContext): Promise<HealthSignal[]> {
    const signals: HealthSignal[] = [];
    const featureId = context.feature.featureId;
    const behavior = context.behavior;

    if (!behavior || !behavior.flows || behavior.flows.length === 0) {
      return signals;
    }

    for (const flow of behavior.flows) {
      const stepCount = flow.steps?.length ?? 0;

      // Complex execution flow (e.g. > 10 steps in a single flow)
      if (stepCount > 10) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'COMPLEX_EXECUTION_FLOW',
            severity: stepCount > 18 ? 'HIGH' : 'MEDIUM',
            value: stepCount,
            normalizedValue: Math.min(100, stepCount * 6),
            description: `Flow "${flow.name}" has high step complexity (${stepCount} steps).`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'BEHAVIOR_FLOW',
                sourceId: flow.flowId,
                evidenceType: 'FLOW_STEP_COMPLEXITY',
                description: `Flow ${flow.flowId} contains ${stepCount} execution steps.`,
                confidence: 0.9,
                metadata: { stepCount, flowId: flow.flowId }
              })
            ],
            source: this.id,
            confidence: 0.9
          })
        );
      }

      // Check steps for error handling and dead ends
      const hasErrorHandling = flow.steps?.some(
        (s: any) => s.stepType === 'ERROR_HANDLING' || /error|catch|fallback|retry/i.test(s.description)
      );
      const isSensitiveFlow =
        flow.flowType === 'AUTHENTICATION' ||
        flow.flowType === 'AUTHORIZATION' ||
        flow.flowType === 'TRANSACTION';

      if (isSensitiveFlow && !hasErrorHandling && stepCount >= 3) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'UNHANDLED_ERROR_PATH',
            severity: 'HIGH',
            value: flow.name,
            normalizedValue: 80,
            description: `Sensitive flow "${flow.name}" lacks explicit error-handling or fallback steps.`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'BEHAVIOR_FLOW',
                sourceId: flow.flowId,
                evidenceType: 'MISSING_ERROR_STEP',
                description: `No ERROR_HANDLING step found in ${flow.flowType} flow.`,
                confidence: 0.85
              })
            ],
            source: this.id,
            confidence: 0.85
          })
        );
      }

      // Unterminated flow: last step is neither an exit, response, nor complete action
      if (flow.steps && flow.steps.length > 0) {
        const lastStep = flow.steps[flow.steps.length - 1];
        if (
          lastStep.stepType === 'PROCESSING' ||
          lastStep.stepType === 'DISPATCH' ||
          lastStep.stepType === 'INVOCATION'
        ) {
          const meta = (flow as unknown as { metadata?: Record<string, unknown> }).metadata || {};
          if (meta.isUnterminated === true) {
            signals.push(
              HealthSignalHelper.createSignal({
                featureId,
                signalType: 'UNTERMINATED_FLOW',
                severity: 'MEDIUM',
                value: flow.flowId,
                normalizedValue: 60,
                description: `Flow "${flow.name}" ends abruptly without return, response, or terminal state.`,
                evidence: [
                  HealthSignalHelper.createEvidence({
                    sourceType: 'BEHAVIOR_FLOW',
                    sourceId: flow.flowId,
                    evidenceType: 'UNTERMINATED_FLOW_STEP',
                    description: `Last step ${lastStep.stepId} is non-terminal.`,
                    confidence: 0.8
                  })
                ],
                source: this.id,
                confidence: 0.8
              })
            );
          }
        }
      }
    }

    return signals;
  }
}
