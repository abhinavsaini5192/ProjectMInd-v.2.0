import type { DistributedLock } from '../models/DistributedLock.js';
import type {
  IDistributedCoordinationBackend,
  BackendHealth,
  BackendSubscription,
} from './IDistributedCoordinationBackend.js';
import { ConfigRedactor } from '../../platform/config/ConfigRedactor.js';

export type RedisConnectionState =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'RECONNECTING'
  | 'CLOSED';

export interface ISimpleLogger {
  warn(msg: string, meta?: any): void;
  error(msg: string, meta?: any): void;
  info?(msg: string, meta?: any): void;
  debug?(msg: string, meta?: any): void;
}

export interface IStructuredLogger {
  warn(entry: { component: string; operation: string; message: string; details?: any; [key: string]: any }): void;
  error(entry: { component: string; operation: string; message: string; details?: any; [key: string]: any }): void;
  info?(entry: { component: string; operation: string; message: string; details?: any; [key: string]: any }): void;
  debug?(entry: { component: string; operation: string; message: string; details?: any; [key: string]: any }): void;
}

export type RedisBackendLogger = ISimpleLogger | IStructuredLogger;

export interface RedisBackendOptions {
  readonly redisUrl?: string | undefined;
  readonly keyPrefix?: string | undefined;
  readonly connectTimeoutMs?: number | undefined;
  readonly maxRetriesPerRequest?: number | undefined;
  readonly logger?: RedisBackendLogger | undefined;
  readonly onError?: ((error: Error) => void) | undefined;
}

/**
 * Production Redis coordination backend using atomic Lua scripts
 * for mutual exclusion, fencing tokens, and lease renewal.
 *
 * Implements non-silent error handling, connection state observability,
 * subscriber client cleanup, and strict credential redaction.
 */
export class RedisCoordinationBackend implements IDistributedCoordinationBackend {
  private readonly redisUrl: string;
  private readonly sanitizedUrl: string;
  private readonly keyPrefix: string;
  private readonly connectTimeoutMs: number;
  private readonly maxRetriesPerRequest: number;
  private readonly logger?: RedisBackendLogger | undefined;
  private readonly onError?: ((error: Error) => void) | undefined;

  private connectionState: RedisConnectionState = 'DISCONNECTED';
  private lastError: Error | null = null;
  private isConnected = false;
  private isClosed = false;
  private client: any = null;
  private readonly subClients = new Set<any>();

  constructor(options: RedisBackendOptions = {}) {
    this.redisUrl = options.redisUrl ?? process.env['REDIS_URL'] ?? 'redis://127.0.0.1:6379';
    this.sanitizedUrl = ConfigRedactor.redactString(this.redisUrl);
    this.keyPrefix = options.keyPrefix ?? 'pm:coord:';
    this.connectTimeoutMs = options.connectTimeoutMs ?? 2000;
    this.maxRetriesPerRequest = options.maxRetriesPerRequest ?? 1;
    this.logger = options.logger;
    this.onError = options.onError;
  }

  public getConnectionState(): RedisConnectionState {
    return this.connectionState;
  }

  public getLastError(): Error | null {
    return this.lastError;
  }

  public getSubscribersCount(): number {
    return this.subClients.size;
  }

  public getSanitizedUrl(): string {
    return this.sanitizedUrl;
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any): void {
    if (!this.logger) return;
    const fn = (this.logger as any)[level];
    if (typeof fn !== 'function') return;

    try {
      if ('writeLog' in (this.logger as any) || (fn.length === 1 && typeof (this.logger as any).getBufferedEntries === 'function')) {
        fn.call(this.logger, {
          component: 'RedisCoordinationBackend',
          operation: 'coordination',
          message,
          details: meta,
        });
      } else {
        fn.call(this.logger, message, meta);
      }
    } catch {
      try {
        fn.call(this.logger, message, meta);
      } catch {}
    }
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private attachClientLifecycleListeners(client: any, role: 'primary' | 'subscriber'): void {
    client.on('connect', () => {
      if (role === 'primary') {
        this.connectionState = 'CONNECTING';
      }
      this.log('debug', `Redis ${role} client connecting`, { url: this.sanitizedUrl });
    });

    client.on('ready', () => {
      if (role === 'primary') {
        this.isConnected = true;
        this.connectionState = 'CONNECTED';
      }
      this.log('info', `Redis ${role} client ready`, { url: this.sanitizedUrl });
    });

    client.on('reconnecting', () => {
      if (role === 'primary') {
        this.isConnected = false;
        this.connectionState = 'RECONNECTING';
      }
      this.log('warn', `Redis ${role} client reconnecting`, { url: this.sanitizedUrl });
    });

    client.on('close', () => {
      if (role === 'primary') {
        this.isConnected = false;
        if (!this.isClosed) {
          this.connectionState = 'DISCONNECTED';
        }
      }
      this.log('debug', `Redis ${role} client connection closed`, { url: this.sanitizedUrl });
    });

    client.on('end', () => {
      if (role === 'primary') {
        this.isConnected = false;
        this.connectionState = 'CLOSED';
      }
      this.log('debug', `Redis ${role} client connection ended`, { url: this.sanitizedUrl });
    });

    // Observable error listener: records error state, structured logs, and notifies hooks without crashing process
    client.on('error', (err: unknown) => {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const sanitizedMsg = ConfigRedactor.redactString(rawMsg);
      const sanitizedErr = new Error(`Redis ${role} client error: ${sanitizedMsg}`);
      this.lastError = sanitizedErr;

      this.log('warn', `Redis coordination client error (${role})`, {
        role,
        url: this.sanitizedUrl,
        error: sanitizedMsg,
        state: this.connectionState,
      });

      if (this.onError) {
        try {
          this.onError(sanitizedErr);
        } catch {}
      }
    });
  }

  private async ensureClient(): Promise<any> {
    if (this.client && this.isConnected) return this.client;
    if (this.isClosed) throw new Error('Redis coordination backend is closed');

    try {
      this.connectionState = 'CONNECTING';

      // Dynamic import to avoid hard requirement when redis is not used
      const pkg = 'ioredis';
      const ioredis = await import(/* @vite-ignore */ pkg).catch(() => null);
      if (!ioredis) {
        throw new Error('Redis client (ioredis) is not installed in the environment');
      }
      const RedisCtor = (ioredis as any).default ?? ioredis;
      this.client = new RedisCtor(this.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: this.maxRetriesPerRequest,
        connectTimeout: this.connectTimeoutMs,
        enableOfflineQueue: false,
      });

      this.attachClientLifecycleListeners(this.client, 'primary');

      await this.client.connect();
      this.isConnected = true;
      this.connectionState = 'CONNECTED';
      return this.client;
    } catch (err) {
      this.isConnected = false;
      this.connectionState = this.isClosed ? 'CLOSED' : 'DISCONNECTED';
      const rawMsg = err instanceof Error ? err.message : String(err);
      const sanitizedMsg = ConfigRedactor.redactString(rawMsg);
      const sanitizedErr = new Error(`Failed to connect to Redis coordination backend at ${this.sanitizedUrl}: ${sanitizedMsg}`);
      this.lastError = sanitizedErr;

      this.log('error', 'Redis coordination backend connection failed', {
        backend: 'redis',
        url: this.sanitizedUrl,
        error: sanitizedMsg,
      });

      if (this.onError) {
        try {
          this.onError(sanitizedErr);
        } catch {}
      }

      throw sanitizedErr;
    }
  }

  public async acquireLock(
    key: string,
    ownerId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<DistributedLock | null> {
    const client = await this.ensureClient();
    const lockKey = this.fullKey(`lock:${key}`);
    const seqKey = this.fullKey('seq:fencing');

    const luaScript = `
      local current = redis.call('get', KEYS[1])
      if current then
        local data = cjson.decode(current)
        if data.ownerId == ARGV[1] then
          data.renewCount = data.renewCount + 1
          redis.call('set', KEYS[1], cjson.encode(data), 'PX', tonumber(ARGV[2]))
          return cjson.encode(data)
        else
          return nil
        end
      end
      local fencing = redis.call('incr', KEYS[2])
      local lock = {
        lockKey = ARGV[4],
        ownerId = ARGV[1],
        fencingToken = fencing,
        acquiredAt = redis.call('time')[1] * 1000,
        expiresAt = redis.call('time')[1] * 1000 + tonumber(ARGV[2]),
        ttlMs = tonumber(ARGV[2]),
        renewCount = 0,
        metadata = cjson.decode(ARGV[3])
      }
      redis.call('set', KEYS[1], cjson.encode(lock), 'PX', tonumber(ARGV[2]))
      return cjson.encode(lock)
    `;

    try {
      const result = await client.eval(
        luaScript,
        2,
        lockKey,
        seqKey,
        ownerId,
        String(ttlMs),
        JSON.stringify(metadata ?? {}),
        key
      );
      if (!result) return null;
      return JSON.parse(result) as DistributedLock;
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis acquireLock error on ${key}: ${sanitized}`);
    }
  }

  public async renewLock(
    key: string,
    ownerId: string,
    fencingToken: number,
    ttlMs: number
  ): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const lockKey = this.fullKey(`lock:${key}`);

      const luaScript = `
        local current = redis.call('get', KEYS[1])
        if not current then return 0 end
        local data = cjson.decode(current)
        if data.ownerId == ARGV[1] and tonumber(data.fencingToken) == tonumber(ARGV[2]) then
          data.renewCount = data.renewCount + 1
          redis.call('set', KEYS[1], cjson.encode(data), 'PX', tonumber(ARGV[3]))
          return 1
        else
          return 0
        end
      `;

      const res = await client.eval(luaScript, 1, lockKey, ownerId, String(fencingToken), String(ttlMs));
      return Number(res) === 1;
    } catch (err) {
      this.log('warn', `Redis renewLock failed for key ${key}`, {
        error: ConfigRedactor.redactString(err instanceof Error ? err.message : String(err)),
      });
      return false;
    }
  }

  public async releaseLock(
    key: string,
    ownerId: string,
    fencingToken: number
  ): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const lockKey = this.fullKey(`lock:${key}`);

      const luaScript = `
        local current = redis.call('get', KEYS[1])
        if not current then return 0 end
        local data = cjson.decode(current)
        if data.ownerId == ARGV[1] and tonumber(data.fencingToken) == tonumber(ARGV[2]) then
          return redis.call('del', KEYS[1])
        else
          return 0
        end
      `;

      const res = await client.eval(luaScript, 1, lockKey, ownerId, String(fencingToken));
      return Number(res) === 1;
    } catch (err) {
      this.log('warn', `Redis releaseLock failed for key ${key}`, {
        error: ConfigRedactor.redactString(err instanceof Error ? err.message : String(err)),
      });
      return false;
    }
  }

  public async inspectLock(key: string): Promise<DistributedLock | null> {
    try {
      const client = await this.ensureClient();
      const lockKey = this.fullKey(`lock:${key}`);
      const raw = await client.get(lockKey);
      if (!raw) return null;
      return JSON.parse(raw) as DistributedLock;
    } catch {
      return null;
    }
  }

  public async forceRelease(key: string): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const lockKey = this.fullKey(`lock:${key}`);
      const res = await client.del(lockKey);
      return Number(res) > 0;
    } catch {
      return false;
    }
  }

  public async setNx(key: string, value: string, ttlMs?: number): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const storeKey = this.fullKey(`kv:${key}`);
      let res: string | null;
      if (ttlMs) {
        res = await client.set(storeKey, value, 'PX', ttlMs, 'NX');
      } else {
        res = await client.set(storeKey, value, 'NX');
      }
      return res === 'OK';
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis setNx error on ${key}: ${sanitized}`);
    }
  }

  public async set(key: string, value: string, ttlMs?: number): Promise<void> {
    try {
      const client = await this.ensureClient();
      const storeKey = this.fullKey(`kv:${key}`);
      if (ttlMs) {
        await client.set(storeKey, value, 'PX', ttlMs);
      } else {
        await client.set(storeKey, value);
      }
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis set error on ${key}: ${sanitized}`);
    }
  }

  public async get(key: string): Promise<string | null> {
    try {
      const client = await this.ensureClient();
      const storeKey = this.fullKey(`kv:${key}`);
      return client.get(storeKey);
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis get error on ${key}: ${sanitized}`);
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const storeKey = this.fullKey(`kv:${key}`);
      const res = await client.del(storeKey);
      return Number(res) > 0;
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis delete error on ${key}: ${sanitized}`);
    }
  }

  public async listKeys(prefix: string): Promise<string[]> {
    try {
      const client = await this.ensureClient();
      const pattern = this.fullKey(`kv:${prefix}*`);
      const fullKeys: string[] = await client.keys(pattern);
      const prefixLen = this.fullKey('kv:').length;
      return fullKeys.map((k) => k.slice(prefixLen));
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis listKeys error on ${prefix}: ${sanitized}`);
    }
  }

  public async publish(channel: string, message: string): Promise<number> {
    try {
      const client = await this.ensureClient();
      const fullChannel = this.fullKey(`ch:${channel}`);
      return client.publish(fullChannel, message);
    } catch (err) {
      const sanitized = ConfigRedactor.redactString(err instanceof Error ? err.message : String(err));
      throw new Error(`Redis publish error on ${channel}: ${sanitized}`);
    }
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<BackendSubscription> {
    if (this.isClosed) throw new Error('Redis coordination backend is closed');

    const pkg = 'ioredis';
    const ioredis = await import(/* @vite-ignore */ pkg).catch(() => null);
    if (!ioredis) {
      throw new Error('Redis client (ioredis) is not installed in the environment');
    }
    const RedisCtor = (ioredis as any).default ?? ioredis;
    const subClient = new RedisCtor(this.redisUrl, {
      lazyConnect: false,
      maxRetriesPerRequest: this.maxRetriesPerRequest,
      connectTimeout: this.connectTimeoutMs,
      enableOfflineQueue: false,
    });

    // Attach lifecycle listeners to prevent unhandled error event crash on subscriber
    this.attachClientLifecycleListeners(subClient, 'subscriber');
    this.subClients.add(subClient);

    const fullChannel = this.fullKey(`ch:${channel}`);

    try {
      await subClient.subscribe(fullChannel);
    } catch (err) {
      this.subClients.delete(subClient);
      try {
        await subClient.quit();
      } catch {
        try {
          subClient.disconnect();
        } catch {}
      }
      const rawMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Redis subscribe failed on ${channel}: ${ConfigRedactor.redactString(rawMsg)}`);
    }

    subClient.on('message', (chan: string, msg: string) => {
      if (chan === fullChannel) {
        handler(msg);
      }
    });

    return {
      unsubscribe: async () => {
        try {
          this.subClients.delete(subClient);
          await subClient.unsubscribe(fullChannel);
          await subClient.quit();
        } catch {
          try {
            subClient.disconnect();
          } catch {}
        }
      },
    };
  }

  public async healthCheck(): Promise<BackendHealth> {
    const start = Date.now();
    if (this.isClosed) {
      return {
        healthy: false,
        message: 'Redis coordination backend is closed',
        latencyMs: 0,
      };
    }

    try {
      const client = await this.ensureClient();
      const pingRes = await client.ping();
      const latencyMs = Date.now() - start;
      if (pingRes === 'PONG') {
        return {
          healthy: true,
          message: 'Redis coordination backend operational',
          latencyMs,
        };
      }
      return {
        healthy: false,
        message: `Unexpected Redis ping response: ${pingRes}`,
        latencyMs,
      };
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      const sanitized = ConfigRedactor.redactString(rawMsg);
      return {
        healthy: false,
        message: `Redis backend health check failed: ${sanitized}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    this.connectionState = 'CLOSED';

    // Disconnect and clean up all subscriber clients
    for (const sub of this.subClients) {
      try {
        await sub.quit();
      } catch {
        try {
          sub.disconnect();
        } catch {}
      }
    }
    this.subClients.clear();

    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        try {
          this.client.disconnect();
        } catch {}
      }
      this.client = null;
    }
    this.isConnected = false;
  }
}
