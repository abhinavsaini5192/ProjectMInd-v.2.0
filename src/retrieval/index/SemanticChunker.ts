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

    // Detect structural blocks (classes, functions, interfaces, methods, headers)
    let currentBlockName: string | null = null;
    let currentSymbolName: string | null = null;
    let currentStartLine = 1;
    let currentLines: string[] = [];
    let currentClassName: string | null = null;
    let pendingDecoratorLine: number | null = null;

    const flushCurrent = (endLine: number) => {
      if (currentLines.length > 0) {
        const text = currentLines.join('\n').trim();
        if (text.length > 0) {
          chunks.push({
            chunkId: `${filePath}#${currentSymbolName ?? currentBlockName ?? 'block'}_L${currentStartLine}`,
            resourceId: filePath,
            resourceType: 'SYMBOL',
            name: currentBlockName ?? filePath,
            symbolName: currentSymbolName ?? currentBlockName ?? undefined,
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
      /^\s*(?:export\s+)?(?:async\s+)?(?:def|function|class|interface|type|const|let|enum)\s+([A-Za-z0-9_$]+)/;
    const classRegex = /^\s*(?:export\s+)?class\s+([A-Za-z0-9_$]+)/;
    const defRegex = /^\s*(?:async\s+)?def\s+([A-Za-z0-9_$]+)/;
    const mdHeaderRegex = /^(#{1,4})\s+(.+)$/;
    const decoratorRegex = /^\s*@[A-Za-z0-9_$.]+(?:\(.*\))?/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;

      // Track decorators to attach them to the following function or class
      if (decoratorRegex.test(line)) {
        if (pendingDecoratorLine === null) {
          if (currentLines.length > 0) {
            flushCurrent(lineNum - 1);
          }
          currentStartLine = lineNum;
          pendingDecoratorLine = lineNum;
        }
        currentLines.push(line);
        continue;
      }

      const symMatch = line.match(symbolRegex);
      const mdMatch = line.match(mdHeaderRegex);

      if (symMatch || mdMatch) {
        if (pendingDecoratorLine === null) {
          if (currentLines.length > 0) {
            flushCurrent(lineNum - 1);
          }
          currentStartLine = lineNum;
        }
        pendingDecoratorLine = null;

        if (mdMatch) {
          currentBlockName = mdMatch[2]!.trim();
          currentSymbolName = currentBlockName;
          currentClassName = null;
        } else {
          const rawName = symMatch![1]!;
          const isClass = classRegex.test(line);
          const isDef = defRegex.test(line);
          const isIndented = /^\s+/.test(line);

          if (isClass) {
            currentClassName = rawName;
            currentBlockName = rawName;
            currentSymbolName = rawName;
          } else if (isDef) {
            if (isIndented && currentClassName) {
              currentBlockName = `${currentClassName}.${rawName}`;
              currentSymbolName = rawName;
            } else {
              currentClassName = null;
              currentBlockName = rawName;
              currentSymbolName = rawName;
            }
          } else {
            currentBlockName = rawName;
            currentSymbolName = rawName;
          }
        }
      } else {
        if (line.trim().length > 0 && !line.trim().startsWith('#') && !line.trim().startsWith('//')) {
          pendingDecoratorLine = null;
        }
      }

      currentLines.push(line);

      // Bound chunk size to ~100 lines max to prevent huge single chunks
      if (currentLines.length >= 100) {
        flushCurrent(lineNum);
        currentBlockName = `${currentBlockName ?? 'block'}_cont`;
        currentSymbolName = `${currentSymbolName ?? 'block'}_cont`;
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
