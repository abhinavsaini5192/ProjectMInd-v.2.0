export interface ContextVersion {
  packageVersion: string;
  knowledgeVersion: string;
  modelVersion?: string | undefined;
  generationTimestamp?: number | undefined;
  isConsistent: boolean;
  mismatchedSubsystems: string[];
}
