export interface StorageStatistics {
  providerName: string;
  databaseName?: string | undefined;
  totalReads: number;
  totalWrites: number;
  tableCount?: number | undefined;
  indexCount?: number | undefined;
  pageCount?: number | undefined;
  pageSize?: number | undefined;
  averageLatencyMs: number;
  uptimeMs: number;
  activeConnections: number;
  errorCount: number;
  lastErrorTimestamp?: string | undefined;
  bytesStored?: number | undefined;
  walSize?: number | undefined;
  details?: Record<string, unknown> | undefined;
}
