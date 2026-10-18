import type {
  ITaskDependencyResolver,
  DependencyAnalysisResult,
} from '../interfaces/ITaskDependencyResolver.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';

export class TaskDependencyResolver implements ITaskDependencyResolver {
  public detectCycles(nodes: readonly TaskPlanNode[]): readonly (readonly string[])[] {
    const adj = new Map<string, string[]>();
    for (const node of nodes) {
      const deps = node.dependencies.map((d) => d.targetNodeId);
      adj.set(node.id, deps);
    }

    const cycles: string[][] = [];
    const state = new Map<string, number>(); // 0: unvisited, 1: visiting, 2: visited

    for (const node of nodes) {
      state.set(node.id, 0);
    }

    const dfs = (u: string, path: string[]) => {
      state.set(u, 1);
      path.push(u);

      const neighbors = adj.get(u) ?? [];
      for (const v of neighbors) {
        if (!state.has(v)) {
          continue;
        }

        if (state.get(v) === 1) {
          // Cycle found!
          const cycleStartIndex = path.indexOf(v);
          if (cycleStartIndex >= 0) {
            const cycle = [...path.slice(cycleStartIndex), v];
            cycles.push(cycle);
          }
        } else if (state.get(v) === 0) {
          dfs(v, path);
        }
      }

      path.pop();
      state.set(u, 2);
    };

    for (const node of nodes) {
      if (state.get(node.id) === 0) {
        dfs(node.id, []);
      }
    }

    return cycles;
  }

  public detectCycle(nodes: readonly TaskPlanNode[]): { hasCycle: boolean; cyclePath: string[] } {
    const cycles = this.detectCycles(nodes);
    if (cycles.length > 0) {
      return { hasCycle: true, cyclePath: [...cycles[0]!] };
    }
    return { hasCycle: false, cyclePath: [] };
  }

  public analyzeDependencies(nodes: readonly TaskPlanNode[]): DependencyAnalysisResult {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const inDegree = new Map<string, number>();
    const dependentsMap = new Map<string, string[]>();

    for (const id of nodeIds) {
      inDegree.set(id, 0);
      dependentsMap.set(id, []);
    }

    for (const node of nodes) {
      const validDeps = node.dependencies.filter((d) => nodeIds.has(d.targetNodeId));
      inDegree.set(node.id, validDeps.length);

      for (const dep of validDeps) {
        const list = dependentsMap.get(dep.targetNodeId) ?? [];
        list.push(node.id);
        dependentsMap.set(dep.targetNodeId, list);
      }
    }

    const rootNodeIds: string[] = [];
    const leafNodeIds: string[] = [];

    for (const node of nodes) {
      if ((inDegree.get(node.id) ?? 0) === 0) {
        rootNodeIds.push(node.id);
      }
      if ((dependentsMap.get(node.id) ?? []).length === 0) {
        leafNodeIds.push(node.id);
      }
    }

    // Topological Sort (Kahn's Algorithm)
    const queue = [...rootNodeIds];
    const executionOrder: string[] = [];
    const inDegreeCopy = new Map(inDegree);

    while (queue.length > 0) {
      const u = queue.shift()!;
      executionOrder.push(u);

      const dependents = dependentsMap.get(u) ?? [];
      for (const v of dependents) {
        const cur = (inDegreeCopy.get(v) ?? 1) - 1;
        inDegreeCopy.set(v, cur);
        if (cur === 0) {
          queue.push(v);
        }
      }
    }

    // Critical Path
    const criticalPathNodeIds = this.calculateCriticalPath(nodes, rootNodeIds, dependentsMap);
    const cycles = this.detectCycles(nodes);

    return {
      rootNodeIds,
      leafNodeIds,
      executionOrder,
      cycles,
      criticalPathNodeIds,
    };
  }

  public topologicalSort(nodes: readonly TaskPlanNode[]): TaskPlanNode[] {
    const cycleInfo = this.detectCycle(nodes);
    if (cycleInfo.hasCycle) {
      throw new Error(`Cycle detected: ${cycleInfo.cyclePath.join(' -> ')}`);
    }
    const analysis = this.analyzeDependencies(nodes);
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    return analysis.executionOrder.map((id) => nodeMap.get(id)!).filter(Boolean);
  }

  public getCriticalPath(nodes: readonly TaskPlanNode[]): string[] {
    const analysis = this.analyzeDependencies(nodes);
    return [...analysis.criticalPathNodeIds];
  }

  private calculateCriticalPath(
    nodes: readonly TaskPlanNode[],
    rootNodeIds: readonly string[],
    dependentsMap: Map<string, string[]>
  ): string[] {
    const nodeWeights = new Map<string, number>();
    for (const n of nodes) {
      nodeWeights.set(n.id, n.estimatedDurationMinutes ?? 1);
    }

    const memo = new Map<string, number>();
    const prev = new Map<string, string | null>();

    const getLongest = (u: string): number => {
      if (memo.has(u)) return memo.get(u)!;
      const uWeight = nodeWeights.get(u) ?? 1;
      let maxChildDist = 0;
      let bestNext: string | null = null;

      for (const v of dependentsMap.get(u) ?? []) {
        const d = getLongest(v);
        if (d > maxChildDist) {
          maxChildDist = d;
          bestNext = v;
        }
      }

      if (bestNext) {
        prev.set(u, bestNext);
      }

      const total = uWeight + maxChildDist;
      memo.set(u, total);
      return total;
    };

    let globalMax = 0;
    let bestRoot: string | null = null;
    for (const r of rootNodeIds) {
      const d = getLongest(r);
      if (d > globalMax) {
        globalMax = d;
        bestRoot = r;
      }
    }

    if (!bestRoot) return [];

    const path: string[] = [];
    let cur: string | null = bestRoot;
    while (cur) {
      path.push(cur);
      cur = prev.get(cur) ?? null;
    }

    return path;
  }

  public getParallelizableNodes(
    nodes: readonly TaskPlanNode[],
    candidateNodeIds?: readonly string[]
  ): readonly (readonly TaskPlanNode[])[] {
    const nodeMap = new Map<string, TaskPlanNode>();
    for (const n of nodes) {
      nodeMap.set(n.id, n);
    }

    const candidateIds = candidateNodeIds ?? nodes.map((n) => n.id);
    const parallelGroups: TaskPlanNode[][] = [];
    const remaining = new Set(candidateIds);
    const completedIds = new Set<string>();

    // Mark nodes not in candidate set as completed for dependency checks
    for (const n of nodes) {
      if (!remaining.has(n.id)) {
        completedIds.add(n.id);
      }
    }

    while (remaining.size > 0) {
      const currentGroup: TaskPlanNode[] = [];
      const currentGroupResources = new Set<string>();

      for (const id of Array.from(remaining)) {
        const node = nodeMap.get(id);
        if (!node) {
          remaining.delete(id);
          continue;
        }

        const deps = node.dependencies.map((d) => d.targetNodeId);
        const depsSatisfied = deps.every((depId) => completedIds.has(depId));

        if (depsSatisfied) {
          // Check for resource conflict with nodes already in current group
          const nodeResources = node.affectedResources ?? [];
          const hasConflict = nodeResources.some((r) => currentGroupResources.has(r));

          if (!hasConflict) {
            currentGroup.push(node);
            for (const r of nodeResources) {
              currentGroupResources.add(r);
            }
            remaining.delete(id);
          }
        }
      }

      if (currentGroup.length === 0) {
        // Fallback: pick the first remaining node to guarantee progress
        const firstId = Array.from(remaining)[0];
        if (firstId) {
          const firstNode = nodeMap.get(firstId);
          if (firstNode) {
            currentGroup.push(firstNode);
          }
          remaining.delete(firstId);
        }
      }

      for (const node of currentGroup) {
        completedIds.add(node.id);
      }
      parallelGroups.push(currentGroup);
    }

    return parallelGroups;
  }
}
