import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';
import type { TaskPlanNode } from '../../../agent/planning/models/TaskPlanNode.js';

export class PlanningLearningAdapter {
  constructor(private readonly deploymentManager: ILearningDeploymentManager) {}

  public async augmentTaskNodes(
    nodes: readonly TaskPlanNode[],
    objective: string,
    workspaceId: string,
    projectId?: string
  ): Promise<TaskPlanNode[]> {
    const activeLearnings = await this.deploymentManager.getActiveLearnings(workspaceId, projectId);
    const planningLearnings = activeLearnings.filter((l) => l.target.system === 'PLANNING');

    if (planningLearnings.length === 0) {
      return [...nodes];
    }

    const result = [...nodes];
    const objLower = objective.toLowerCase();

    for (const pl of planningLearnings) {
      const pattern = (pl.appliedChange['taskPattern'] ?? '').toLowerCase();
      if (pattern && objLower.includes(pattern)) {
        const recommendation = pl.appliedChange['recommendation'];
        const recommendedStep = pl.appliedChange['recommendedStep'];

        if (recommendation === 'ADD_VALIDATION_STEP' && recommendedStep) {
          // Check if an existing node already matches
          const alreadyExists = result.some((n) =>
            n.title.toLowerCase().includes(recommendedStep.title.toLowerCase())
          );
          if (!alreadyExists && result.length > 0) {
            const lastNode = result[result.length - 1]!;
            const newIndex = result.length + 1;
            const extraNode: TaskPlanNode = {
              id: `step_${newIndex}_learned_validation`,
              planId: lastNode.planId,
              taskId: lastNode.taskId ?? 'task_learned_val',
              title: recommendedStep.title,
              objective: `Execute learned validation recommendation: ${recommendedStep.title}`,
              taskType: (recommendedStep.taskType as any) ?? 'VERIFY',
              status: 'PENDING',
              priority: recommendedStep.priority ?? 8,
              dependencies: [{ targetNodeId: lastNode.id, type: 'DEPENDS_ON' }],
              preferredAgentRole: 'REVIEWER',
              requiredCapabilities: ['verification-testing'],
              affectedResources: lastNode.affectedResources ?? [],
              affectedFeatures: lastNode.affectedFeatures ?? [],
              risk: 'LOW',
              metadata: { learnedFromCandidate: pl.candidateId },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            result.push(extraNode);
          }
        }
      }
    }

    return result;
  }
}
