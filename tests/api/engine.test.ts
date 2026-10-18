import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeGateway } from '../../src/knowledge/api/core/KnowledgeGateway';
import { SecurityResolver } from '../../src/knowledge/api/core/SecurityResolver';
import { FeatureKnowledgeAPI } from '../../src/knowledge/api/v1/domains/DomainAPIs';
import type { KnowledgeRequest } from '../../src/knowledge/api/v1/models/KnowledgeRequest';
import { KnowledgeErrorCode } from '../../src/knowledge/api/v1/types/KnowledgeErrorCodes';
import { QueryEngine } from '../../src/knowledge/query/core/QueryEngine';
import { QueryPlanner } from '../../src/knowledge/query/core/QueryPlanner';
import { QueryExecutor } from '../../src/knowledge/query/core/QueryExecutor';
import { QueryExplainer } from '../../src/knowledge/query/core/QueryExplainer';
import { QueryValidator } from '../../src/knowledge/query/core/QueryValidator';
import { QueryRegistry } from '../../src/knowledge/query/core/QueryRegistry';
import { QueryCache } from '../../src/knowledge/query/cache/QueryCache';
import { FeatureQueryAPI } from '../../src/knowledge/query/api/FeatureQueryAPI';
import { KernelEventDispatcher } from '../../src/kernel/core/KernelEventDispatcher';

describe('Knowledge API v1 Gateway', () => {
  let gateway: KnowledgeGateway;

  beforeEach(() => {
    const security = new SecurityResolver();
    gateway = new KnowledgeGateway(security);

    // Setup mock underlying QueryEngine for testing
    const registry = new QueryRegistry();
    registry.registerHandler('feature', new FeatureQueryAPI());

    const engine = new QueryEngine(
      new QueryPlanner(),
      new QueryExecutor(registry),
      new QueryExplainer(),
      new QueryValidator(),
      new QueryCache(),
      new KernelEventDispatcher(),
      'v1'
    );

    const featureAPI = new FeatureKnowledgeAPI(engine as any);
    gateway.registerDomain('feature', featureAPI);
  });

  it('should successfully route a valid request and return a standard v1 envelope', () => {
    const req: KnowledgeRequest = {
      repositoryId: 'repo_123',
      operation: 'find',
      parameters: { name: 'Authentication' }
    };

    const response = gateway.dispatch('feature', req);

    expect(response.apiVersion).toBe('v1');
    expect(response.repositoryId).toBe('repo_123');
    expect(response.data.feature.name).toBe('Authentication');
    expect(response.sources).toBeDefined();
    expect(response.explanation).toBeDefined();
  });

  it('should enforce repository isolation and block restricted repos', () => {
    const req: KnowledgeRequest = {
      repositoryId: 'restricted_repo',
      operation: 'find',
      parameters: {}
    };

    expect(() => gateway.dispatch('feature', req)).toThrowError(/Access denied/);
    try {
      gateway.dispatch('feature', req);
    } catch (e: any) {
      expect(e.code).toBe(KnowledgeErrorCode.KNOWLEDGE_ACCESS_DENIED);
    }
  });

  it('should throw KNOWLEDGE_INVALID_REQUEST for unknown domains', () => {
    const req: KnowledgeRequest = {
      repositoryId: 'repo_123',
      operation: 'find',
      parameters: {}
    };

    try {
      gateway.dispatch('unknown_domain', req);
      expect(true).toBe(false); // should not reach
    } catch (e: any) {
      expect(e.code).toBe(KnowledgeErrorCode.KNOWLEDGE_INVALID_REQUEST);
    }
  });

  it('should intercept internal security violations and map to KNOWLEDGE_ACCESS_DENIED', () => {
    const req: KnowledgeRequest = {
      repositoryId: 'repo_123',
      operation: 'find',
      parameters: { name: 'secret_key' } // Trips QueryValidator
    };

    try {
      gateway.dispatch('feature', req);
      expect(true).toBe(false);
    } catch (e: any) {
      expect(e.code).toBe(KnowledgeErrorCode.KNOWLEDGE_ACCESS_DENIED);
    }
  });
});
