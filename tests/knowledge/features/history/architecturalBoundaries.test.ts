import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Architectural Boundary Compliance', () => {
  const historyDir = path.resolve(process.cwd(), 'src/knowledge/features/history');

  function getAllTsFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('ensures history module has no forbidden direct dependencies', () => {
    const tsFiles = getAllTsFiles(historyDir);
    expect(tsFiles.length).toBeGreaterThan(15);

    const forbiddenPatterns = [
      /\bfrom\s+['"]fs['"]/,
      /\bfrom\s+['"]node:fs['"]/,
      /\bfrom\s+['"]child_process['"]/,
      /\bfrom\s+['"]node:child_process['"]/,
      /\bfrom\s+['"]better-sqlite3['"]/,
      /\bfrom\s+['"]kuzu['"]/,
      /\bfrom\s+['"]http['"]/,
      /\bfrom\s+['"]node:http['"]/,
      /\bfrom\s+['"]https['"]/,
      /\bfrom\s+['"]node:https['"]/,
    ];

    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(
          pattern.test(content),
          `File ${file} violated architectural rule by importing forbidden module (${pattern})`
        ).toBe(false);
      }
    }
  });

  it('ensures history module relies only on canonical abstractions', () => {
    const tsFiles = getAllTsFiles(historyDir);
    for (const file of tsFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain('exec(');
      expect(content).not.toContain('spawn(');
      expect(content).not.toContain('eval(');
    }
  });
});
