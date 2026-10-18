export interface StorageHealth {
  providerName: string;
  isHealthy: boolean;
  databaseName?: string | undefined;
  integrityCheckPassed?: boolean | undefined;
  foreignKeyCheckPassed?: boolean | undefined;
  currentVersion?: number | string | undefined;
  message?: string | undefined;
  lastCheckTimestamp: string;
  latencyMs?: number | undefined;
  errors?: string[] | undefined;
  details?: Record<string, unknown> | undefined;
}
