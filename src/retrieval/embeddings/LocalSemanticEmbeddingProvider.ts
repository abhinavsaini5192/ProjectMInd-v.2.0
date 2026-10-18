import type { IEmbeddingProvider, EmbeddingMetadata } from '../interfaces/IEmbeddingProvider.js';

export class LocalSemanticEmbeddingProvider implements IEmbeddingProvider {
  public readonly metadata: EmbeddingMetadata;

  constructor(dimension: number = 384, version: string = '1.0.0') {
    this.metadata = {
      modelIdentifier: 'projectmind-local-semantic-v1',
      dimension,
      version,
      providerName: 'LOCAL_DETERMINISTIC',
      createdAt: Date.now(),
      isNeural: false,
      algorithm: 'FNV-1a 32-bit character 3-gram feature hashing',
    };
  }

  public async embedText(text: string): Promise<number[]> {
    const dim = this.metadata.dimension;
    const vector = new Array<number>(dim).fill(0);

    const normalized = text.toLowerCase().trim();
    if (normalized.length === 0) {
      return vector;
    }

    // Tokenize into words and character 3-grams for semantic and morphological matching
    const words = normalized.split(/\W+/).filter((w) => w.length > 1);
    const tokens: string[] = [...words];

    for (const w of words) {
      if (w.length >= 4) {
        for (let i = 0; i <= w.length - 3; i++) {
          tokens.push(w.substring(i, i + 3));
        }
      }
    }

    // Hash tokens into vector coordinates using 32-bit FNV-1a hash
    for (const token of tokens) {
      let hash = 2166136261;
      for (let i = 0; i < token.length; i++) {
        hash ^= token.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
      const index = Math.abs(hash) % dim;
      const sign = (hash & 1) === 0 ? 1.0 : -1.0;
      vector[index] += sign;
    }

    // Normalize to unit L2 norm
    let sumSq = 0;
    for (let i = 0; i < dim; i++) {
      sumSq += vector[i] * vector[i];
    }

    if (sumSq > 0) {
      const norm = Math.sqrt(sumSq);
      for (let i = 0; i < dim; i++) {
        vector[i] = Math.round((vector[i] / norm) * 100000) / 100000;
      }
    }

    return vector;
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const text of texts) {
      results.push(await this.embedText(text));
    }
    return results;
  }

  public static cosineSimilarity(a: readonly number[], b: readonly number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    const sim = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.round(Math.max(-1.0, Math.min(1.0, sim)) * 10000) / 10000;
  }
}
