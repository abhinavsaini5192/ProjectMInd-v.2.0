import { z } from 'zod';

export type EnvironmentName = 'development' | 'test' | 'production';

export const AppConfigSchema = z.object({
  name: z.string().min(1).default('projectmind'),
  version: z.string().min(1).default('1.0.0'),
  env: z.enum(['development', 'test', 'production']).default('development'),
  logLevel: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']).default('INFO'),
});

export const RuntimeConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxConcurrentSessions: z.number().int().positive().default(10),
  maxConcurrentTasks: z.number().int().positive().default(20),
  sessionTimeoutMs: z.number().int().positive().default(3600000), // 1 hour
  taskTimeoutMs: z.number().int().positive().default(1800000),    // 30 minutes
  toolTimeoutMs: z.number().int().positive().default(30000),      // 30 seconds
  contextTimeoutMs: z.number().int().positive().default(30000),   // 30 seconds
  recoveryTimeoutMs: z.number().int().positive().default(60000),  // 1 minute
  shutdownTimeoutMs: z.number().int().positive().default(15000),  // 15 seconds
  contextRefreshPolicy: z.enum(['IMMEDIATE', 'ON_NEXT_REQUEST', 'LAZY', 'MANUAL']).default('ON_NEXT_REQUEST'),
});

export const StorageConfigSchema = z.object({
  type: z.enum(['memory', 'sqlite', 'filesystem']).default('memory'),
  location: z.string().min(1).default('.projectmind/data'),
  databaseUrl: z.string().optional(),
  maxPayloadSizeBytes: z.number().int().positive().default(10 * 1024 * 1024), // 10MB
});

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['memory', 'sqlite', 'redis']).default('memory'),
  maxCacheSizeMb: z.number().int().positive().default(1024),
  ttlMs: z.number().int().positive().default(3600000),
});

export const ObservabilityConfigSchema = z.object({
  logFormat: z.enum(['json', 'pretty']).default('json'),
  telemetryEnabled: z.boolean().default(true),
  metricsEnabled: z.boolean().default(true),
  secretRedactionEnabled: z.boolean().default(true),
});

export const AgentPlatformConfigSchema = z.object({
  runtimeEnabled: z.boolean().default(true),
  adaptersEnabled: z.boolean().default(true),
  defaultAdapterId: z.string().optional(),
});

export const SecurityConfigSchema = z.object({
  allowUnsafeDevDefaults: z.boolean().default(false),
  authMode: z.enum(['none', 'token', 'mtls']).default('none'),
  masterKey: z.string().optional(),
});

export const ServerConfigSchema = z.object({
  port: z.number().int().min(0).max(65535).default(3000),
  host: z.string().min(1).default('0.0.0.0'),
  corsOrigins: z.array(z.string()).default(['*']),
  tlsEnabled: z.boolean().default(false),
  requestTimeoutMs: z.number().int().positive().default(30000),
  drainTimeoutMs: z.number().int().positive().default(10000),
});

export const WorkerDeploymentConfigSchema = z.object({
  concurrency: z.number().int().positive().default(5),
  pollIntervalMs: z.number().int().positive().default(250),
  visibilityTimeoutMs: z.number().int().positive().default(30000),
  leaseRenewalIntervalMs: z.number().int().positive().default(10000),
});

export const DatabaseConfigSchema = z.object({
  url: z.string().optional(),
  walMode: z.boolean().default(true),
  busyTimeoutMs: z.number().int().positive().default(5000),
  autoMigrate: z.boolean().default(true),
});

export const RedisConfigSchema = z.object({
  enabled: z.boolean().default(false),
  url: z.string().optional(),
  keyPrefix: z.string().default('projectmind:'),
  connectTimeoutMs: z.number().int().positive().default(5000),
});

export const DeploymentRoleSchema = z.enum(['api', 'worker', 'scheduler', 'migration', 'all']).default('all');

export const PlatformConfigSchema = z.object({
  app: AppConfigSchema.default({
    name: 'projectmind',
    version: '1.0.0',
    env: 'development',
    logLevel: 'INFO',
  }),
  role: DeploymentRoleSchema.default('all'),
  server: ServerConfigSchema.default({
    port: 3000,
    host: '0.0.0.0',
    corsOrigins: ['*'],
    tlsEnabled: false,
    requestTimeoutMs: 30000,
    drainTimeoutMs: 10000,
  }),
  worker: WorkerDeploymentConfigSchema.default({
    concurrency: 5,
    pollIntervalMs: 250,
    visibilityTimeoutMs: 30000,
    leaseRenewalIntervalMs: 10000,
  }),
  database: DatabaseConfigSchema.default({
    walMode: true,
    busyTimeoutMs: 5000,
    autoMigrate: true,
  }),
  redis: RedisConfigSchema.default({
    enabled: false,
    keyPrefix: 'projectmind:',
    connectTimeoutMs: 5000,
  }),
  runtime: RuntimeConfigSchema.default({
    enabled: true,
    maxConcurrentSessions: 10,
    maxConcurrentTasks: 20,
    sessionTimeoutMs: 3600000,
    taskTimeoutMs: 1800000,
    toolTimeoutMs: 30000,
    contextTimeoutMs: 30000,
    recoveryTimeoutMs: 60000,
    shutdownTimeoutMs: 15000,
    contextRefreshPolicy: 'ON_NEXT_REQUEST',
  }),
  storage: StorageConfigSchema.default({
    type: 'memory',
    location: '.projectmind/data',
    maxPayloadSizeBytes: 10 * 1024 * 1024,
  }),
  cache: CacheConfigSchema.default({
    enabled: true,
    type: 'memory',
    maxCacheSizeMb: 1024,
    ttlMs: 3600000,
  }),
  observability: ObservabilityConfigSchema.default({
    logFormat: 'json',
    telemetryEnabled: true,
    metricsEnabled: true,
    secretRedactionEnabled: true,
  }),
  agent: AgentPlatformConfigSchema.default({
    runtimeEnabled: true,
    adaptersEnabled: true,
  }),
  security: SecurityConfigSchema.default({
    allowUnsafeDevDefaults: false,
    authMode: 'none',
  }),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
export type DeploymentRole = z.infer<typeof DeploymentRoleSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type WorkerDeploymentConfig = z.infer<typeof WorkerDeploymentConfigSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type RuntimeConfig = z.infer<typeof RuntimeConfigSchema>;
export type StorageConfig = z.infer<typeof StorageConfigSchema>;
export type CacheConfig = z.infer<typeof CacheConfigSchema>;
export type ObservabilityConfig = z.infer<typeof ObservabilityConfigSchema>;
export type AgentPlatformConfig = z.infer<typeof AgentPlatformConfigSchema>;
export type SecurityConfig = z.infer<typeof SecurityConfigSchema>;
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
      ? readonly DeepPartial<U>[]
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P];
};

export type PlatformConfigOverrides = DeepPartial<PlatformConfig>;

