import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 7.5 Architectural Boundaries & Constraints (Section 46)', () => {
  const runtimeDir = path.resolve(__dirname, '../../../src/agent/runtime');

  function getAllFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else if (entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('verifies that Task Runtime has zero direct dependencies on AST, Git, filesystem, or database implementations', () => {
    const files = getAllFiles(runtimeDir);
    expect(files.length).toBeGreaterThan(10);

    const forbiddenPatterns = [
      /from\s+['"].*tree-sitter.*['"]/,
      /from\s+['"].*parser.*['"]/,
      /from\s+['"].*git.*['"]/,
      /from\s+['"]node:fs.*['"]/,
      /from\s+['"]fs.*['"]/,
      /from\s+['"].*better-sqlite3.*['"]/,
      /from\s+['"].*sqlite.*['"]/,
      /from\s+['"].*postgres.*['"]/,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('verifies that Task Runtime does NOT import private feature intelligence engines directly', () => {
    const files = getAllFiles(runtimeDir);

    const forbiddenFeatureEngines = [
      /from\s+['"].*knowledge\/features\/discovery\/core.*['"]/,
      /from\s+['"].*knowledge\/features\/mapping\/core.*['"]/,
      /from\s+['"].*knowledge\/features\/dependencies\/core.*['"]/,
      /from\s+['"].*knowledge\/features\/impact\/core.*['"]/,
      /from\s+['"].*knowledge\/features\/history\/core.*['"]/,
      /from\s+['"].*knowledge\/features\/health\/core.*['"]/,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenFeatureEngines) {
        expect(content).not.toMatch(pattern);
      }
    }
  });
});
