import { describe, it, expect, vi } from 'vitest';
import { TaskUnderstandingEngine } from '../../src/context/task/TaskUnderstandingEngine.js';
import type { IContextSemanticModel, TaskInterpretationResult } from '../../src/context/task/IContextSemanticModel.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Phase 9.3 - Semantic Model Resilience & Safe Fallback', () => {
  const mockRequest: ContextRequest = {
    workspaceId: 'ws_test',
    projectId: 'proj_main',
    repositoryId: 'repo_backend',
    taskText: 'Add rate limiting to authentication endpoints',
  };

  it('uses deterministic rules when no semantic model is provided', async () => {
    const engine = new TaskUnderstandingEngine();
    const task = await engine.understandTask(mockRequest);

    expect(task.provenance).toBe('DETERMINISTIC_RULES');
    expect(task.taskType).toBe('IMPLEMENTATION');
    expect(task.intent).toBe('ADD');
    expect(task.candidateFeatures).toContain('authentication');
    expect(task.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('safely falls back to deterministic rules when AI model throws error or times out', async () => {
    const failingModel: IContextSemanticModel = {
      interpretTask: vi.fn().mockRejectedValue(new Error('AI provider connection timeout')),
    };

    const engine = new TaskUnderstandingEngine(failingModel);
    const task = await engine.understandTask(mockRequest);

    // Fallback succeeds deterministically
    expect(task.provenance).toBe('DETERMINISTIC_FALLBACK');
    expect(task.taskType).toBe('IMPLEMENTATION');
    expect(task.intent).toBe('ADD');
    expect(failingModel.interpretTask).toHaveBeenCalled();
  });

  it('bounds and tags low-confidence AI output', async () => {
    const lowConfidenceModel: IContextSemanticModel = {
      interpretTask: vi.fn().mockResolvedValue({
        taskType: 'EXPLANATION',
        intent: 'EXPLAIN',
        targetEntities: [],
        candidateFeatures: ['auth'],
        candidateResources: [],
        requestedAction: 'Explain rate limiting',
        constraints: [],
        confidence: 0.2, // very low confidence
        provenance: 'AI_MODEL',
      } as TaskInterpretationResult),
    };

    const engine = new TaskUnderstandingEngine(lowConfidenceModel);
    const task = await engine.understandTask(mockRequest);

    expect(task.provenance).toBe('AI_MODEL');
    expect(task.confidence).toBe(0.2);
    expect(task.constraints).toEqual([]);
  });

  it('sanitizes inferred constraints from AI models and caps their confidence', async () => {
    const modelWithInferredConstraints: IContextSemanticModel = {
      interpretTask: vi.fn().mockResolvedValue({
        taskType: 'IMPLEMENTATION',
        intent: 'ADD',
        targetEntities: ['RateLimiter'],
        candidateFeatures: ['auth'],
        requestedAction: 'Add rate limiting',
        constraints: [
          {
            type: 'INFERRED_CONSTRAINT',
            description: 'AI guesses database must not change',
            confidence: 0.99, // Overconfident AI guess
            source: 'ai_model',
          },
          {
            type: 'EXPLICIT_CONSTRAINT',
            description: 'Explicitly requested in task',
            confidence: 0.95,
            source: 'user_prompt',
          },
        ],
        confidence: 0.85,
        provenance: 'AI_MODEL',
      } as TaskInterpretationResult),
    };

    const engine = new TaskUnderstandingEngine(modelWithInferredConstraints);
    const task = await engine.understandTask(mockRequest);

    const inferred = task.constraints.find((c) => c.type === 'INFERRED_CONSTRAINT');
    expect(inferred).toBeDefined();
    // Rule: Inferred constraints must carry lower confidence (capped at 0.70)
    expect(inferred!.confidence).toBeLessThanOrEqual(0.70);

    const explicit = task.constraints.find((c) => c.type === 'EXPLICIT_CONSTRAINT');
    expect(explicit).toBeDefined();
    expect(explicit!.confidence).toBe(0.95);
  });

  it('falls back to deterministic rules if AI returns unknown or invalid taskType', async () => {
    const invalidOutputModel: IContextSemanticModel = {
      interpretTask: vi.fn().mockResolvedValue({
        taskType: 'INVALID_NONSENSE_TYPE' as any,
        intent: 'UNKNOWN',
        targetEntities: [],
        candidateFeatures: [],
        candidateResources: [],
        requestedAction: '',
        constraints: [],
        confidence: 0.5,
        provenance: 'AI_MODEL',
      }),
    };

    const engine = new TaskUnderstandingEngine(invalidOutputModel);
    const task = await engine.understandTask(mockRequest);

    // Invalid taskType should be sanitized or fallen back
    expect(task.taskType).toBe('IMPLEMENTATION');
  });
});
