import { ISLMProvider } from '../interfaces/ISLMProvider.js';
import { SLMRequest } from '../models/SLMRequest.js';
import { SLMPrediction } from '../models/SLMResponse.js';
import { SLMOutputValidator } from './SLMOutputValidator.js';
import { SLMFallbackManager } from './SLMFallbackManager.js';
import { SLMError } from '../models/SLMError.js';

export class SLMGateway {
  constructor(
    private provider: ISLMProvider,
    private validator: SLMOutputValidator,
    private fallbackManager: SLMFallbackManager
  ) {}

  public async getPrediction(request: SLMRequest): Promise<SLMPrediction> {
    try {
      // 1. Check capability
      const caps = this.provider.getCapabilities();
      if (caps.supportedTasks && request.taskType && !caps.supportedTasks.includes(request.taskType)) {
         throw new SLMError('CAPABILITY_MISMATCH', `Provider does not support ${request.taskType}`, request.requestId, caps.provider || 'unknown');
      }

      // 2. We would normally apply PrivacyFilter here to request.taskDescription
      
      // 3. Request Inference
      // A real implementation would wrap this in a timeout promise
      const response = await this.provider.predict(request);

      // 4. Validate output
      this.validator.validate(response);

      // 5. Combine confidences
      // SLM proposes confidence, we dampen it. 
      // (For this mock phase, we just return the prediction directly)
      return response.prediction || this.fallbackManager.getDeterministicFallback(request);

    } catch (error) {
      this.fallbackManager.handleFailure(error, request.requestId);
      return this.fallbackManager.getDeterministicFallback(request);
    }
  }
}
