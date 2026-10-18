import { EvidencePackage } from './EvidencePackageBuilder.js';
import { SLMGateway } from '../../slm/core/SLMGateway.js';
import { SLMRequest } from '../../slm/models/SLMRequest.js';
import { SLMTaskType } from '../../slm/models/SLMTaskType.js';

export class SLMRecommendationEngine {
  constructor(private gateway: SLMGateway) {}

  public async getRecommendation(evidence: EvidencePackage, taskType: SLMTaskType): Promise<Record<string, number>> {
    
    const request: SLMRequest = {
       requestId: `req_${Date.now()}`,
       taskType: taskType,
       promptVersion: 'fusion.v1',
       taskDescription: evidence.taskId, // Simplified for mock
       intentType: evidence.intent,
       repositoryId: 'local',
       snapshotId: 'latest',
       candidateFeatures: [],
       candidateEntities: evidence.candidates,
       maxTokens: 1000,
       temperature: 0.2
    };

    const prediction = await this.gateway.getPrediction(request);
    
    // Convert prediction array back to a scoring map (1.0 for recommended, 0.0 for others)
    const slmScores: Record<string, number> = {};
    for (const c of evidence.candidates) {
       slmScores[c] = prediction.recommendedContext.includes(c) ? 1.0 : 0.0;
    }

    return slmScores;
  }
}
