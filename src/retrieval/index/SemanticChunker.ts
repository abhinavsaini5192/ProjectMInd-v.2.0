export interface SemanticChunk {
  readonly chunkId: string;
  readonly resourceId: string;
  readonly resourceType: 'SYMBOL' | 'FILE' | 'FEATURE' | 'ARCHITECTURE' | 'DOCUMENTATION' | 'DECISION';
  readonly name: string;
  readonly symbolName?: string | undefined;
  readonly content: string;
  readonly startLine?: number | undefined;
  readonly endLine?: number | undefined;
  readonly sourceVersion: string | number;
  readonly provenance: string;
}

export class SemanticChunker {
  /**
   * Chunks code or text along semantic boundaries (classes, functions, markdown headers).
   */
  public static chunkSourceFile(
    filePath: string,
    fileContent: string,
    sourceVersion: string | number = 1
  ): SemanticChunk[] {
    const lines = fileContent.split('\n');
    const chunks: SemanticChunk[] = [];

    // Detect structural blocks (classes, functions, interfaces, methods)
    let currentBlockName: string | null = null;
    let currentStartLine = 1;
    let currentLines: string[] = [];

    const flushCurrent = (endLine: number) => {
      if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        if (text.length > 0) {
          chunks.push({
            chunkId: `${filePath}#${currentBlockName ?? 'block'}_L${currentStartLine}`,
            resourceId: filePath,
            resourceType: 'SYMBOL',
            name: currentBlockName ?? filePath,
            symbolName: currentBlockName ?? undefined,
            content: text,
            startLine: currentStartLine,
            endLine,
            sourceVersion,
            provenance: 'SEMANTIC_PARSER',
          });
        }
      }
      currentLines = [];
    };

    const symbolRegex =
      /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const|let|enum)\s+([A-Za-z0-9_$]+)/;
    const mdHeaderRegex = /^(#{1,4})\s+(.+)$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      const symMatch = line.match(symbolRegex);
      const mdMatch = line.match(mdHeaderRegex);

      if (symMatch || mdMatch) {
        // Boundary found: flush previous block
        if (currentLines.length > 0) {
          flushCurrent(lineNum - 1);
        }
        currentBlockName = symMatch ? symMatch[1]! : mdMatch![2]!.trim();
        currentStartLine = lineNum;
      }

      currentLines.push(line);

      // Bound chunk size to ~100 lines max to prevent huge single chunks
      if (currentLines.length >= 100) {
        flushCurrent(lineNum);
        currentBlockName = `${currentBlockName ?? 'block'}_cont`;
        currentStartLine = lineNum + 1;
      }
    }

    if (currentLines.length > 0) {
      flushCurrent(lines.length);
    }

    // Fallback if no specific symbols detected
    if (chunks.length === 0 && fileContent.trim().length > 0) {
      chunks.push({
        chunkId: `${filePath}#whole_file`,
        resourceId: filePath,
        resourceType: 'FILE',
        name: filePath,
        content: fileContent.slice(0, 3000),
        startLine: 1,
        endLine: lines.length,
        sourceVersion,
        provenance: 'FILE_BOUNDARY',
      });
    }

    return chunks;
  }
}
