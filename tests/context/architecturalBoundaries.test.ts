import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architectural Boundary Guardrails', () => {
  const contextDir = path.resolve(__dirname, '../../src/context');

  function scanDir(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const fullPath = path.join(dir, e.name);
      if (e.isDirectory()) {
        files.push(...scanDir(fullPath));
      } else if (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('ensures src/context/ does not directly import SQLite or low-level storage providers', () => {
    const files = scanDir(contextDir);
    const forbiddenImports = ['sqlite3', 'better-sqlite3', 'src/storage', '../storage'];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const forbidden of forbiddenImports) {
        expect(
          content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`),
          `File ${path.relative(contextDir, file)} violates boundary by importing '${forbidden}'`
        ).toBe(false);
      }
    }
  });

  it('ensures src/context/ does not directly invoke Git commands or AST parsers', () => {
    const files = scanDir(contextDir);
    const forbiddenPatterns = ['tree-sitter', 'child_process', 'simple-git'];

    for (const file of files) {
      // Exclude tests or test helpers
      if (file.includes('tests')) continue;

      const content = fs.readFileSync(file, 'utf-8');
      for (const forbidden of forbiddenPatterns) {
        expect(
          content.includes(`from '${forbidden}'`) || content.includes(`from "${forbidden}"`),
          `File ${path.relative(contextDir, file)} violates boundary by importing '${forbidden}'`
        ).toBe(false);
      }
    }
  });
});
