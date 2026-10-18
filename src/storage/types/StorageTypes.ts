export enum StorageProviderType {
  Registry = 'registry',
  Knowledge = 'knowledge',
  Memory = 'memory',
  Vector = 'vector',
  Cache = 'cache',
  Filesystem = 'filesystem',
  Metadata = 'metadata',
  Settings = 'settings'
}

export enum ProviderState {
  Unregistered = 'Unregistered',
  Registered = 'Registered',
  Initializing = 'Initializing',
  Ready = 'Ready',
  Failed = 'Failed',
  Stopped = 'Stopped'
}
