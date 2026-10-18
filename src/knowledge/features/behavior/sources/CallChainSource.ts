import type { BehaviorContext, IFeatureBehaviorSource } from '../interfaces/IFeatureBehaviorSource';
import type { FeatureBehaviorCandidate } from '../models/FeatureBehaviorCandidate';
import type { FeatureFlowEdge } from '../models/FeatureFlowEdge';
import type { FeatureFlowNode } from '../models/FeatureFlowNode';
import type { FeatureFlowStep } from '../models/FeatureFlowStep';
import { BehaviorSourceHelper } from './BehaviorSourceHelper';

export class CallChainSource implements IFeatureBehaviorSource {
  public readonly sourceId = 'CALL_CHAIN_SOURCE';
  public readonly sourceType = 'CODE_STRUCTURE';
  public readonly priority = 90;

  public async extractBehavior(context: BehaviorContext): Promise<FeatureBehaviorCandidate[]> {
    const candidates: FeatureBehaviorCandidate[] = [];
    const featureId = context.feature.id;

    const symbolMappings = BehaviorSourceHelper.getMappedResourcesByType(context.mappings, 'SYMBOL');
    if (symbolMappings.length === 0 && (!context.extraction?.symbols || context.extraction.symbols.length === 0)) {
      return candidates;
    }

    // Classify symbols into steps
    const classifiedNodes: FeatureFlowNode[] = [];
    for (const m of symbolMappings) {
      const stepType = this.inferStepType(m.resourceId, m.metadata);
      const boundary = BehaviorSourceHelper.resolveFeatureBoundary(m.resourceId, featureId, context);

      const node = BehaviorSourceHelper.createNode(
        m.resourceId,
        'SYMBOL',
        stepType,
        m.resourceId,
        {
          featureBoundary: boundary.isBoundary,
          targetFeatureId: boundary.targetFeatureId,
          role: m.role,
        },
        m.score ?? 0.85
      );
      classifiedNodes.push(node);
    }

    // If explicit call chains exist in extraction
    if (context.extraction?.symbols) {
      for (const sym of context.extraction.symbols) {
        if (sym.calls && Array.isArray(sym.calls)) {
          const sourceNode = classifiedNodes.find(n => n.resourceId === sym.id || n.resourceId === sym.name);
          if (sourceNode) {
            for (const targetCall of sym.calls) {
              const targetNode = classifiedNodes.find(
                n => n.resourceId === targetCall.id || n.resourceId === targetCall.name
              );
              if (targetNode && sourceNode.nodeId !== targetNode.nodeId) {
                const boundary = BehaviorSourceHelper.resolveFeatureBoundary(targetNode.resourceId, featureId, context);
                const ev = BehaviorSourceHelper.createEvidence(
                  this.sourceType,
                  this.sourceId,
                  'SYMBOL_INVOCATION',
                  `Invocation from ${sourceNode.label} to ${targetNode.label}`,
                  0.88
                );
                const edge = BehaviorSourceHelper.createEdge(
                  sourceNode.nodeId,
                  targetNode.nodeId,
                  targetCall.isAsync ? 'AWAIT' : 'CALLS',
                  !!targetCall.isAsync,
                  undefined,
                  0.88,
                  [ev],
                  {
                    featureBoundary: boundary.isBoundary,
                    targetFeatureId: boundary.targetFeatureId,
                  }
                );

                candidates.push(
                  BehaviorSourceHelper.createCandidate(
                    featureId,
                    `Call: ${sourceNode.label} -> ${targetNode.label}`,
                    'PRIMARY',
                    [sourceNode, targetNode],
                    [edge],
                    [ev],
                    this.sourceId,
                    0.88
                  )
                );
              }
            }
          }
        }
      }
    }

    // If we have mapped symbols from distinct architectural tiers, form a synthetic call chain
    if (classifiedNodes.length > 1) {
      const tierOrder: Record<FeatureFlowStep, number> = {
        ENTRY_POINT: 0,
        CONTROLLER: 1,
        HANDLER: 1,
        VALIDATION: 2,
        AUTHORIZATION: 3,
        SERVICE: 4,
        FUNCTION: 5,
        REPOSITORY: 6,
        DATABASE: 7,
        CACHE: 7,
        EVENT: 8,
        QUEUE: 8,
        EXTERNAL_SERVICE: 8,
        TRANSFORMATION: 9,
        CONDITION: 10,
        ERROR_HANDLER: 11,
        RESPONSE: 12,
        EXIT: 13,
      };

      const sorted = [...classifiedNodes].sort((a, b) => {
        const orderA = tierOrder[a.stepType] ?? 50;
        const orderB = tierOrder[b.stepType] ?? 50;
        return orderA - orderB;
      });

      const edges: FeatureFlowEdge[] = [];
      for (let i = 0; i < sorted.length - 1; i++) {
        const src = sorted[i];
        const tgt = sorted[i + 1];
        if (src.stepType !== tgt.stepType || src.nodeId !== tgt.nodeId) {
          const boundary = BehaviorSourceHelper.resolveFeatureBoundary(tgt.resourceId, featureId, context);
          const ev = BehaviorSourceHelper.createEvidence(
            this.sourceType,
            this.sourceId,
            'ARCHITECTURAL_CALL_CHAIN',
            `Sequential invocation from ${src.label} to ${tgt.label}`,
            0.82
          );
          edges.push(
            BehaviorSourceHelper.createEdge(
              src.nodeId,
              tgt.nodeId,
              'CALLS',
              false,
              undefined,
              0.82,
              [ev],
              {
                featureBoundary: boundary.isBoundary,
                targetFeatureId: boundary.targetFeatureId,
              }
            )
          );
        }
      }

      if (edges.length > 0) {
        const ev = BehaviorSourceHelper.createEvidence(
          this.sourceType,
          this.sourceId,
          'CALL_CHAIN_SEQUENCE',
          `Reconstructed call chain sequence of ${sorted.length} steps`,
          0.85
        );
        candidates.push(
          BehaviorSourceHelper.createCandidate(
            featureId,
            `Sequential Call Chain (${sorted[0].label} -> ${sorted[sorted.length - 1].label})`,
            'PRIMARY',
            sorted,
            edges,
            [ev],
            this.sourceId,
            0.85
          )
        );
      }
    }

    return candidates;
  }

  private inferStepType(resourceId: string, metadata?: Record<string, any>): FeatureFlowStep {
    const lower = resourceId.toLowerCase();
    if (metadata?.role === 'CONTROLLER' || lower.includes('controller')) return 'CONTROLLER';
    if (metadata?.role === 'HANDLER' || lower.includes('handler')) return 'HANDLER';
    if (metadata?.role === 'SERVICE' || lower.includes('service') || lower.includes('manager')) return 'SERVICE';
    if (metadata?.role === 'REPOSITORY' || lower.includes('repository') || lower.includes('dao')) return 'REPOSITORY';
    if (lower.includes('validator') || lower.includes('validation') || lower.includes('schema')) return 'VALIDATION';
    if (lower.includes('auth') || lower.includes('guard') || lower.includes('permission')) return 'AUTHORIZATION';
    if (lower.includes('entity') || lower.includes('model') || lower.includes('table')) return 'DATABASE';
    if (lower.includes('cache') || lower.includes('redis')) return 'CACHE';
    return 'FUNCTION';
  }
}
