import { describe, it, expect } from 'vitest';
import { ContextIntegrityValidator } from '../../src/context/packing/ContextIntegrityValidator.js';
import type { ContextPackage } from '../../src/context/models/ContextPackage.js';

describe('Context Security & Integrity', () => {
  it('redacts sensitive API keys, passwords, and bearer tokens', () => {
    const rawSnippet = `const apiKey = "sk-1234567890abcdef1234567890";
const password = "super_secret_password_123";
const auth = "Bearer ya29.a0AfH6SMDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";`;

    const sanitized = ContextIntegrityValidator.sanitizeString(rawSnippet);

    expect(sanitized).not.toContain('super_secret_password_123');
    expect(sanitized).not.toContain('sk-1234567890abcdef1234567890');
    expect(sanitized).toContain('[REDACTED_SECRET]');
  });

  it('sanitizes secrets across features and resources in package', () => {
    const pkg: ContextPackage = {
      packageId: 'pkg-sec',
      generatedAt: Date.now(),
      task: { text: 'Fix bug with password: "plain_text_pass"' },
      features: [
        {
          featureId: 'feat-1',
          name: 'F1',
          description: 'Uses api_key="secret_token_123"',
          type: 'SERVICE',
          status: 'ACTIVE',
          role: 'DIRECT',
          relevance: { score: 1, confidence: 1, importance: 1, directness: true, reasons: [] },
          priority: 'CRITICAL',
          resources: [
            {
              resourceId: 'res-1',
              role: 'PRIMARY',
              featureId: 'feat-1',
              relevance: { score: 1, confidence: 1, importance: 1, directness: true, reasons: [] },
              priority: 'CRITICAL',
              snippet: 'const token = "secret_jwt_token";',
            },
          ],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
        },
      ],
      resources: [],
      behavior: [],
      dependencies: [],
      tests: [],
      history: [],
      warnings: [],
      selectionReasons: {},
      completeness: { level: 'FULL', score: 1, requestedSectionsCount: 1, providedSectionsCount: 1, missingSections: [], missingReasons: {} },
      freshness: { status: 'CURRENT', isStale: false, invalidationReasons: [] },
      estimatedTokens: 100,
      version: { packageVersion: '6.10.0', knowledgeVersion: '1.0.0', isConsistent: true, mismatchedSubsystems: [] },
    };

    ContextIntegrityValidator.sanitizePackage(pkg);

    expect(pkg.task.text).not.toContain('plain_text_pass');
    expect(pkg.features[0]!.description).not.toContain('secret_token_123');
    expect(pkg.features[0]!.resources[0]!.snippet).not.toContain('secret_jwt_token');
    expect(pkg.task.text).toContain('[REDACTED_SECRET]');
  });

  it('detects circular dependency cycles and emits CIRCULAR_DEPENDENCY warning', () => {
    const warnings: any[] = [];
    const featuresWithCycle = [
      { featureId: 'feat-A', dependencies: [{ featureId: 'feat-B' }] },
      { featureId: 'feat-B', dependencies: [{ featureId: 'feat-C' }] },
      { featureId: 'feat-C', dependencies: [{ featureId: 'feat-A' }] }, // Cycle A -> B -> C -> A
    ];

    ContextIntegrityValidator.validateGraphIntegrity(featuresWithCycle, warnings);
    expect(warnings.some((w) => w.type === 'CIRCULAR_DEPENDENCY')).toBe(true);
  });
});
