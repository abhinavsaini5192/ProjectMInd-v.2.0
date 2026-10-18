export interface StorageConfiguration {
  connectionString?: string | undefined;
  maxConnections?: number | undefined;
  timeoutMs?: number | undefined;
  enableCache?: boolean | undefined;
  readOnly?: boolean | undefined;
  workspaceId?: string | undefined;
  storageRoot?: string | undefined;
  encryptionEnabled?: boolean | undefined;
  databasePath?: string | undefined;
  options?: Record<string, any> | undefined;
}
