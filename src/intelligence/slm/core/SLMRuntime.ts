import { ISLMProvider } from '../providers/ISLMProvider';
import { SLMRequest } from '../models/SLMRequest';
import { SLMResponse } from '../models/SLMResponse';
import { SLMConfig } from '../models/SLMConfig';
import { SLMConfigurationError } from '../errors/SLMConfigurationError';

export class SLMRuntime {
  constructor(private provider: ISLMProvider, private config: SLMConfig) {}

  public async generate(request: SLMRequest): Promise<SLMResponse> {
    const capabilities = await this.provider.getCapabilities();

    // Mock Context Window Check
    const estimatedTokens = ((request.userInput?.length || 0) + (request.systemInstructions?.length || 0)) / 4;
    
    if (estimatedTokens > capabilities.contextWindow) {
      throw new SLMConfigurationError(`CONTEXT_TOO_LARGE: Request requires ~${estimatedTokens} tokens, but model context window is ${capabilities.contextWindow}`);
    }

    return this.provider.generate(request);
  }
}
