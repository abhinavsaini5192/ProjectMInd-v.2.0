import type { IRetrievalEngine } from '../interfaces/IRetrievalEngine.js';
import type { IEmbeddingProvider } from '../interfaces/IEmbeddingProvider.js';
import type { ISemanticIndex } from '../interfaces/ISemanticIndex.js';
import type { IRetrievalRanker } from '../interfaces/IRetrievalEngine.js';
import type { IProjectMemoryStore } from '../../memory/project/interfaces/IProjectMemoryStore.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { IFeatureRepository } from '../../knowledge/features/interfaces/IFeatureRepository.js';
import type { SemanticQuery } from '../models/SemanticQuery.js';
import type { RetrievalResult } from '../models/RetrievalResult.js';
import { HybridRetrievalRanker } from '../ranking/HybridRetrievalRanker.js';

export class HybridRetrievalEngine implements IRetrievalEngine {
  private readonly ranker: IRetrievalRanker;

  constructor(
    private readonly semanticIndex?: ISemanticIndex | undefined,
    private readonly embeddingProvider?: IEmbeddingProvider | undefined,
    private readonly memoryStore?: IProjectMemoryStore | undefined,
    private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined,
    private readonly featureRepository?: IFeatureRepository | undefined,
    ranker?: IRetrievalRanker | undefined
  ) {
    this.ranker = ranker ?? new HybridRetrievalRanker();
  }

  public async retrieve(query: SemanticQuery): Promise<RetrievalResult[]> {
    const candidateList: RetrievalResult[] = [];

    // ==========================================
    // PATH A: DETERMINISTIC RETRIEVAL
    // ==========================================

    // 1. Structured Feature Knowledge
    if (this.featureRepository) {
      try {
        const matchingFeatures = await this.featureRepository.findByName(query.text, query.repositoryId);
        for (const feat of matchingFeatures) {
          candidateList.push({
            candidateId: `cand_feat_${feat.id}`,
            resourceId: feat.id,
            resourceType: 'FEATURE',
            name: feat.name,
            snippet: feat.description,
            source: 'FEATURE_KNOWLEDGE',
            score: 0.9,
            dimensions: {
              lexicalRelevance: 0.8,
              semanticRelevance: 0.8,
              featureRelevance: 1.0,
              graphRelevance: 0.9,
              taskRelevance: 0.8,
              recency: 0.8,
              confidence: 0.95,
              sourceAuthority: 0.85,
              scopeRelevance: 1.0,
              verificationRelevance: 0.5,
            },
            authority: 'VERIFIED_PROJECT_DECISIONS',
            confidence: 0.95,
            evidence: [`Authoritative feature definition: ${feat.name}`],
            metadata: {
              featureId: feat.id,
              tags: feat.metadata?.tags,
              projectId: query.projectId,
            },
          });
        }
      } catch (err) {
        // Safe continuation
      }
    }

    // 2. Project Memory (Decisions, Architecture, Migrations)
    if (this.memoryStore) {
      try {
        const memories = await this.memoryStore.find({
          repositoryId: query.repositoryId,
          workspaceId: query.workspaceId,
          projectId: query.projectId,
          status: ['ACTIVE'],
          validAt: query.filters?.validAt ?? query.timestamp,
        });

        const queryWords = query.text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
        for (const mem of memories) {
          const memText = `${mem.title} ${mem.content}`.toLowerCase();
          const matchWord = queryWords.length > 0 && queryWords.some((w) => memText.includes(w));

          if (matchWord) {
            candidateList.push({
              candidateId: `cand_mem_${mem.memoryId}`,
              resourceId: mem.memoryId,
              resourceType: 'PROJECT_MEMORY',
              name: mem.title,
              snippet: mem.content,
              source: 'PROJECT_MEMORY',
              score: 0.85,
              dimensions: {
                lexicalRelevance: 0.8,
                semanticRelevance: 0.7,
                featureRelevance: 0.7,
                graphRelevance: 0.6,
                taskRelevance: 0.8,
                recency: 0.9,
                confidence: mem.confidence,
                sourceAuthority: mem.authority === 'AUTHORITATIVE' ? 0.85 : 0.6,
                scopeRelevance: 1.0,
                verificationRelevance: 0.5,
              },
              authority:
                mem.authority === 'AUTHORITATIVE'
                  ? 'VERIFIED_PROJECT_DECISIONS'
                  : 'DERIVED_INTELLIGENCE',
              confidence: mem.confidence,
              evidence: [`Project memory entry: ${mem.title}`, ...mem.evidence],
              metadata: {
                memoryId: mem.memoryId,
                type: mem.type,
                provenance: mem.provenance,
                projectId: mem.projectId,
                relatedResources: mem.relatedResources,
              },
            });
          }
        }
      } catch (err) {
        // Safe continuation
      }
    }

    // ==========================================
    // PATH B: SEMANTIC RETRIEVAL
    // ==========================================
    if (this.semanticIndex && this.embeddingProvider) {
      try {
        const queryVector = await this.embeddingProvider.embedText(query.text);
        const candidateLimit = Math.min(100, Math.max(30, (query.filters?.limit ?? 15) * 3));
        const searchResults = await this.semanticIndex.search(queryVector, {
          workspaceId: query.workspaceId,
          projectId: query.projectId,
          repositoryId: query.repositoryId,
          minScore: query.filters?.minScore ?? 0.15,
          limit: candidateLimit,
          queryText: query.text,
        });

        for (const res of searchResults) {
          // Avoid duplicate candidate IDs if already added deterministically
          const existingIndex = candidateList.findIndex((c) => c.resourceId === res.entry.resourceId);
          if (existingIndex !== -1) {
            const existing = candidateList[existingIndex]!;
            candidateList[existingIndex] = {
              ...existing,
              dimensions: {
                ...existing.dimensions,
                semanticRelevance: res.similarityScore,
              },
              evidence: [...existing.evidence, `Semantic similarity: ${Math.round(res.similarityScore * 100)}%`],
            };
          } else {
            candidateList.push({
              candidateId: `cand_sem_${res.entry.resourceId}`,
              resourceId: res.entry.resourceId,
              resourceType: res.entry.resourceType,
              name: res.entry.title,
              snippet: res.entry.snippet,
              contentReference: res.entry.contentReference,
              source: 'SEMANTIC_INDEX',
              score: res.similarityScore,
              dimensions: {
                lexicalRelevance: 0.5,
                semanticRelevance: res.similarityScore,
                featureRelevance: 0.5,
                graphRelevance: 0.5,
                taskRelevance: 0.6,
                recency: 0.8,
                confidence: 0.8,
                sourceAuthority: 0.40, // Semantic retrieval has lower authority than verified repository facts
                scopeRelevance: 1.0,
                verificationRelevance: 0.5,
              },
              authority: 'SEMANTIC_RETRIEVAL',
              confidence: 0.8,
              evidence: [
                `Semantic vector match (cosine similarity: ${Math.round(res.similarityScore * 100)}%)`,
              ],
              metadata: {
                embeddingVersion: res.entry.embeddingVersion,
                sourceVersion: res.entry.sourceVersion,
                projectId: res.entry.projectId,
                ...res.entry.metadata,
              },
            });
          }
        }
      } catch (err) {
        // Safe offline / fallback: deterministic results remain intact
      }
    }

    // ==========================================
    // HYBRID MERGE & MULTI-DIMENSIONAL RANKING
    // ==========================================
    return this.ranker.rank(candidateList, query);
  }
}
