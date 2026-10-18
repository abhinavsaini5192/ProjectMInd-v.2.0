import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ProductionAgentRuntime - Architectural Boundaries & Non-Goals', () => {
  const runtimeDir = path.resolve(__dirname, '../../../../src/agent/runtime');

  function getTsFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allFiles = getTsFiles(runtimeDir);

  it('contains zero child_process or shell execution imports in runtime', () => {
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]child_process['"]/);
      expect(content).not.toMatch(/require\(['"]child_process['"]\)/);
      expect(content).not.toMatch(/require\(['"]node:child_process['"]\)/);
      expect(content).not.toMatch(/from\s+['"]node:child_process['"]/);
    }
  });

  it('contains zero direct AST parser imports (e.g. @babel, typescript, tree-sitter) in runtime', () => {
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]@babel/);
      expect(content).not.toMatch(/from\s+['"]tree-sitter/);
      expect(content).not.toMatch(/from\s+['"]web-tree-sitter/);
    }
  });

  it('contains zero test runner invocation imports (vitest, jest, mocha) in production source', () => {
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]vitest['"]/);
      expect(content).not.toMatch(/from\s+['"]jest['"]/);
      expect(content).not.toMatch(/from\s+['"]mocha['"]/);
    }
  });

  it('contains zero direct repository scanning / extraction engine duplication', () => {
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/class RepositoryExtractionEngine/);
      expect(content).not.toMatch(/class KnowledgeGraphBuilder/);
    }
  });
});
