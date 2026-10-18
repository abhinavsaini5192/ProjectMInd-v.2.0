import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Execution Observation Architectural Boundaries (Section 60)', () => {
  const observationDir = path.resolve(process.cwd(), 'src/agent/observation');

  function getAllTsFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(getAllTsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('contains zero child_process, exec, or shell execution capabilities', () => {
    const files = getAllTsFiles(observationDir);
    expect(files.length).toBeGreaterThan(10);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"](?:node:)?child_process['"]/);
      expect(content).not.toMatch(/require\(['"](?:node:)?child_process['"]\)/);
      expect(content).not.toMatch(/\bexecSync\b/);
      expect(content).not.toMatch(/\bspawnSync\b/);
    }
  });

  it('contains zero direct AST parsing or parser dependencies', () => {
    const files = getAllTsFiles(observationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"].*\/parser\/.*['"]/);
      expect(content).not.toMatch(/from ['"]tree-sitter.*['"]/);
    }
  });

  it('contains zero raw filesystem writing (strictly in-memory / non-destructive)', () => {
    const files = getAllTsFiles(observationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/\bwriteFileSync\b/);
      expect(content).not.toMatch(/\bwriteFile\b/);
      expect(content).not.toMatch(/\bunlinkSync\b/);
      expect(content).not.toMatch(/\brmdirSync\b/);
    }
  });

  it('contains zero raw SQLite or database driver direct imports', () => {
    const files = getAllTsFiles(observationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from ['"]better-sqlite3['"]/);
      expect(content).not.toMatch(/from ['"]sqlite3['"]/);
      expect(content).not.toMatch(/from ['"].*\/storage\/sqlite\/.*['"]/);
    }
  });

  it('communicates with external modules strictly through interfaces and EventBus', () => {
    const files = getAllTsFiles(observationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      // No internal private classes of feature knowledge
      expect(content).not.toMatch(/from ['"].*\/knowledge\/features\/engines\/.*['"]/);
      expect(content).not.toMatch(/from ['"].*\/knowledge\/features\/indexing\/.*['"]/);
    }
  });
});
