import type { FeatureId } from '../../models/FeatureId';
import type { FeatureBehaviorEvidence } from './FeatureBehaviorEvidence';
import type { FeatureFlowDirection } from './FeatureFlowDirection';
import type { FeatureFlowEdge } from './FeatureFlowEdge';
import type { FeatureFlowNode } from './FeatureFlowNode';
import type { FeatureFlowType } from './FeatureFlowType';

export interface FeatureFlow {
  flowId: string;
  featureId: FeatureId;
  name: string;
  description?: string;
  flowType: FeatureFlowType;
  direction: FeatureFlowDirection;
  nodes: FeatureFlowNode[];
  edges: FeatureFlowEdge[];
  steps?: any[];
  entryNodeId?: string;
  exitNodeIds: string[];
  confidence: number;
  evidence: FeatureBehaviorEvidence[];
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}
