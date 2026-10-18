import type { TaskPlanNode } from '../models/TaskPlanNode.js';

export interface DependencyAnalysisResult {
  readonly rootNodeIds: readonly string[];
  readonly leafNodeIds: readonly string[];
  readonly executionOrder: readonly string[];
  readonly cycles: readonly (readonly string[])[];
  readonly criticalPathNodeIds: readonly string[];
}

export interface ITaskDependencyResolver {
  analyzeDependencies(nodes: readonly TaskPlanNode[]): DependencyAnalysisResult;
  detectCycles(nodes: readonly TaskPlanNode[]): readonly (readonly string[])[];
  getParallelizableNodes(nodes: readonly TaskPlanNode[], candidateNodeIds?: readonly string[]): readonly (readonly TaskPlanNode[])[];
}
