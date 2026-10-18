import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Architectural Boundaries & Non-Goals (Sections 64 & 72)', () => {
  const updateSrcDir = path.resolve(__dirname, '../../../src/knowledge/update');

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (fullPath.endsWith('.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  it('guarantees ZERO imports of child_process or autonomous execution across src/knowledge/update', () => {
    const tsFiles = getAllFiles(updateSrcDir);
    expect(tsFiles.length).toBeGreaterThan(15);

    const forbiddenTokens = [
      'child_process',
      'spawn(',
      'exec(',
      'execSync',
      'spawnSync',
      'execFile',
      'fork(',
      'npm test',
      'vitest run',
      'jest',
    ];

    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const token of forbiddenTokens) {
        const containsForbidden = content.includes(token);
        if (containsForbidden) {
          // If token is in a comment or string like an explanation, distinguish or disallow
          expect(
            containsForbidden,
            `File ${filePath} contains forbidden execution token: '${token}'`
          ).toBe(false);
        }
      }
    }
  });

  it('guarantees ZERO duplicate repository scanners, AST re-parsers, or full git checkout re-scanners', () => {
    const tsFiles = getAllFiles(updateSrcDir);

    const forbiddenArchitecturalKeywords = [
      'RepositoryScanner',
      'TreeSitterParser',
      'AstParser',
      'git checkout',
      'git clone',
    ];

    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const kw of forbiddenArchitecturalKeywords) {
        expect(
          content.includes(kw),
          `File ${filePath} contains forbidden architecture duplication: '${kw}'`
        ).toBe(false);
      }
    }
  });
});
