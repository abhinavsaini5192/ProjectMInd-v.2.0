import type { ContextCandidate, ContextCandidateType } from '../models/ContextCandidate.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IVerificationQueryService } from '../../verification/interfaces/IVerificationQueryService.js';
import type { IVerificationStore } from '../../verification/interfaces/IVerificationStore.js';
import type { IProjectMemoryStore } from '../../memory/project/interfaces/IProjectMemoryStore.js';
import type { IRetrievalEngine } from '../../retrieval/interfaces/IRetrievalEngine.js';

export class ContextCandidateResolver {
  constructor(
    private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined,
    private readonly verificationService?: IVerificationQueryService | IVerificationStore | undefined,
    private readonly memoryStore?: IProjectMemoryStore | undefined,
    private readonly retrievalEngine?: IRetrievalEngine | undefined
  ) {}

  public async resolveCandidates(
    task: TaskUnderstanding,
    request: ContextRequest,
    targetFeatureIds: readonly string[] = []
  ): Promise<ContextCandidate[]> {
    const candidates: ContextCandidate[] = [];
    const seenIds = new Set<string>();

    const addCandidate = (
      id: string,
      type: ContextCandidateType,
      name: string,
      path: string | undefined,
      evidence: string,
      metadata?: Record<string, unknown>,
      estimatedTokens: number = 80
    ) => {
      const key = `${type}:${id}`;
      if (seenIds.has(key)) return;
      seenIds.add(key);

      candidates.push({
        candidateId: id,
        candidateType: type,
        name,
        path,
        score: 0.5, // Will be scored by RelevanceEngine
        priority: 'MEDIUM',
        dimensions: {
          taskRelevance: 0.5,
          featureRelevance: 0.5,
          architecturalRelevance: 0.5,
          dependencyRelevance: 0.5,
          behavioralRelevance: 0.5,
          changeRelevance: 0.5,
          historyRelevance: 0.5,
          riskRelevance: 0.5,
          verificationRelevance: 0.5,
          recency: 0.5,
          confidence: 0.8,
          scopeRelevance: 1.0,
        },
        primaryEvidence: evidence,
        estimatedTokens,
        metadata,
      });
    };

    // 1. Target Features
    const safeFeatureIds = Array.isArray(targetFeatureIds) ? targetFeatureIds : [];
    for (const featId of safeFeatureIds) {
      addCandidate(
        featId,
        'FEATURE',
        featId,
        undefined,
        `Direct feature target identified from task understanding`,
        { featureId: featId },
        60
      );

      // Fetch knowledge from API if available
      if (this.featureKnowledgeApi) {
        try {
          const profileResp = await this.featureKnowledgeApi.getFeatureProfile(featId);
          const profile = profileResp?.profile;
          if (profile) {
            // Mappings / Files
            const mappings = profile.mappings?.data?.mappings ?? [];
            for (const map of mappings) {
              const resPath = (map.metadata?.filePath as string | undefined) ?? (map.metadata?.path as string | undefined) ?? map.resourceId;
              addCandidate(
                map.resourceId ?? resPath,
                'FILE',
                resPath,
                resPath,
                `Primary source implementation of feature '${featId}'`,
                {
                  featureId: featId,
                  role: map.role,
                  isDirectImplementation: map.role === 'PRIMARY',
                },
                180
              );
            }

            // Dependencies
            const dependencies = profile.dependencies?.data?.dependencies ?? [];
            for (const dep of dependencies) {
              const depId = dep.featureId;
              addCandidate(
                depId,
                'DEPENDENCY',
                depId,
                undefined,
                `Architectural dependency required by feature '${featId}'`,
                { sourceFeature: featId, type: dep.relationshipType },
                70
              );
            }

            // Behaviors
            const flows = profile.behavior?.data?.primaryFlows ?? [];
            for (const flow of flows) {
              addCandidate(
                flow.flowId ?? flow.name,
                'BEHAVIOR_STEP',
                flow.name,
                undefined,
                `Runtime execution flow participating in '${featId}'`,
                { stepsCount: flow.stepsCount },
                120
              );
            }

            // Health & Active Risks
            const risks = profile.health?.data?.risks ?? [];
            for (const risk of risks) {
              addCandidate(
                risk.riskId ?? `risk_${featId}`,
                'RISK',
                risk.type ?? 'Feature Risk',
                undefined,
                `Active risk signal for feature '${featId}': ${risk.description}`,
                { severity: risk.severity },
                50
              );
            }

            // History & Milestones
            const milestones = profile.history?.data?.milestones ?? [];
            for (const item of milestones) {
              addCandidate(
                item.milestoneId ?? `hist_${Date.now()}`,
                'HISTORY_EVENT',
                item.title,
                undefined,
                `Recent architectural milestone or regression history for '${featId}'`,
                { importance: item.importance, timestamp: item.timestamp },
                60
              );
            }
          }
        } catch {
          // Gracefully continue with base candidate
        }
      }
    }

    // 2. Explicit Resources in Request
    for (const resId of request.resourceIds ?? []) {
      addCandidate(
        resId,
        'FILE',
        resId,
        resId,
        `Explicitly requested resource in context request`,
        {},
        150
      );
    }

    // 3. Changed Resources (Recent Delta)
    for (const changed of request.changedResources ?? []) {
      addCandidate(
        changed,
        'FILE',
        changed,
        changed,
        `Recently modified file in current working tree`,
        { isChanged: true },
        150
      );
    }

    // 4. Verification Failures (if verification service is available and task relates to bug/debugging)
    if (
      this.verificationService &&
      (task.taskType === 'BUG_FIX' || task.taskType === 'DEBUGGING' || task.taskType === 'TESTING')
    ) {
      try {
        const records = (this.verificationService as any).listRecords
          ? await (this.verificationService as any).listRecords({ status: 'FAILED' })
          : [];

        for (const rec of (records ?? []).slice(0, 5)) {
          addCandidate(
            rec.recordId,
            'TEST',
            rec.testName ?? rec.name ?? 'Failed Verification',
            rec.testPath,
            `Failed verification test relevant to ${task.taskType.toLowerCase()}: ${rec.failureReason ?? rec.error}`,
            { failureDetails: rec.failureReason },
            90
          );
        }
      } catch {
        // Safe continuation
      }
    }

    // 5. Project Memory Candidates (Decisions, Architecture, Migrations)
    if (this.memoryStore) {
      try {
        const memories = await this.memoryStore.find({
          repositoryId: request.repositoryId,
          workspaceId: request.workspaceId,
          projectId: request.projectId ?? request.projectContext?.projectId,
          status: ['ACTIVE'],
        });

        const taskWords = task.normalizedRequest.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
        for (const mem of memories) {
          const memLower = `${mem.title} ${mem.content}`.toLowerCase();
          const matches = taskWords.some((w) => memLower.includes(w));
          const relatesToTargetFeature = targetFeatureIds.some((f) => mem.relatedFeatures.includes(f));

          if (matches || relatesToTargetFeature) {
            addCandidate(
              mem.memoryId,
              'PROJECT_MEMORY_REFERENCE',
              mem.title,
              undefined,
              `Durable project memory (${mem.type}): ${mem.content.slice(0, 150)}`,
              {
                memoryId: mem.memoryId,
                type: mem.type,
                provenance: mem.provenance,
                authority: mem.authority,
              },
              100
            );
          }
        }
      } catch {
        // Safe continuation
      }
    }

    // 6. Semantic Retrieval Candidates (if retrieval engine is available)
    if (this.retrievalEngine) {
      try {
        const semResults = await this.retrievalEngine.retrieve({
          queryId: `ctx_ret_${Date.now()}`,
          workspaceId: request.workspaceId,
          projectId: request.projectId ?? request.projectContext?.projectId,
          repositoryId: request.repositoryId,
          text: task.normalizedRequest,
          queryType: 'TASK',
          taskIntent: task.intent,
          filters: { limit: 5, minScore: 0.2 },
          timestamp: Date.now(),
        });

        for (const res of semResults) {
          if (res.source === 'SEMANTIC_INDEX') {
            addCandidate(
              res.resourceId,
              'FILE',
              res.name,
              res.contentReference ?? res.name,
              res.evidence.join('; '),
              {
                source: res.source,
                authority: res.authority,
                similarity: res.score,
              },
              120
            );
          }
        }
      } catch {
        // Safe continuation
      }
    }

    return candidates;
  }
}
