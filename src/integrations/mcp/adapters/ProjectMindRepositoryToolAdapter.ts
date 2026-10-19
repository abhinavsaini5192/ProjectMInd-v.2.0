import fs from 'node:fs';
import path from 'node:path';
import type { IMcpToolAdapter } from './IMcpToolAdapter.js';
import type {
  McpToolDefinition,
  McpToolCallParams,
  McpCallToolResult,
  McpSessionContext,
} from '../protocol/McpTypes.js';
import { McpSecurityValidator } from '../security/McpSecurityValidator.js';
import { SecuritySanitizer } from '../../../intelligence/agent/hardening/SecuritySanitizer.js';
import { McpErrorMapper } from '../errors/McpErrorMapper.js';
import { McpError } from '../errors/McpError.js';
import { McpErrorCodes } from '../errors/McpErrorCodes.js';
import { McpConstants } from '../protocol/McpConstants.js';
import { SemanticChunker, type SemanticChunk } from '../../../retrieval/index/SemanticChunker.js';
import { SemanticIndex } from '../../../retrieval/index/SemanticIndex.js';
import { LocalSemanticEmbeddingProvider } from '../../../retrieval/embeddings/LocalSemanticEmbeddingProvider.js';
import { HybridRetrievalEngine } from '../../../retrieval/engine/HybridRetrievalEngine.js';
import { WorkspaceManager } from '../../../workspace/WorkspaceManager.js';

export interface ProjectMindRepositoryToolAdapterOptions {
  fallbackAdapter?: IMcpToolAdapter | undefined;
  maxPayloadBytes?: number | undefined;
  maxIndexedFiles?: number | undefined;
}

interface RepoIndexState {
  projectPath: string;
  indexedAt: number;
  filesIndexed: number;
  semanticIndex: SemanticIndex;
  embeddingProvider: LocalSemanticEmbeddingProvider;
  retrievalEngine: HybridRetrievalEngine;
  fileList: string[];
  chunks: SemanticChunk[];
}

/**
 * Concrete MCP tool adapter exposing ProjectMind's core repository intelligence tools
 * to external MCP clients like Google Antigravity, Claude Desktop, and Cursor.
 */
export class ProjectMindRepositoryToolAdapter implements IMcpToolAdapter {
  private readonly fallbackAdapter?: IMcpToolAdapter | undefined;
  private readonly maxPayloadBytes: number;
  private readonly maxIndexedFiles: number;
  private readonly indexCache = new Map<string, RepoIndexState>();

  private static readonly REPO_TOOL_DEFINITIONS: readonly McpToolDefinition[] = [
    {
      name: 'projectmind_get_context',
      description:
        'Generate an optimized, token-budgeted, deterministic context package from repository intelligence, AST symbols, and feature mappings for a developer task.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to the target repository',
          },
          task: {
            type: 'string',
            description: 'Natural-language development task or inquiry requiring context',
          },
          maxFiles: {
            type: 'integer',
            description: 'Optional maximum number of relevant files to include (1-50, default: 10)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
        required: ['projectPath', 'task'],
        additionalProperties: false,
      },
    },
    {
      name: 'projectmind_search',
      description:
        'Search repository intelligence, extracted symbols, source code files, and features using hybrid lexical and semantic retrieval.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to the target repository',
          },
          query: {
            type: 'string',
            description: 'Search query for symbols, definitions, architecture, or code patterns',
          },
          limit: {
            type: 'integer',
            description: 'Optional maximum number of results to return (1-50, default: 10)',
            minimum: 1,
            maximum: 50,
            default: 10,
          },
        },
        required: ['projectPath', 'query'],
        additionalProperties: false,
      },
    },
    {
      name: 'projectmind_explain_feature',
      description:
        'Explain how a feature or subsystem works in the target repository using verified code symbols, dependency relationships, and architectural evidence.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to the target repository',
          },
          feature: {
            type: 'string',
            description: 'Name, concept, or description of the feature to explain',
          },
        },
        required: ['projectPath', 'feature'],
        additionalProperties: false,
      },
    },
    {
      name: 'projectmind_impact_analysis',
      description:
        'Analyze change impact, downstream blast radius, and affected components when a file or symbol is modified.',
      inputSchema: {
        type: 'object',
        properties: {
          projectPath: {
            type: 'string',
            description: 'Absolute path to the target repository',
          },
          target: {
            type: 'string',
            description: 'Target file path, symbol name, or feature component to analyze',
          },
          changeDescription: {
            type: 'string',
            description: 'Optional description of the proposed modification',
          },
        },
        required: ['projectPath', 'target'],
        additionalProperties: false,
      },
    },
  ];

  constructor(options: ProjectMindRepositoryToolAdapterOptions = {}) {
    this.fallbackAdapter = options.fallbackAdapter;
    this.maxPayloadBytes = options.maxPayloadBytes ?? McpConstants.DEFAULT_MAX_PAYLOAD_BYTES;
    this.maxIndexedFiles = options.maxIndexedFiles ?? 500;
  }

  public async listTools(): Promise<McpToolDefinition[]> {
    const tools: McpToolDefinition[] = [...ProjectMindRepositoryToolAdapter.REPO_TOOL_DEFINITIONS];

    if (this.fallbackAdapter) {
      try {
        const fallbackTools = await this.fallbackAdapter.listTools();
        const existingNames = new Set(tools.map((t) => t.name));
        for (const fbTool of fallbackTools) {
          if (!existingNames.has(fbTool.name)) {
            tools.push(fbTool);
          }
        }
      } catch {
        // Safe continuation with core tools
      }
    }

    return tools;
  }

  public async executeTool(
    params: McpToolCallParams,
    sessionContext: McpSessionContext
  ): Promise<McpCallToolResult> {
    try {
      McpSecurityValidator.validateArguments(params.arguments, this.maxPayloadBytes);

      switch (params.name) {
        case 'projectmind_get_context':
          return await this.handleGetContext(params.arguments);

        case 'projectmind_search':
          return await this.handleSearch(params.arguments);

        case 'projectmind_explain_feature':
          return await this.handleExplainFeature(params.arguments);

        case 'projectmind_impact_analysis':
          return await this.handleImpactAnalysis(params.arguments);

        default:
          if (this.fallbackAdapter) {
            return await this.fallbackAdapter.executeTool(params, sessionContext);
          }
          throw new McpError(
            `Unknown or unsupported tool: '${params.name}'`,
            McpErrorCodes.TOOL_NOT_FOUND,
            { toolName: params.name }
          );
      }
    } catch (err: unknown) {
      return McpErrorMapper.toCallToolResult(err);
    }
  }

  // ---------------------------------------------------------------------------
  // Tool 1: projectmind_get_context
  // ---------------------------------------------------------------------------
  private async handleGetContext(
    args: Record<string, unknown> | undefined
  ): Promise<McpCallToolResult> {
    const { projectPath, taskText, maxFiles } = this.validateContextParams(args);
    const repoState = await this.getOrBuildRepoIndex(projectPath);

    // Retrieve relevant candidates via canonical HybridRetrievalEngine
    const retrievalResults = await repoState.retrievalEngine.retrieve({
      queryId: `mcp_ctx_${Date.now()}`,
      workspaceId: repoState.projectPath,
      repositoryId: repoState.projectPath,
      text: taskText,
      queryType: 'TASK',
      filters: { limit: maxFiles * 2 },
      timestamp: Date.now(),
    });

    // Group candidates by file resource
    const fileScoreMap = new Map<
      string,
      {
        relevanceScore: number;
        reasons: string[];
        symbols: string[];
        snippets: string[];
      }
    >();

    for (const r of retrievalResults) {
      const relPath =
        (r.metadata?.['filePath'] as string) ??
        r.contentReference ??
        r.resourceId.split('#')[0]!;
      const existing = fileScoreMap.get(relPath);
      const score = r.score;
      const snippet = r.snippet ? r.snippet.slice(0, 160) : '';

      if (!existing) {
        fileScoreMap.set(relPath, {
          relevanceScore: score,
          reasons: r.evidence.length > 0 ? r.evidence : [`Semantic relevance: ${Math.round(score * 100)}%`],
          symbols: r.name ? [r.name] : [],
          snippets: snippet ? [snippet] : [],
        });
      } else {
        existing.relevanceScore = Math.max(existing.relevanceScore, score);
        if (r.name && !existing.symbols.includes(r.name)) {
          existing.symbols.push(r.name);
        }
        for (const ev of r.evidence) {
          if (!existing.reasons.includes(ev)) {
            existing.reasons.push(ev);
          }
        }
      }
    }

    const selectedFiles = Array.from(fileScoreMap.entries())
      .map(([filePath, data]) => ({
        filePath,
        relevanceScore: Math.round(data.relevanceScore * 1000) / 1000,
        reasons: data.reasons,
        symbols: data.symbols,
        snippets: data.snippets,
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxFiles);

    const relevantSymbols = Array.from(
      new Set(selectedFiles.flatMap((f) => f.symbols))
    );

    const estimatedTokens = selectedFiles.reduce((acc, f) => {
      return acc + 100 + f.snippets.join('\n').length / 4;
    }, 150);

    const isProjectMindWorkspace = new WorkspaceManager(projectPath).validateWorkspace();
    const indexingStatus = isProjectMindWorkspace ? 'INDEXED' : 'SCANNED_SOURCE_WORKSPACE';

    const resultPayload = {
      projectPath: repoState.projectPath,
      task: taskText,
      indexingStatus,
      totalFilesIndexed: repoState.filesIndexed,
      selectedFilesCount: selectedFiles.length,
      estimatedTokens: Math.round(estimatedTokens),
      selectedFiles,
      relevantSymbols,
    };

    const lines: string[] = [
      `### ProjectMind Context Package`,
      `**Task:** ${taskText}`,
      `**Repository:** \`${repoState.projectPath}\` (${indexingStatus})`,
      `**Files Selected:** ${selectedFiles.length} (Estimated Tokens: ~${Math.round(estimatedTokens)})`,
      '',
    ];

    if (selectedFiles.length === 0) {
      lines.push('No matching source files found in repository for the provided task.');
    } else {
      for (const f of selectedFiles) {
        lines.push(`- **\`${f.filePath}\`** (Relevance: ${Math.round(f.relevanceScore * 100)}%)`);
        if (f.symbols.length > 0) {
          lines.push(`  - *Symbols:* \`${f.symbols.join('`, `')}\``);
        }
        if (f.reasons.length > 0) {
          lines.push(`  - *Reason:* ${f.reasons.join('; ')}`);
        }
      }
    }

    const rawOutput = `${lines.join('\n')}\n\n\`\`\`json\n${JSON.stringify(resultPayload, null, 2)}\n\`\`\``;
    const sanitizedOutput = SecuritySanitizer.redactSecrets(rawOutput);

    return {
      content: [
        {
          type: 'text',
          text: sanitizedOutput,
        },
      ],
      isError: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 2: projectmind_search
  // ---------------------------------------------------------------------------
  private async handleSearch(
    args: Record<string, unknown> | undefined
  ): Promise<McpCallToolResult> {
    const { projectPath, query, limit } = this.validateSearchParams(args);
    const repoState = await this.getOrBuildRepoIndex(projectPath);

    const results = await repoState.retrievalEngine.retrieve({
      queryId: `mcp_search_${Date.now()}`,
      workspaceId: repoState.projectPath,
      repositoryId: repoState.projectPath,
      text: query,
      queryType: 'UNKNOWN',
      filters: { limit },
      timestamp: Date.now(),
    });

    const formattedResults = results.map((r) => {
      const relPath =
        (r.metadata?.['filePath'] as string) ??
        r.contentReference ??
        r.resourceId.split('#')[0]!;
      const fullPath = path.resolve(repoState.projectPath, relPath);
      const existsOnDisk = fs.existsSync(fullPath);

      // Extract line numbers from chunk metadata if available
      const matchingChunk = repoState.chunks.find(
        (c) => c.chunkId === r.resourceId || (c.name === r.name && c.resourceId === relPath)
      );
      const startLine = (r.metadata?.['startLine'] as number) ?? matchingChunk?.startLine;
      const endLine = (r.metadata?.['endLine'] as number) ?? matchingChunk?.endLine;

      return {
        name: r.name,
        resourceId: relPath,
        fullPath: existsOnDisk ? fullPath : undefined,
        source: r.source,
        score: Math.round(r.score * 1000) / 1000,
        snippet: r.snippet,
        startLine,
        endLine,
        evidence: r.evidence,
        existsOnDisk,
      };
    });

    const resultPayload = {
      projectPath: repoState.projectPath,
      query,
      count: formattedResults.length,
      results: formattedResults,
    };

    const lines: string[] = [
      `### ProjectMind Search Results for: "${query}"`,
      `**Repository:** \`${repoState.projectPath}\` (${formattedResults.length} matches)`,
      '',
    ];

    if (formattedResults.length === 0) {
      lines.push('No matching symbols or files found.');
    } else {
      for (const res of formattedResults) {
        const lineInfo = res.startLine ? ` (Lines ${res.startLine}-${res.endLine})` : '';
        lines.push(
          `- **\`${res.resourceId}\`** — \`${res.name}\`${lineInfo} [Score: ${Math.round(res.score * 100)}%]`
        );
        if (res.snippet) {
          lines.push(`  \`\`\`\n  ${res.snippet.replace(/\n/g, '\n  ')}\n  \`\`\``);
        }
      }
    }

    const rawOutput = `${lines.join('\n')}\n\n\`\`\`json\n${JSON.stringify(resultPayload, null, 2)}\n\`\`\``;
    const sanitizedOutput = SecuritySanitizer.redactSecrets(rawOutput);

    return {
      content: [
        {
          type: 'text',
          text: sanitizedOutput,
        },
      ],
      isError: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 3: projectmind_explain_feature
  // ---------------------------------------------------------------------------
  private async handleExplainFeature(
    args: Record<string, unknown> | undefined
  ): Promise<McpCallToolResult> {
    const { projectPath, feature } = this.validateFeatureParams(args);
    const repoState = await this.getOrBuildRepoIndex(projectPath);

    // 1. Search for matching symbols and files
    const matches = await repoState.retrievalEngine.retrieve({
      queryId: `mcp_feature_${Date.now()}`,
      workspaceId: repoState.projectPath,
      repositoryId: repoState.projectPath,
      text: feature,
      queryType: 'UNKNOWN',
      filters: { limit: 15 },
      timestamp: Date.now(),
    });

    // 2. Discover verified files that exist on disk
    const verifiedFileSet = new Set<string>();
    const keySymbols: string[] = [];
    const evidence: string[] = [];

    for (const m of matches) {
      const relPath =
        (m.metadata?.['filePath'] as string) ??
        m.contentReference ??
        m.resourceId.split('#')[0]!;
      const fullPath = path.resolve(repoState.projectPath, relPath);
      if (fs.existsSync(fullPath)) {
        verifiedFileSet.add(relPath);
      }
      if (m.name && !keySymbols.includes(m.name)) {
        keySymbols.push(m.name);
      }
      if (m.evidence.length > 0) {
        evidence.push(...m.evidence);
      }
    }

    const verifiedFiles = Array.from(verifiedFileSet);

    // 3. Inspect existing .projectmind documents if present
    let docArchitectureSummary = '';
    const wsManager = new WorkspaceManager(projectPath);
    if (wsManager.validateWorkspace()) {
      const archPath = wsManager.getFilePath('ARCHITECTURE.md');
      if (fs.existsSync(archPath)) {
        try {
          const archContent = fs.readFileSync(archPath, 'utf8');
          if (archContent.toLowerCase().includes(feature.toLowerCase())) {
            docArchitectureSummary = `Found documented architecture reference in .projectmind/ARCHITECTURE.md`;
          }
        } catch {
          // Ignore
        }
      }
    }

    const summary =
      verifiedFiles.length > 0
        ? `Feature '${feature}' is implemented across ${verifiedFiles.length} verified code resource(s) with ${keySymbols.length} core symbol(s).`
        : `Feature '${feature}' has no verified source references matching this keyword in the repository.`;

    const resultPayload = {
      projectPath: repoState.projectPath,
      feature,
      found: verifiedFiles.length > 0,
      summary,
      verifiedFiles,
      keySymbols,
      architectureNotes: docArchitectureSummary || 'Deterministic AST-grounded analysis.',
      evidence: Array.from(new Set(evidence)),
    };

    const lines: string[] = [
      `### ProjectMind Feature Explanation: "${feature}"`,
      `**Repository:** \`${repoState.projectPath}\``,
      `**Status:** ${verifiedFiles.length > 0 ? 'Verified in Codebase' : 'Not Found'}`,
      '',
      `**Summary:** ${summary}`,
      '',
      `#### Verified Source Files:`,
      ...(verifiedFiles.length > 0
        ? verifiedFiles.map((f) => `- \`${f}\``)
        : ['- *None found*']),
      '',
      `#### Key Symbols:`,
      ...(keySymbols.length > 0
        ? keySymbols.map((s) => `- \`${s}\``)
        : ['- *None extracted*']),
    ];

    const rawOutput = `${lines.join('\n')}\n\n\`\`\`json\n${JSON.stringify(resultPayload, null, 2)}\n\`\`\``;
    const sanitizedOutput = SecuritySanitizer.redactSecrets(rawOutput);

    return {
      content: [
        {
          type: 'text',
          text: sanitizedOutput,
        },
      ],
      isError: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Tool 4: projectmind_impact_analysis
  // ---------------------------------------------------------------------------
  private async handleImpactAnalysis(
    args: Record<string, unknown> | undefined
  ): Promise<McpCallToolResult> {
    const { projectPath, target, changeDescription } = this.validateImpactParams(args);
    const repoState = await this.getOrBuildRepoIndex(projectPath);

    // Resolve target to relative path or symbol
    let resolvedTargetRel = target.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    const isDirectPath = repoState.fileList.some(
      (f) => f.toLowerCase() === resolvedTargetRel.toLowerCase()
    );

    let matchingSymbolChunks: SemanticChunk[] = [];
    if (!isDirectPath) {
      matchingSymbolChunks = repoState.chunks.filter(
        (c) => c.name.toLowerCase() === target.toLowerCase() || c.symbolName?.toLowerCase() === target.toLowerCase()
      );
      if (matchingSymbolChunks.length > 0) {
        resolvedTargetRel = matchingSymbolChunks[0]!.resourceId.replace(/\\/g, '/');
      }
    }

    const targetBaseName = path.basename(resolvedTargetRel, path.extname(resolvedTargetRel));
    const directlyAffectedFiles: string[] = [];
    const downstreamAffectedFiles: string[] = [];
    const evidence: string[] = [];

    // Scan source files for import or reference linkages
    for (const rawRelFile of repoState.fileList) {
      const relFile = rawRelFile.replace(/\\/g, '/');
      if (relFile.toLowerCase() === resolvedTargetRel.toLowerCase()) continue;

      const fullFile = path.resolve(repoState.projectPath, relFile);
      try {
        const content = fs.readFileSync(fullFile, 'utf8');

        // Check if content imports target by relative path or symbol
        const importPattern = new RegExp(
          `from\\s+['"][^'"]*${targetBaseName}(?:\\.[a-z0-9]+)?['"]|require\\(['"][^'"]*${targetBaseName}(?:\\.[a-z0-9]+)?['"]\\)`,
          'i'
        );
        const symbolPattern = new RegExp(`\\b${targetBaseName}\\b`);

        if (importPattern.test(content)) {
          directlyAffectedFiles.push(relFile);
          evidence.push(`Direct import of '${targetBaseName}' found in \`${relFile}\``);
        } else if (symbolPattern.test(content)) {
          downstreamAffectedFiles.push(relFile);
          evidence.push(`Symbol reference '${targetBaseName}' found in \`${relFile}\``);
        }
      } catch {
        // Skip unreadable files
      }
    }

    const totalAffected = directlyAffectedFiles.length + downstreamAffectedFiles.length;
    const blastRadiusScore = Math.min(100, Math.round((totalAffected / Math.max(1, repoState.fileList.length)) * 100));

    let riskAssessment: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (blastRadiusScore > 35 || directlyAffectedFiles.length >= 5) {
      riskAssessment = 'HIGH';
    } else if (blastRadiusScore > 10 || directlyAffectedFiles.length >= 2) {
      riskAssessment = 'MEDIUM';
    }

    const resultPayload = {
      projectPath: repoState.projectPath,
      target,
      targetFile: resolvedTargetRel,
      changeDescription: changeDescription ?? 'Unspecified change',
      directlyAffectedFiles,
      downstreamAffectedFiles,
      affectedSymbols: matchingSymbolChunks.map((c) => c.name),
      blastRadiusScore,
      riskAssessment,
      evidence,
      analyzedAt: new Date().toISOString(),
    };

    const lines: string[] = [
      `### ProjectMind Impact Analysis for: "${target}"`,
      `**Target Resource:** \`${resolvedTargetRel}\``,
      `**Risk Assessment:** **${riskAssessment}** (Blast Radius: ${blastRadiusScore}/100)`,
      changeDescription ? `**Proposed Change:** ${changeDescription}` : '',
      '',
      `#### Directly Affected Files (${directlyAffectedFiles.length}):`,
      ...(directlyAffectedFiles.length > 0
        ? directlyAffectedFiles.map((f) => `- \`${f}\``)
        : ['- *None detected*']),
      '',
      `#### Downstream Affected Files (${downstreamAffectedFiles.length}):`,
      ...(downstreamAffectedFiles.length > 0
        ? downstreamAffectedFiles.map((f) => `- \`${f}\``)
        : ['- *None detected*']),
      '',
      `#### Evidence:`,
      ...(evidence.length > 0 ? evidence.slice(0, 10).map((e) => `- ${e}`) : ['- *No dependent linkages*']),
    ].filter(Boolean);

    const rawOutput = `${lines.join('\n')}\n\n\`\`\`json\n${JSON.stringify(resultPayload, null, 2)}\n\`\`\``;
    const sanitizedOutput = SecuritySanitizer.redactSecrets(rawOutput);

    return {
      content: [
        {
          type: 'text',
          text: sanitizedOutput,
        },
      ],
      isError: false,
    };
  }

  // ---------------------------------------------------------------------------
  // Indexing & Repository Resolution
  // ---------------------------------------------------------------------------
  private async getOrBuildRepoIndex(projectPath: string): Promise<RepoIndexState> {
    const resolvedPath = this.validateAndNormalizePath(projectPath);

    const cached = this.indexCache.get(resolvedPath);
    if (cached && Date.now() - cached.indexedAt < 60000) {
      return cached;
    }

    // Discover repository source files
    const fileList = this.discoverFiles(resolvedPath);
    const embeddingProvider = new LocalSemanticEmbeddingProvider();
    const semanticIndex = new SemanticIndex();
    const allChunks: SemanticChunk[] = [];

    for (const relFile of fileList.slice(0, this.maxIndexedFiles)) {
      const fullPath = path.resolve(resolvedPath, relFile);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const chunks = SemanticChunker.chunkSourceFile(relFile, content);

        for (const chunk of chunks) {
          allChunks.push(chunk);
          const textToEmbed = `${chunk.name} ${chunk.content}`;
          const embedding = await embeddingProvider.embedText(textToEmbed);

          await semanticIndex.index({
            resourceId: chunk.chunkId,
            contentReference: chunk.resourceId,
            resourceType: chunk.resourceType,
            workspaceId: resolvedPath,
            repositoryId: resolvedPath,
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
      } catch {
        // Skip unreadable files
      }
    }

    const retrievalEngine = new HybridRetrievalEngine(semanticIndex, embeddingProvider);
    const repoState: RepoIndexState = {
      projectPath: resolvedPath,
      indexedAt: Date.now(),
      filesIndexed: fileList.length,
      semanticIndex,
      embeddingProvider,
      retrievalEngine,
      fileList,
      chunks: allChunks,
    };

    this.indexCache.set(resolvedPath, repoState);
    return repoState;
  }

  private discoverFiles(root: string): string[] {
    const IGNORED_DIRS = new Set([
      'node_modules',
      '.git',
      'dist',
      'build',
      'out',
      'coverage',
      '.projectmind',
      '.venv',
      'venv',
      '__pycache__',
      '.idea',
      '.vscode',
      '.next',
      '.nuxt',
    ]);

    const ALLOWED_EXTS = new Set([
      '.ts',
      '.js',
      '.mjs',
      '.cjs',
      '.json',
      '.md',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.rb',
      '.php',
    ]);

    const results: string[] = [];

    const walk = (currentDir: string, relDir: string = '') => {
      if (results.length >= this.maxIndexedFiles) return;

      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.projectmind') {
          continue;
        }

        if (entry.isDirectory()) {
          if (!IGNORED_DIRS.has(entry.name)) {
            walk(path.join(currentDir, entry.name), path.join(relDir, entry.name));
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ALLOWED_EXTS.has(ext)) {
            const relPath = path.join(relDir, entry.name).replace(/\\/g, '/');
            results.push(relPath);
          }
        }
      }
    };

    walk(root);
    return results;
  }

  private validateAndNormalizePath(inputPath: unknown): string {
    if (typeof inputPath !== 'string' || !inputPath.trim()) {
      throw new McpError(
        "Missing required 'projectPath' argument. Must be a valid absolute directory path.",
        McpErrorCodes.INVALID_PARAMS
      );
    }

    McpSecurityValidator.validatePathSafety(inputPath, 'projectPath');

    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      throw new McpError(
        `Repository path does not exist on disk: '${resolved}'`,
        McpErrorCodes.INVALID_PARAMS,
        { projectPath: resolved }
      );
    }

    try {
      const stats = fs.statSync(resolved);
      if (!stats.isDirectory()) {
        throw new McpError(
          `Repository path is not a directory: '${resolved}'`,
          McpErrorCodes.INVALID_PARAMS,
          { projectPath: resolved }
        );
      }
    } catch (err: unknown) {
      if (err instanceof McpError) throw err;
      throw new McpError(
        `Failed to access repository path: '${resolved}'`,
        McpErrorCodes.INTERNAL_ERROR
      );
    }

    return resolved;
  }

  private validateContextParams(args: Record<string, unknown> | undefined): {
    projectPath: string;
    taskText: string;
    maxFiles: number;
  } {
    if (!args) {
      throw new McpError('Missing arguments for projectmind_get_context', McpErrorCodes.INVALID_PARAMS);
    }

    const projectPath = String(args['projectPath'] ?? '');
    const taskText = String(args['task'] ?? args['taskId'] ?? '').trim();

    if (!taskText) {
      throw new McpError("Missing required 'task' argument", McpErrorCodes.INVALID_PARAMS);
    }

    let maxFiles = 10;
    if (args['maxFiles'] !== undefined) {
      const parsed = Number(args['maxFiles']);
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        throw new McpError(
          "Invalid 'maxFiles' argument. Must be an integer between 1 and 50.",
          McpErrorCodes.INVALID_PARAMS
        );
      }
      maxFiles = Math.floor(parsed);
    }

    return { projectPath, taskText, maxFiles };
  }

  private validateSearchParams(args: Record<string, unknown> | undefined): {
    projectPath: string;
    query: string;
    limit: number;
  } {
    if (!args) {
      throw new McpError('Missing arguments for projectmind_search', McpErrorCodes.INVALID_PARAMS);
    }

    const projectPath = String(args['projectPath'] ?? '');
    const query = String(args['query'] ?? '').trim();

    if (!query) {
      throw new McpError("Missing required 'query' argument", McpErrorCodes.INVALID_PARAMS);
    }

    let limit = 10;
    if (args['limit'] !== undefined) {
      const parsed = Number(args['limit']);
      if (isNaN(parsed) || parsed < 1 || parsed > 50) {
        throw new McpError(
          "Invalid 'limit' argument. Must be an integer between 1 and 50.",
          McpErrorCodes.INVALID_PARAMS
        );
      }
      limit = Math.floor(parsed);
    }

    return { projectPath, query, limit };
  }

  private validateFeatureParams(args: Record<string, unknown> | undefined): {
    projectPath: string;
    feature: string;
  } {
    if (!args) {
      throw new McpError('Missing arguments for projectmind_explain_feature', McpErrorCodes.INVALID_PARAMS);
    }

    const projectPath = String(args['projectPath'] ?? '');
    const feature = String(args['feature'] ?? args['featureId'] ?? '').trim();

    if (!feature) {
      throw new McpError("Missing required 'feature' argument", McpErrorCodes.INVALID_PARAMS);
    }

    return { projectPath, feature };
  }

  private validateImpactParams(args: Record<string, unknown> | undefined): {
    projectPath: string;
    target: string;
    changeDescription?: string | undefined;
  } {
    if (!args) {
      throw new McpError('Missing arguments for projectmind_impact_analysis', McpErrorCodes.INVALID_PARAMS);
    }

    const projectPath = String(args['projectPath'] ?? '');
    const target = String(args['target'] ?? args['featureId'] ?? '').trim();

    if (!target) {
      throw new McpError("Missing required 'target' argument", McpErrorCodes.INVALID_PARAMS);
    }

    const changeDescription =
      typeof args['changeDescription'] === 'string' ? args['changeDescription'].trim() : undefined;

    return { projectPath, target, changeDescription };
  }
}
