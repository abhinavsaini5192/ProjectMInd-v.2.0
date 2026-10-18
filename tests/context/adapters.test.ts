import { describe, it, expect } from 'vitest';
import { AdapterRegistry } from '../../src/context/adapters/AdapterRegistry.js';
import { GenericModelAdapter } from '../../src/context/adapters/GenericModelAdapter.js';
import { AnthropicContextAdapter } from '../../src/context/adapters/AnthropicContextAdapter.js';
import { OpenAIContextAdapter } from '../../src/context/adapters/OpenAIContextAdapter.js';
import { GeminiContextAdapter } from '../../src/context/adapters/GeminiContextAdapter.js';
import { CursorContextAdapter } from '../../src/context/adapters/CursorContextAdapter.js';
import { CodexContextAdapter } from '../../src/context/adapters/CodexContextAdapter.js';
import { JsonContextAdapter } from '../../src/context/adapters/JsonContextAdapter.js';
import { UnsupportedContextFormatError } from '../../src/context/errors/UnsupportedContextFormatError.js';
import type { ContextPackage } from '../../src/context/models/ContextPackage.js';

describe('Model-Specific Adapters & Registry', () => {
  const registry = new AdapterRegistry();

  const mockPkg: ContextPackage = {
    packageId: 'pkg-1',
    generatedAt: Date.now(),
    task: { text: 'Fix timeout in login' },
    features: [
      {
        featureId: 'feat_auth',
        name: 'Authentication Service',
        description: 'Handles login flow',
        type: 'SERVICE',
        status: 'ACTIVE',
        role: 'DIRECT',
        relevance: { score: 0.95, confidence: 1, importance: 0.9, directness: true, reasons: [] },
        priority: 'CRITICAL',
        resources: [],
        entryPoints: ['AuthService.login'],
        primaryFlows: ['User Login Flow'],
        risks: ['Token expiration issue'],
      },
    ],
    resources: [
      {
        resourceId: 'src/auth/AuthService.ts',
        filePath: 'src/auth/AuthService.ts',
        role: 'PRIMARY',
        featureId: 'feat_auth',
        relevance: { score: 0.95, confidence: 1, importance: 0.9, directness: true, reasons: [] },
        priority: 'CRITICAL',
      },
    ],
    behavior: [{ name: 'User Login Flow' }],
    dependencies: [{ sourceFeatureId: 'feat_auth', targetFeatureId: 'feat_checkout', relationshipType: 'OPTIONAL' }],
    tests: ['tests/auth/login.test.ts'],
    health: { activeRisks: [{ severity: 'HIGH', description: 'Token expiration' }] },
    history: [],
    warnings: [],
    selectionReasons: { feat_auth: 'Target feature' },
    completeness: { level: 'FULL', score: 1.0, requestedSectionsCount: 5, providedSectionsCount: 5, missingSections: [], missingReasons: {} },
    freshness: { status: 'CURRENT', isStale: false, invalidationReasons: [] },
    estimatedTokens: 250,
    version: { packageVersion: '6.10.0', knowledgeVersion: '1.0.0', isConsistent: true, mismatchedSubsystems: [] },
  };

  it('GenericModelAdapter formats standard Markdown', () => {
    const adapter = new GenericModelAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    expect(res.formattedContent).toContain('# ProjectMind Context');
    expect(res.formattedContent).toContain('Authentication Service');
    expect(res.formattedContent).toContain('src/auth/AuthService.ts');
  });

  it('AnthropicContextAdapter formats Claude XML tags', () => {
    const adapter = new AnthropicContextAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    expect(res.formattedContent).toContain('<project_mind_context>');
    expect(res.formattedContent).toContain('<target_features>');
    expect(res.formattedContent).toContain('<relevant_resources>');
    expect(res.formattedContent).toContain('</project_mind_context>');
  });

  it('OpenAIContextAdapter formats system instructions and repository context', () => {
    const adapter = new OpenAIContextAdapter();
    const res = adapter.formatContext({
      package: mockPkg,
      systemInstructions: 'Act as an expert TypeScript architect.',
    });
    expect(res.formattedContent).toContain('SYSTEM INSTRUCTIONS:');
    expect(res.formattedContent).toContain('Act as an expert TypeScript architect.');
    expect(res.formattedContent).toContain('REPOSITORY CONTEXT:');
  });

  it('GeminiContextAdapter formats Gemini hierarchical Markdown', () => {
    const adapter = new GeminiContextAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    expect(res.formattedContent).toContain('Project Context Grounding');
    expect(res.formattedContent).toContain('Authentication Service');
  });

  it('CursorContextAdapter formats compact inline references', () => {
    const adapter = new CursorContextAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    expect(res.formattedContent).toContain('// Cursor Context:');
    expect(res.formattedContent).toContain('@src/auth/AuthService.ts');
  });

  it('CodexContextAdapter formats code stubs and comments', () => {
    const adapter = new CodexContextAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    expect(res.formattedContent).toContain('/*');
    expect(res.formattedContent).toContain('// import from "src/auth/AuthService.ts"');
  });

  it('JsonContextAdapter formats valid JSON', () => {
    const adapter = new JsonContextAdapter();
    const res = adapter.formatContext({ package: mockPkg });
    const parsed = JSON.parse(res.formattedContent);
    expect(parsed.packageId).toBe('pkg-1');
  });

  it('AdapterRegistry looks up adapters and throws on unsupported formats', () => {
    expect(registry.getAdapter('generic-markdown')).toBeInstanceOf(GenericModelAdapter);
    expect(registry.getAdapter('claude-xml')).toBeInstanceOf(AnthropicContextAdapter);
    expect(registry.getAdapter('openai-markdown')).toBeInstanceOf(OpenAIContextAdapter);
    expect(registry.getAdapter('gemini-markdown')).toBeInstanceOf(GeminiContextAdapter);
    expect(registry.getAdapter('cursor-compact')).toBeInstanceOf(CursorContextAdapter);
    expect(registry.getAdapter('codex-code')).toBeInstanceOf(CodexContextAdapter);
    expect(registry.getAdapter('json')).toBeInstanceOf(JsonContextAdapter);

    expect(() => registry.getAdapter('invalid-format' as any)).toThrow(UnsupportedContextFormatError);
  });
});
