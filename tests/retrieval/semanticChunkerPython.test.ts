import { describe, it, expect } from 'vitest';
import { SemanticChunker } from '../../src/retrieval/index/SemanticChunker.js';

describe('SemanticChunker — Python & Polyglot Symbol Extraction', () => {
  it('extracts top-level Python functions correctly', () => {
    const pyCode = `
import os
import sys

def format_firewall_response(result):
    """Formats the firewall response."""
    return {"status": "ok", "result": result}

def standalone_helper():
    pass
`;

    const chunks = SemanticChunker.chunkSourceFile('nivesh/service.py', pyCode);
    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const formatChunk = chunks.find((c) => c.symbolName === 'format_firewall_response');
    expect(formatChunk).toBeDefined();
    expect(formatChunk?.name).toBe('format_firewall_response');
    expect(formatChunk?.resourceId).toBe('nivesh/service.py');
    expect(formatChunk?.chunkId).toBe('nivesh/service.py#format_firewall_response_L5');
    expect(formatChunk?.content).toContain('def format_firewall_response(result):');

    const helperChunk = chunks.find((c) => c.symbolName === 'standalone_helper');
    expect(helperChunk).toBeDefined();
    expect(helperChunk?.name).toBe('standalone_helper');
  });

  it('extracts Python async def functions correctly', () => {
    const pyCode = `
async def handle_async_event(event_id: str):
    await do_work(event_id)
`;

    const chunks = SemanticChunker.chunkSourceFile('nivesh/async_handler.py', pyCode);
    const asyncChunk = chunks.find((c) => c.symbolName === 'handle_async_event');
    expect(asyncChunk).toBeDefined();
    expect(asyncChunk?.name).toBe('handle_async_event');
    expect(asyncChunk?.content).toContain('async def handle_async_event');
  });

  it('extracts Python classes and indented class methods with hierarchy', () => {
    const pyCode = `
class ProductOrchestrator:
    def __init__(self, config):
        self.config = config

    def analyze(self, payload):
        return self._run(payload)

    async def async_process(self):
        pass

def external_func():
    return True
`;

    const chunks = SemanticChunker.chunkSourceFile('nivesh/orchestrator.py', pyCode);

    const initChunk = chunks.find((c) => c.name === 'ProductOrchestrator.__init__');
    expect(initChunk).toBeDefined();
    expect(initChunk?.symbolName).toBe('__init__');

    const analyzeChunk = chunks.find((c) => c.name === 'ProductOrchestrator.analyze');
    expect(analyzeChunk).toBeDefined();
    expect(analyzeChunk?.symbolName).toBe('analyze');

    const asyncChunk = chunks.find((c) => c.name === 'ProductOrchestrator.async_process');
    expect(asyncChunk).toBeDefined();
    expect(asyncChunk?.symbolName).toBe('async_process');

    const extChunk = chunks.find((c) => c.name === 'external_func');
    expect(extChunk).toBeDefined();
    expect(extChunk?.symbolName).toBe('external_func');
  });

  it('captures Python decorators preceding functions', () => {
    const pyCode = `
@router.post("/analyze")
@require_auth(role="admin")
def analyze_endpoint(request):
    return {"status": "analyzed"}
`;

    const chunks = SemanticChunker.chunkSourceFile('api/routes.py', pyCode);
    const routeChunk = chunks.find((c) => c.symbolName === 'analyze_endpoint');
    expect(routeChunk).toBeDefined();
    expect(routeChunk?.content).toContain('@router.post("/analyze")');
    expect(routeChunk?.content).toContain('def analyze_endpoint(request):');
    expect(routeChunk?.startLine).toBe(2);
  });

  it('preserves existing TypeScript / JavaScript symbol extraction', () => {
    const tsCode = `
export class AuthService {
  login() {}
}

export async function verifyToken(token: string) {
  return true;
}

export interface UserSession {
  id: string;
}
`;

    const chunks = SemanticChunker.chunkSourceFile('src/auth.ts', tsCode);
    expect(chunks.find((c) => c.name === 'AuthService')).toBeDefined();
    expect(chunks.find((c) => c.name === 'verifyToken')).toBeDefined();
    expect(chunks.find((c) => c.name === 'UserSession')).toBeDefined();
  });

  it('preserves existing Markdown header extraction', () => {
    const mdCode = `
# System Architecture
Overview of the system.

## Data Flow
Description of data pipeline.
`;

    const chunks = SemanticChunker.chunkSourceFile('docs/arch.md', mdCode);
    expect(chunks.find((c) => c.name === 'System Architecture')).toBeDefined();
    expect(chunks.find((c) => c.name === 'Data Flow')).toBeDefined();
  });
});
