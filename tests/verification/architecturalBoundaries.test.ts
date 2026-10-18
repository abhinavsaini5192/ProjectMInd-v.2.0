import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 7.7 Section 59: Architectural Boundaries Validation', () => {
  const verificationDir = path.resolve(__dirname, '../../src/verification');

  function getAllFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...getAllFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('verifies Verification layer never imports shell execution or child_process', () => {
    const files = getAllFiles(verificationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]child_process['"]/);
      expect(content).not.toMatch(/exec\s*\(/);
      expect(content).not.toMatch(/spawn\s*\(/);
      expect(content).not.toMatch(/execSync\s*\(/);
    }
  });

  it('verifies Verification layer never imports direct test runners or compilers (vitest, jest, tsc)', () => {
    const files = getAllFiles(verificationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]vitest['"]/);
      expect(content).not.toMatch(/from\s+['"]jest['"]/);
      expect(content).not.toMatch(/from\s+['"]mocha['"]/);
      expect(content).not.toMatch(/from\s+['"]typescript['"]/);
    }
  });

  it('verifies Verification layer never imports direct Git implementations (simple-git, isomorphic-git)', () => {
    const files = getAllFiles(verificationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"]simple-git['"]/);
      expect(content).not.toMatch(/from\s+['"]isomorphic-git['"]/);
    }
  });

  it('verifies Verification layer never directly imports private Feature Discovery, Mapping, Dependency, Behavior, Health, or History engines', () => {
    const files = getAllFiles(verificationDir);

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toMatch(/from\s+['"].*\/discovery\/.*Engine.*['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/mapping\/.*Engine.*['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/dependencies\/.*Engine.*['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/behavior\/.*Engine.*['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/health\/.*Engine.*['"]/);
      expect(content).not.toMatch(/from\s+['"].*\/history\/.*Engine.*['"]/);
    }
  });
});
