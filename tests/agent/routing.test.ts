import { describe, it, expect } from 'vitest';
import { AgentOperationRouter } from '../../src/agent/runtime/AgentOperationRouter.js';
import { AgentOperationError } from '../../src/agent/errors/AgentOperationError.js';
import type { IAgentOperationHandler } from '../../src/agent/interfaces/IAgentOperationHandler.js';
import { createTestRequest } from './AgentTestHelper.js';

describe('AgentOperationRouter', () => {
  it('registers handlers and routes requests correctly', async () => {
    const router = new AgentOperationRouter();

    const mockHandler: IAgentOperationHandler<{ num: number }, { result: number }> = {
      operation: 'GET_CONTEXT',
      requiredCapabilities: ['CONTEXT_REQUEST'],
      handle: async (req) => ({ result: (req.payload?.num ?? 0) * 2 }),
    };

    router.registerHandler(mockHandler);
    expect(router.getHandler('GET_CONTEXT')).toBe(mockHandler);

    const request = createTestRequest('GET_CONTEXT', { num: 21 });
    const response = await router.route(request);

    expect(response).toEqual({ result: 42 });
  });

  it('throws AgentOperationError when routing to unregistered operation', async () => {
    const router = new AgentOperationRouter();
    const request = createTestRequest('GET_HEALTH', {});

    await expect(router.route(request)).rejects.toThrow(AgentOperationError);
  });
});
