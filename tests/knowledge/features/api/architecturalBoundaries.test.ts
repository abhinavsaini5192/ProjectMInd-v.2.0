import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { DIContainer } from '../../../../src/workspace/di/DIContainer.js';
import {
  registerFeatureKnowledgeServices,
  FeatureKnowledgeTokens,
} from '../../../../src/knowledge/features/api/di/FeatureKnowledgeDISetup.js';
import { createMockFeatureRepository } from './ApiTestHelper.js';

describe('Phase 6.9 - Architectural Boundaries and Non-Duplication', () => {
  const apiSrcDir = path.resolve(__dirname, '../../../../src/knowledge/features/api');

  it('should not contain any direct filesystem or database drivers in API layer', () => {
    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');

          // Check for forbidden raw database / sqlite / git imports
          expect(content).not.toMatch(/from ['"]better-sqlite3['"]/);
          expect(content).not.toMatch(/from ['"]sqlite3['"]/);
          expect(content).not.toMatch(/child_process/);
          expect(content).not.toMatch(/from ['"]simple-git['"]/);
        }
      }
    }

    checkDir(apiSrcDir);
  });

  it('should register cleanly and resolve via DI container', () => {
    const container = new DIContainer();
    const featureRepo = createMockFeatureRepository();

    registerFeatureKnowledgeServices(container, {
      featureRepository: featureRepo,
    });

    const planner = container.resolve(FeatureKnowledgeTokens.Planner);
    expect(planner).toBeDefined();

    const queryService = container.resolve(FeatureKnowledgeTokens.QueryService);
    expect(queryService).toBeDefined();

    const api = container.resolve(FeatureKnowledgeTokens.API);
    expect(api).toBeDefined();

    const readRepo = container.resolve(FeatureKnowledgeTokens.ReadRepository);
    expect(readRepo).toBeDefined();
  });
});
