export interface FeatureKnowledgeErrorInfo {
  code: string;
  message: string;
  subsystem?: string | undefined;
  retryable?: boolean | undefined;
  details?: Record<string, any> | undefined;
}
