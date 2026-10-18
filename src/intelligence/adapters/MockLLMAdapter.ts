import { LLMAdapter } from './LLMAdapter';
import { ConfidenceLevel } from '../models/SemanticModels';

/**
 * A mock adapter used exclusively for deterministic testing and CI/CD.
 */
export class MockLLMAdapter implements LLMAdapter {
  public readonly isMock: boolean = true;
  private mockResponses: Map<string, any> = new Map();

  /**
   * Inject a mock response for a specific prompt pattern.
   */
  public setMockResponse(promptKeyword: string, response: any): void {
    this.mockResponses.set(promptKeyword, response);
  }

  public async generateStructured<T>(systemPrompt: string, userPrompt: string, schemaName?: string): Promise<T> {
    for (const [keyword, response] of Array.from(this.mockResponses.entries())) {
      if (userPrompt.includes(keyword) || systemPrompt.includes(keyword)) {
        return response as T;
      }
    }
    
    // Default fallback mock
    return {
      type: 'Unknown',
      summary: 'Mock inference fallback.',
      confidence: ConfidenceLevel.LOW,
      reasoning: 'No mock response matched.'
    } as unknown as T;
  }

  public async generateText(systemPrompt: string, userPrompt: string): Promise<string> {
    for (const [keyword, response] of Array.from(this.mockResponses.entries())) {
      if (userPrompt.includes(keyword) || systemPrompt.includes(keyword)) {
        return response as string;
      }
    }
    return 'Mock text fallback.';
  }
}
