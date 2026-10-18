import { describe, it, expect } from 'vitest';
import { BehaviorTestHelper } from './BehaviorTestHelper';
import type { FeatureRelationship } from '../../../../src/knowledge/features/dependencies/models/FeatureRelationship';

describe('Phase 6.5: Cross-Feature Architectural Boundaries', () => {
  it('should detect when execution crosses feature boundaries and annotate boundary metadata', async () => {
    const checkoutFeature = BehaviorTestHelper.createFeature('feat_checkout', 'Checkout');
    const paymentFeature = BehaviorTestHelper.createFeature('feat_payment', 'Payment');

    const checkoutMappings = [
      BehaviorTestHelper.createMapping('feat_checkout', 'CheckoutController.checkout', 'SYMBOL', 'CONTROLLER'),
      BehaviorTestHelper.createMapping('feat_checkout', 'CheckoutService.process', 'SYMBOL', 'SERVICE'),
      BehaviorTestHelper.createMapping('feat_checkout', 'PaymentService.charge', 'SYMBOL', 'SERVICE'),
    ];

    const paymentMappings = [
      BehaviorTestHelper.createMapping('feat_payment', 'PaymentService.charge', 'SYMBOL', 'SERVICE'),
      BehaviorTestHelper.createMapping('feat_payment', 'StripeClient', 'DEPENDENCY', 'DEPENDENCY'),
    ];

    const allMappings = new Map([
      ['feat_checkout', checkoutMappings],
      ['feat_payment', paymentMappings],
    ]);

    const relationships: FeatureRelationship[] = [
      {
        relationshipId: 'rel_checkout_payment',
        sourceFeatureId: 'feat_checkout',
        targetFeatureId: 'feat_payment',
        relationshipType: 'DEPENDS_ON',
        direction: 'DIRECTED',
        confidence: { level: 'HIGH', score: 0.9, reasons: ['PaymentService call'] },
        score: 0.9,
        evidence: [
          {
            evidenceId: 'ev_call',
            sourceType: 'CODE',
            sourceId: 'PaymentService.charge',
            evidenceType: 'METHOD_INVOCATION',
            description: 'Checkout calls PaymentService.charge',
            strength: 0.9,
            confidence: 0.9,
            metadata: {},
            timestamp: Date.now(),
          },
        ],
        source: 'DISCOVERED',
        scope: { workspaceId: 'ws_test', repositoryId: 'repo_test' },
        knowledgeVersion: '1.0.0',
        relationshipVersion: 1,
        active: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    const context = BehaviorTestHelper.createContext(checkoutFeature, checkoutMappings, {
      allFeatures: [checkoutFeature, paymentFeature],
      allMappings,
      relationships,
    });

    const { engine } = BehaviorTestHelper.createEngine();
    const result = await engine.analyzeFeatureBehavior('feat_checkout', context);

    expect(result.behaviors.length).toBe(1);
    const behavior = result.behaviors[0];

    // Verify boundary node is tagged
    const boundaryNode = behavior.flows
      .flatMap(f => f.nodes)
      .find(n => n.resourceId === 'PaymentService.charge');

    expect(boundaryNode).toBeDefined();
    expect(boundaryNode?.metadata?.featureBoundary).toBe(true);
    expect(boundaryNode?.metadata?.targetFeatureId).toBe('feat_payment');
  });
});
