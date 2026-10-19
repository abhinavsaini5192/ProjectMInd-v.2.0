import { describe, it, expect } from 'vitest';
import { SemanticChunker } from '../../src/retrieval/index/SemanticChunker.js';
import { SemanticIndex } from '../../src/retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../src/retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { HybridRetrievalEngine } from '../../src/retrieval/engine/HybridRetrievalEngine.js';

describe('Multi-Chunk Indexing & Retrieval for Large Files', () => {
  it('retains all distinct chunks without intra-file map collisions', async () => {
    // Generate a large 1,500-line Python service with 15 distinct functions
    const functionNames: string[] = [];
    const lines: string[] = [];

    for (let i = 1; i <= 15; i++) {
      const fnName = `service_operation_${i}`;
      functionNames.push(fnName);
      lines.push(`def ${fnName}(request_context):`);
      lines.push(`    """Operation ${i} detailed logic."""`);
      // Pad with ~90 lines of code per function
      for (let j = 0; j < 90; j++) {
        lines.push(`    step_${j} = execute_step_${j}(request_context, factor=${i})`);
      }
      lines.push(`    return {"op": "${fnName}", "status": "COMPLETED"}\n`);
    }

    const largeFileContent = lines.join('\n');
    const filePath = 'services/large_orchestration_service.py';
    const repoId = 'repo_large_test';

    const chunks = SemanticChunker.chunkSourceFile(filePath, largeFileContent);
    expect(chunks.length).toBeGreaterThanOrEqual(15);

    const semanticIndex = new SemanticIndex();
    const embeddingProvider = new LocalSemanticEmbeddingProvider();

    // Index all chunks using unique chunkId and contentReference
    for (const chunk of chunks) {
      const textToEmbed = `${chunk.name} ${chunk.content}`;
      const embedding = await embeddingProvider.embedText(textToEmbed);

      await semanticIndex.index({
        resourceId: chunk.chunkId,
        contentReference: chunk.resourceId,
        resourceType: chunk.resourceType,
        workspaceId: 'ws_test',
        repositoryId: repoId,
        title: chunk.name,
        snippet: chunk.content,
        embedding,
        embeddingVersion: embeddingProvider.metadata.version,
        sourceVersion: chunk.sourceVersion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          filePath: chunk.resourceId,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          symbolName: chunk.symbolName,
        },
      });
    }

    // Verify all chunks are retained
    const indexedEntries = await semanticIndex.listEntries(repoId, 100);
    expect(indexedEntries.length).toBe(chunks.length);

    // Verify that a function in the middle (e.g. operation 8 at ~line 800) is present
    const op8Entry = indexedEntries.find((e) => e.title === 'service_operation_8');
    expect(op8Entry).toBeDefined();
    expect(op8Entry?.metadata?.['startLine']).toBeGreaterThan(600);

    // Search for operation 8 using HybridRetrievalEngine
    const engine = new HybridRetrievalEngine(semanticIndex, embeddingProvider);
    const searchResults = await engine.retrieve({
      queryId: 'q_op8',
      workspaceId: 'ws_test',
      repositoryId: repoId,
      text: 'service_operation_8',
      queryType: 'UNKNOWN',
      filters: { limit: 5 },
      timestamp: Date.now(),
    });

    expect(searchResults.length).toBeGreaterThan(0);
    const topHit = searchResults[0]!;
    expect(topHit.name).toBe('service_operation_8');
    expect(topHit.contentReference).toBe(filePath);
    expect(topHit.metadata?.['filePath']).toBe(filePath);
    expect(topHit.metadata?.['startLine']).toBeGreaterThan(600);
  });

  it('supports file-level invalidation and removal across all chunks of a file', async () => {
    const semanticIndex = new SemanticIndex();
    const filePath = 'core/multi_chunk.ts';
    const repoId = 'repo_invalidation_test';

    // Index 3 chunks for the same file
    for (let i = 1; i <= 3; i++) {
      await semanticIndex.index({
        resourceId: `${filePath}#chunk_${i}`,
        contentReference: filePath,
        resourceType: 'SYMBOL',
        workspaceId: 'ws_test',
        repositoryId: repoId,
        title: `symbol_${i}`,
        embedding: [0.1, 0.2, 0.3],
        embeddingVersion: '1.0.0',
        sourceVersion: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    let entries = await semanticIndex.listEntries(repoId, 10);
    expect(entries.length).toBe(3);

    // Invalidate by file path
    await semanticIndex.invalidate(filePath, repoId);
    entries = await semanticIndex.listEntries(repoId, 10);
    expect(entries.every((e) => e.metadata?.isStale === true)).toBe(true);

    // Remove by file path
    await semanticIndex.remove(filePath, repoId);
    entries = await semanticIndex.listEntries(repoId, 10);
    expect(entries.length).toBe(0);
  });
});
