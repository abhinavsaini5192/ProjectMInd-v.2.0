export interface EmbeddingMetadata {
  readonly modelIdentifier: string;
  readonly dimension: number;
  readonly version: string;
  readonly providerName: string;
  readonly createdAt: number;
  readonly isNeural?: boolean;
  readonly algorithm?: string;
}

export interface IEmbeddingProvider {
  readonly metadata: EmbeddingMetadata;

  embedText(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
