import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestSetup,
  createTestRequest,
  MockContextOrchestrator,
  MockFeatureKnowledgeAPI,
  MockEventBus,
} from './AgentTestHelper.js';

import { GetContextHandler } from '../../src/agent/handlers/GetContextHandler.js';
import { GetFeatureHandler } from '../../src/agent/handlers/GetFeatureHandler.js';
import { GetFeatureContextHandler } from '../../src/agent/handlers/GetFeatureContextHandler.js';
import { GetImpactHandler } from '../../src/agent/handlers/GetImpactHandler.js';
import { GetArchitectureHandler } from '../../src/agent/handlers/GetArchitectureHandler.js';
import { GetHistoryHandler } from '../../src/agent/handlers/GetHistoryHandler.js';
import { GetHealthHandler } from '../../src/agent/handlers/GetHealthHandler.js';
import { ExplainContextHandler } from '../../src/agent/handlers/ExplainContextHandler.js';
import { RefreshContextHandler } from '../../src/agent/handlers/RefreshContextHandler.js';
import { ReportExecutionHandler } from '../../src/agent/handlers/ReportExecutionHandler.js';
import { ReportVerificationHandler } from '../../src/agent/handlers/ReportVerificationHandler.js';
import { UpdateKnowledgeHandler } from '../../src/agent/handlers/UpdateKnowledgeHandler.js';
import { AgentValidationError } from '../../src/agent/errors/AgentValidationError.js';

describe('Operation Handlers', () => {
  let contextOrchestrator: MockContextOrchestrator;
  let featureKnowledgeApi: MockFeatureKnowledgeAPI;
  let eventBus: MockEventBus;

  beforeEach(() => {
    const setup = createTestSetup();
    contextOrchestrator = setup.contextOrchestrator;
    featureKnowledgeApi = setup.featureKnowledgeApi;
    eventBus = setup.eventBus;
  });

  it('GetContextHandler delegates to contextOrchestrator', async () => {
    const handler = new GetContextHandler(contextOrchestrator);
    const req = createTestRequest('GET_CONTEXT', { taskText: 'Refactor auth' });

    const result = await handler.handle(req);
    expect(result.formattedPrompt).toContain('Task: Refactor auth');
    expect(contextOrchestrator.orchestrateContextCalls.length).toBe(1);
  });

  it('GetFeatureHandler retrieves feature profile or throws on empty id', async () => {
    const handler = new GetFeatureHandler(featureKnowledgeApi);
    const req = createTestRequest('GET_FEATURE', { featureId: 'feat_auth' });

    const result = await handler.handle(req);
    expect(result.profile.featureId).toBe('feat_auth');

    const invalidReq = createTestRequest('GET_FEATURE', { featureId: '' });
    await expect(handler.handle(invalidReq)).rejects.toThrow(AgentValidationError);
  });

  it('GetFeatureContextHandler delegates to getFeatureContextForTask', async () => {
    const handler = new GetFeatureContextHandler(contextOrchestrator);
    const req = createTestRequest('GET_FEATURE_CONTEXT', { featureId: 'feat_billing' });

    const result = await handler.handle(req);
    expect(result).toBeDefined();
    expect(contextOrchestrator.orchestrateContextCalls.length).toBe(1);
    expect(contextOrchestrator.orchestrateContextCalls[0]?.featureIds).toEqual(['feat_billing']);
  });

  it('GetImpactHandler retrieves impact section', async () => {
    const handler = new GetImpactHandler(featureKnowledgeApi);
    const req = createTestRequest('GET_IMPACT', { featureId: 'feat_core' });

    const result = await handler.handle(req);
    expect(result.data?.impactedFeatures[0]?.targetId).toBe('feature_b');
  });

  it('GetArchitectureHandler retrieves architecture section', async () => {
    const handler = new GetArchitectureHandler(featureKnowledgeApi);
    const req = createTestRequest('GET_ARCHITECTURE', { featureId: 'feat_core' });

    const result = await handler.handle(req);
    expect(result.data?.components).toContain('AuthService');
  });

  it('GetHistoryHandler retrieves history section', async () => {
    const handler = new GetHistoryHandler(featureKnowledgeApi);
    const req = createTestRequest('GET_HISTORY', { featureId: 'feat_core' });

    const result = await handler.handle(req);
    expect(result.itemCount).toBe(3);
  });

  it('GetHealthHandler retrieves health section', async () => {
    const handler = new GetHealthHandler(featureKnowledgeApi);
    const req = createTestRequest('GET_HEALTH', { featureId: 'feat_core' });

    const result = await handler.handle(req);
    expect(result.data?.healthStatus).toBe('HEALTHY');
  });

  it('ExplainContextHandler requests context explanation', async () => {
    const handler = new ExplainContextHandler(contextOrchestrator);
    const req = createTestRequest('EXPLAIN_CONTEXT', { taskText: 'Verify security' });

    const result = await handler.handle(req);
    expect(result.taskAnalysisSummary).toBe('Explanation of selected context');
    expect(contextOrchestrator.getExplanationCalls.length).toBe(1);
  });

  it('RefreshContextHandler forces CURRENT freshnessPolicy', async () => {
    const handler = new RefreshContextHandler(contextOrchestrator);
    const req = createTestRequest('REFRESH_CONTEXT', { taskText: 'Check stale state' });

    await handler.handle(req);
    expect(contextOrchestrator.orchestrateContextCalls[0]?.freshnessPolicy).toBe('CURRENT');
  });

  it('ReportExecutionHandler records execution and publishes event', async () => {
    const handler = new ReportExecutionHandler(eventBus);
    const req = createTestRequest('REPORT_EXECUTION', {
      status: 'COMPLETED',
      changedFiles: ['src/agent/runtime/AgentRuntime.ts'],
      summary: 'Updated agent model',
    });

    const result = await handler.handle(req);
    expect(result.recorded).toBe(true);
    expect(result.status).toBe('COMPLETED');
    expect(eventBus.events.some((e) => e.name === 'agent.execution.reported')).toBe(true);
  });

  it('ReportVerificationHandler records verification and publishes event', async () => {
    const handler = new ReportVerificationHandler(eventBus);
    const req = createTestRequest('REPORT_VERIFICATION', {
      passed: true,
      testResults: [{ test: 'unit', passed: true }],
    });

    const result = await handler.handle(req);
    expect(result.recorded).toBe(true);
    expect(result.passed).toBe(true);
    expect(eventBus.events.some((e) => e.name === 'agent.verification.reported')).toBe(true);
  });

  it('UpdateKnowledgeHandler records knowledge update and publishes event', async () => {
    const handler = new UpdateKnowledgeHandler(eventBus);
    const req = createTestRequest('UPDATE_KNOWLEDGE', {
      knowledgeType: 'FEATURE_NOTE',
      payload: { note: 'Feature verified on staging' },
    });

    const result = await handler.handle(req);
    expect(result.recorded).toBe(true);
    expect(result.knowledgeType).toBe('FEATURE_NOTE');
    expect(eventBus.events.some((e) => e.name === 'agent.knowledge.updated')).toBe(true);
  });
});
