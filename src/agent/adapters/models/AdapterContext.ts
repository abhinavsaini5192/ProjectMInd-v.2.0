export type AdapterContextFormat =
  | 'STRUCTURED_JSON'
  | 'MARKDOWN'
  | 'XML_TAGGED'
  | 'RAW';

export interface AdapterContext {
  readonly format: AdapterContextFormat;
  readonly content: unknown;
  readonly knowledgeVersion?: string | undefined;
  readonly freshness?: string | undefined;
  readonly confidence?: number | undefined;
  readonly completeness?: string | undefined;
  readonly warnings: readonly string[];
  readonly featureIds: readonly string[];
  readonly resourcePaths: readonly string[];
  readonly metadata: Record<string, unknown>;
}
