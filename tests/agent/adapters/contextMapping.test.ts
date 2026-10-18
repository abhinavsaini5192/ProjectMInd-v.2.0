import { describe, it, expect } from 'vitest';
import { AgentContextMapper } from '../../../src/agent/adapters/core/AgentContextMapper.js';
import type { ContextPackage } from '../../../src/context/models/ContextPackage.js';

describe('AgentContextMapper Unit Tests', () => {
  const mapper = new AgentContextMapper();

  const mockContextPackage: ContextPackage = {
    packageId: 'pkg_123',
    generatedAt: Date.now(),
    task: {
      text: 'Implement login page',
    },
    features: [
      { id: 'feat_auth', name: 'Authentication Feature', description: 'User login and tokens' } as any,
    ],
    resources: [
      { path: 'src/auth/login.ts', uri: 'file:///src/auth/login.ts', type: 'file' } as any,
    ],
    architecture: {
      layer: 'auth',
      dependencies: ['crypto'],
    },
    behavior: [],
    dependencies: [],
    tests: [],
    health: {
      status: 'HEALTHY',
      score: 95,
    },
    impact: {
      severity: 'LOW',
    },
    history: [
      { timestamp: '2026-09-20', summary: 'Added initial auth scaffolding' },
    ],
    warnings: [
      { code: 'WARN_TOKEN', message: 'Token expiry not configured' } as any,
    ],
    selectionReasons: {},
    completeness: {
      level: 'FULL',
      score: 1.0,
      requestedSectionsCount: 4,
      providedSectionsCount: 4,
      missingSections: [],
      missingReasons: {},
    },
    freshness: {
      status: 'CURRENT',
      isStale: false,
      invalidationReasons: [],
    },
    estimatedTokens: 350,
    version: {
      packageVersion: '1.0.0',
      knowledgeVersion: '1.4.2',
      isConsistent: true,
      mismatchedSubsystems: [],
    },
  };

  it('maps ContextPackage into Markdown format preserving structure', () => {
    const result = mapper.mapContext(mockContextPackage, { format: 'markdown' });

    expect(result.format).toBe('MARKDOWN');
    expect(typeof result.content).toBe('string');
    expect(result.content as string).toContain('Repository Context [Package: pkg_123]');
    expect(result.content as string).toContain('Authentication Feature');
    expect(result.content as string).toContain('src/auth/login.ts');
    expect(result.featureIds).toContain('feat_auth');
    expect(result.resourcePaths).toContain('src/auth/login.ts');
    expect(result.freshness).toBe('CURRENT');
    expect(result.completeness).toBe('FULL');
    expect(result.confidence).toBe(1.0);
    expect(result.warnings).toContain('Token expiry not configured');
    expect(result.knowledgeVersion).toBe('1.4.2');
  });

  it('maps ContextPackage into Structured JSON format', () => {
    const result = mapper.mapContext(mockContextPackage, { format: 'json' });

    expect(result.format).toBe('STRUCTURED_JSON');
    expect(typeof result.content).toBe('object');
    const jsonContent = result.content as any;
    expect(jsonContent.packageId).toBe('pkg_123');
    expect(jsonContent.features).toHaveLength(1);
    expect(jsonContent.resources).toHaveLength(1);
  });

  it('maps ContextPackage into XML format with tags', () => {
    const result = mapper.mapContext(mockContextPackage, { format: 'xml' });

    expect(result.format).toBe('XML_TAGGED');
    expect(typeof result.content).toBe('string');
    expect(result.content as string).toContain('<repository_context package_id="pkg_123">');
    expect(result.content as string).toContain('<feature id="feat_auth"');
    expect(result.content as string).toContain('<resource path="src/auth/login.ts"');
  });

  it('maps ContextPackage into RAW format preserving unmodified package', () => {
    const result = mapper.mapContext(mockContextPackage, { format: 'raw' });

    expect(result.format).toBe('RAW');
    expect(result.content).toBe(mockContextPackage);
  });

  it('includes optional architecture and health sections when requested', () => {
    const result = mapper.mapContext(mockContextPackage, {
      format: 'markdown',
      includeArchitecture: true,
      includeHealth: true,
      includeHistory: true,
    });

    const text = result.content as string;
    expect(text).toContain('Architectural Context');
    expect(text).toContain('Repository Health & Risks');
    expect(text).toContain('Execution History');
  });
});
