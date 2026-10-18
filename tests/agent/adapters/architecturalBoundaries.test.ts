import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Agent Adapters Architectural Boundary Tests', () => {
  const adaptersDir = path.resolve(__dirname, '../../../src/agent/adapters');

  function getAllTypeScriptFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTypeScriptFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const adapterFiles = getAllTypeScriptFiles(adaptersDir);

  it('verifies adapter layer does not import child_process or spawn execution', () => {
    for (const file of adapterFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"]child_process['"]/);
      expect(content).not.toMatch(/require\(['"]child_process['"]\)/);
      expect(content).not.toMatch(/from ['"]node:child_process['"]/);
    }
  });

  it('verifies adapter layer does not perform repository extraction or scanning', () => {
    for (const file of adapterFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"].*extraction.*['"]/i);
      expect(content).not.toMatch(/DirectoryScanner/);
      expect(content).not.toMatch(/RepositoryExtractionEngine/);
    }
  });

  it('verifies adapter layer does not import tree-sitter or AST parsers', () => {
    for (const file of adapterFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/tree-sitter/i);
      expect(content).not.toMatch(/@babel\/parser/i);
    }
  });

  it('verifies adapter layer does not re-rank or select context', () => {
    // AgentContextMapper must strictly format already chosen context, never invoke ranking engines
    for (const file of adapterFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/ContextRankingEngine/);
      expect(content).not.toMatch(/ContextSelector/);
    }
  });
});
