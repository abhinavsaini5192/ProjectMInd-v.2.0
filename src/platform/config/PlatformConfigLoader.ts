import type { PlatformConfig, PlatformConfigOverrides, EnvironmentName } from './PlatformConfig.js';
import { PlatformConfigValidator } from './PlatformConfigValidator.js';

export class PlatformConfigLoader {
  public static load(overrides?: PlatformConfigOverrides | undefined): PlatformConfig {
    const env = process.env;

    const envName: EnvironmentName =
      (env['PROJECTMIND_ENV'] as EnvironmentName) ||
      overrides?.app?.env ||
      (env['NODE_ENV'] as EnvironmentName) ||
      'development';

    const rawFromEnv: Record<string, any> = {
      app: {
        name: overrides?.app?.name ?? env['PROJECTMIND_APP_NAME'],
        version: overrides?.app?.version ?? env['PROJECTMIND_APP_VERSION'],
        env: envName,
        logLevel: overrides?.app?.logLevel ?? env['PROJECTMIND_LOG_LEVEL'],
      },
      role: overrides?.role ?? env['PROJECTMIND_ROLE'] ?? env['PROJECTMIND_RUNTIME_ROLE'],
      server: {
        port: overrides?.server?.port ?? (env['PORT'] ? parseInt(env['PORT'], 10) : (env['PROJECTMIND_PORT'] ? parseInt(env['PROJECTMIND_PORT'], 10) : undefined)),
        host: overrides?.server?.host ?? env['PROJECTMIND_HOST'] ?? env['HOST'],
        corsOrigins: overrides?.server?.corsOrigins ?? (env['PROJECTMIND_CORS_ORIGINS'] ? env['PROJECTMIND_CORS_ORIGINS'].split(',').map((s) => s.trim()) : undefined),
        tlsEnabled: overrides?.server?.tlsEnabled !== undefined
          ? overrides.server.tlsEnabled
          : (env['PROJECTMIND_TLS_ENABLED'] !== undefined ? env['PROJECTMIND_TLS_ENABLED'] === 'true' : undefined),
        requestTimeoutMs: overrides?.server?.requestTimeoutMs ?? (env['PROJECTMIND_REQUEST_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_REQUEST_TIMEOUT_MS'], 10) : undefined),
        drainTimeoutMs: overrides?.server?.drainTimeoutMs ?? (env['PROJECTMIND_DRAIN_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_DRAIN_TIMEOUT_MS'], 10) : undefined),
      },
      worker: {
        concurrency: overrides?.worker?.concurrency ?? (env['PROJECTMIND_WORKER_CONCURRENCY'] ? parseInt(env['PROJECTMIND_WORKER_CONCURRENCY'], 10) : undefined),
        pollIntervalMs: overrides?.worker?.pollIntervalMs ?? (env['PROJECTMIND_POLL_INTERVAL_MS'] ? parseInt(env['PROJECTMIND_POLL_INTERVAL_MS'], 10) : undefined),
        visibilityTimeoutMs: overrides?.worker?.visibilityTimeoutMs ?? (env['PROJECTMIND_VISIBILITY_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_VISIBILITY_TIMEOUT_MS'], 10) : undefined),
        leaseRenewalIntervalMs: overrides?.worker?.leaseRenewalIntervalMs ?? (env['PROJECTMIND_LEASE_RENEWAL_INTERVAL_MS'] ? parseInt(env['PROJECTMIND_LEASE_RENEWAL_INTERVAL_MS'], 10) : undefined),
      },
      database: {
        url: overrides?.database?.url ?? env['PROJECTMIND_DATABASE_URL'] ?? env['DATABASE_URL'],
        walMode: overrides?.database?.walMode !== undefined
          ? overrides.database.walMode
          : (env['PROJECTMIND_DATABASE_WAL'] !== undefined ? env['PROJECTMIND_DATABASE_WAL'] === 'true' : undefined),
        busyTimeoutMs: overrides?.database?.busyTimeoutMs ?? (env['PROJECTMIND_DATABASE_BUSY_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_DATABASE_BUSY_TIMEOUT_MS'], 10) : undefined),
        autoMigrate: overrides?.database?.autoMigrate !== undefined
          ? overrides.database.autoMigrate
          : (env['PROJECTMIND_AUTO_MIGRATE'] !== undefined ? env['PROJECTMIND_AUTO_MIGRATE'] === 'true' : undefined),
      },
      redis: {
        enabled: overrides?.redis?.enabled !== undefined
          ? overrides.redis.enabled
          : (env['PROJECTMIND_REDIS_ENABLED'] !== undefined ? env['PROJECTMIND_REDIS_ENABLED'] === 'true' : (env['REDIS_URL'] !== undefined ? true : undefined)),
        url: overrides?.redis?.url ?? env['PROJECTMIND_REDIS_URL'] ?? env['REDIS_URL'],
        keyPrefix: overrides?.redis?.keyPrefix ?? env['PROJECTMIND_REDIS_KEY_PREFIX'],
        connectTimeoutMs: overrides?.redis?.connectTimeoutMs ?? (env['PROJECTMIND_REDIS_CONNECT_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_REDIS_CONNECT_TIMEOUT_MS'], 10) : undefined),
      },
      runtime: {
        enabled: overrides?.runtime?.enabled !== undefined
          ? overrides.runtime.enabled
          : (env['PROJECTMIND_RUNTIME_ENABLED'] !== undefined ? env['PROJECTMIND_RUNTIME_ENABLED'] === 'true' : undefined),
        maxConcurrentSessions: overrides?.runtime?.maxConcurrentSessions ?? (env['PROJECTMIND_MAX_SESSIONS'] ? parseInt(env['PROJECTMIND_MAX_SESSIONS'], 10) : undefined),
        maxConcurrentTasks: overrides?.runtime?.maxConcurrentTasks ?? (env['PROJECTMIND_MAX_TASKS'] ? parseInt(env['PROJECTMIND_MAX_TASKS'], 10) : undefined),
        sessionTimeoutMs: overrides?.runtime?.sessionTimeoutMs ?? (env['PROJECTMIND_SESSION_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_SESSION_TIMEOUT_MS'], 10) : undefined),
        taskTimeoutMs: overrides?.runtime?.taskTimeoutMs ?? (env['PROJECTMIND_TASK_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_TASK_TIMEOUT_MS'], 10) : undefined),
        toolTimeoutMs: overrides?.runtime?.toolTimeoutMs ?? (env['PROJECTMIND_TOOL_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_TOOL_TIMEOUT_MS'], 10) : undefined),
        contextTimeoutMs: overrides?.runtime?.contextTimeoutMs ?? (env['PROJECTMIND_CONTEXT_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_CONTEXT_TIMEOUT_MS'], 10) : undefined),
        recoveryTimeoutMs: overrides?.runtime?.recoveryTimeoutMs ?? (env['PROJECTMIND_RECOVERY_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_RECOVERY_TIMEOUT_MS'], 10) : undefined),
        shutdownTimeoutMs: overrides?.runtime?.shutdownTimeoutMs ?? (env['PROJECTMIND_SHUTDOWN_TIMEOUT_MS'] ? parseInt(env['PROJECTMIND_SHUTDOWN_TIMEOUT_MS'], 10) : undefined),
        contextRefreshPolicy: overrides?.runtime?.contextRefreshPolicy ?? env['PROJECTMIND_CONTEXT_REFRESH_POLICY'],
      },
      storage: {
        type: overrides?.storage?.type ?? env['PROJECTMIND_STORAGE_TYPE'],
        location: overrides?.storage?.location ?? env['PROJECTMIND_STORAGE_LOCATION'],
        databaseUrl: overrides?.storage?.databaseUrl ?? env['PROJECTMIND_DATABASE_URL'],
        maxPayloadSizeBytes: overrides?.storage?.maxPayloadSizeBytes ?? (env['PROJECTMIND_MAX_PAYLOAD_BYTES'] ? parseInt(env['PROJECTMIND_MAX_PAYLOAD_BYTES'], 10) : undefined),
      },
      cache: {
        enabled: overrides?.cache?.enabled !== undefined
          ? overrides.cache.enabled
          : (env['PROJECTMIND_CACHE_ENABLED'] !== undefined ? env['PROJECTMIND_CACHE_ENABLED'] === 'true' : undefined),
        type: overrides?.cache?.type ?? env['PROJECTMIND_CACHE_TYPE'],
        maxCacheSizeMb: overrides?.cache?.maxCacheSizeMb ?? (env['PROJECTMIND_CACHE_MAX_MB'] ? parseInt(env['PROJECTMIND_CACHE_MAX_MB'], 10) : undefined),
        ttlMs: overrides?.cache?.ttlMs ?? (env['PROJECTMIND_CACHE_TTL_MS'] ? parseInt(env['PROJECTMIND_CACHE_TTL_MS'], 10) : undefined),
      },
      observability: {
        logFormat: overrides?.observability?.logFormat ?? env['PROJECTMIND_LOG_FORMAT'],
        telemetryEnabled: overrides?.observability?.telemetryEnabled !== undefined
          ? overrides.observability.telemetryEnabled
          : (env['PROJECTMIND_TELEMETRY_ENABLED'] !== undefined ? env['PROJECTMIND_TELEMETRY_ENABLED'] === 'true' : undefined),
        metricsEnabled: overrides?.observability?.metricsEnabled !== undefined
          ? overrides.observability.metricsEnabled
          : (env['PROJECTMIND_METRICS_ENABLED'] !== undefined ? env['PROJECTMIND_METRICS_ENABLED'] === 'true' : undefined),
        secretRedactionEnabled: overrides?.observability?.secretRedactionEnabled !== undefined
          ? overrides.observability.secretRedactionEnabled
          : (env['PROJECTMIND_SECRET_REDACTION_ENABLED'] !== undefined ? env['PROJECTMIND_SECRET_REDACTION_ENABLED'] === 'true' : undefined),
      },
      agent: {
        runtimeEnabled: overrides?.agent?.runtimeEnabled !== undefined
          ? overrides.agent.runtimeEnabled
          : (env['PROJECTMIND_AGENT_RUNTIME_ENABLED'] !== undefined ? env['PROJECTMIND_AGENT_RUNTIME_ENABLED'] === 'true' : undefined),
        adaptersEnabled: overrides?.agent?.adaptersEnabled !== undefined
          ? overrides.agent.adaptersEnabled
          : (env['PROJECTMIND_ADAPTERS_ENABLED'] !== undefined ? env['PROJECTMIND_ADAPTERS_ENABLED'] === 'true' : undefined),
        defaultAdapterId: overrides?.agent?.defaultAdapterId ?? env['PROJECTMIND_DEFAULT_ADAPTER_ID'],
      },
      security: {
        allowUnsafeDevDefaults: overrides?.security?.allowUnsafeDevDefaults !== undefined
          ? overrides.security.allowUnsafeDevDefaults
          : (env['PROJECTMIND_ALLOW_UNSAFE_DEV_DEFAULTS'] === 'true'),
        authMode: overrides?.security?.authMode ?? env['PROJECTMIND_AUTH_MODE'],
        masterKey: overrides?.security?.masterKey ?? env['PROJECTMIND_MASTER_KEY'] ?? env['PROJECTMIND_SECRET_KEY'],
      },
    };

    // Clean undefined keys recursively so Zod schema defaults take effect
    const cleaned = this.removeUndefined(rawFromEnv);
    return PlatformConfigValidator.validate(cleaned);
  }

  private static removeUndefined(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((v) => this.removeUndefined(v)).filter((v) => v !== undefined);
    }
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = this.removeUndefined(v);
      if (cleaned !== undefined) {
        result[k] = cleaned;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
}
