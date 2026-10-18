import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 8.1 Architectural Boundary Assertions', () => {
  const platformSrcDir = path.resolve(process.cwd(), 'src/platform');

  function getAllFiles(dir: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, fileList);
      } else if (file.endsWith('.ts')) {
        fileList.push(fullPath);
      }
    }
    return fileList;
  }

  const allPlatformFiles = getAllFiles(platformSrcDir);

  it('proves zero cloud provider lock-in (no AWS, Azure, GCP imports in platform)', () => {
    const cloudPatterns = [
      /@aws-sdk/i,
      /@azure/i,
      /@google-cloud/i,
      /from\s+['"]aws-sdk['"]/i,
      /from\s+['"]@google-cloud/i,
    ];

    for (const filePath of allPlatformFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of cloudPatterns) {
        expect(
          pattern.test(content),
          `File ${path.basename(filePath)} violates cloud-neutrality by matching ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('proves zero child_process or shell execution in platform core', () => {
    const processPatterns = [
      /from\s+['"]node:child_process['"]/i,
      /from\s+['"]child_process['"]/i,
      /require\(['"]child_process['"]\)/i,
    ];

    for (const filePath of allPlatformFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of processPatterns) {
        expect(
          pattern.test(content),
          `File ${path.basename(filePath)} contains prohibited child_process invocation: ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('proves zero AST parser or tree-sitter imports in platform layer', () => {
    const parserPatterns = [
      /tree-sitter/i,
      /web-tree-sitter/i,
    ];

    for (const filePath of allPlatformFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const pattern of parserPatterns) {
        expect(
          pattern.test(content),
          `File ${path.basename(filePath)} duplicates AST parsing logic: ${pattern}`
        ).toBe(false);
      }
    }
  });

  it('proves no duplicate DI container or EventBus implementations were created in platform', () => {
    // Platform must only import existing DIContainer and EventBus from workspace
    for (const filePath of allPlatformFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      expect(
        content.includes('class DIContainer'),
        `File ${path.basename(filePath)} must not define a duplicate DIContainer`
      ).toBe(false);
      expect(
        content.includes('class EventBus'),
        `File ${path.basename(filePath)} must not define a duplicate EventBus`
      ).toBe(false);
    }
  });
});
