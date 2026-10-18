import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Agent Context Architectural Boundaries (Section 45)', () => {
  const contextDir = path.resolve(__dirname, '../../../src/agent/context');

  function getAllTsFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  it('ensures context layer does NOT import AST parsers, Git, raw DB, or internal discovery engines', () => {
    const files = getAllTsFiles(contextDir);
    expect(files.length).toBeGreaterThan(5);

    const forbiddenPatterns = [
      /from ['"].*tree-sitter.*['"]/,
      /from ['"].*simple-git.*['"]/,
      /from ['"].*better-sqlite3.*['"]/,
      /from ['"].*sqlite3.*['"]/,
      /from ['"].*knowledge\/features\/discovery\/.*['"]/,
      /from ['"].*knowledge\/features\/mapping\/.*['"]/,
      /from ['"].*knowledge\/features\/dependency\/.*['"]/,
      /from ['"].*knowledge\/features\/behavior\/.*['"]/,
      /from ['"].*knowledge\/features\/health\/.*['"]/,
      /from ['"].*knowledge\/features\/history\/.*['"]/,
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toMatch(pattern);
      }
    }
  });

  it('strictly interacts with repository intelligence through public interfaces', () => {
    const files = getAllTsFiles(contextDir);
    const importsContent = files.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');

    // Uses public IContextOrchestrator and IFeatureKnowledgeAPI
    expect(importsContent).toMatch(/IContextOrchestrator/);
    expect(importsContent).toMatch(/IFeatureKnowledgeAPI/);
  });
});
