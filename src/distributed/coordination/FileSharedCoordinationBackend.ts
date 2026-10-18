import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DistributedLock } from '../models/DistributedLock.js';
import type {
  IDistributedCoordinationBackend,
  BackendHealth,
  BackendSubscription,
} from './IDistributedCoordinationBackend.js';

function sanitizeFilename(key: string): string {
  return Buffer.from(key).toString('base64url');
}

export class FileSharedCoordinationBackend implements IDistributedCoordinationBackend {
  private readonly rootDir: string;
  private readonly locksDir: string;
  private readonly kvDir: string;
  private readonly eventsDir: string;
  private readonly seqFile: string;
  private isClosed = false;
  private readonly activePollers = new Set<NodeJS.Timeout>();

  constructor(sharedDirectory: string) {
    this.rootDir = path.resolve(sharedDirectory);
    this.locksDir = path.join(this.rootDir, 'locks');
    this.kvDir = path.join(this.rootDir, 'kv');
    this.eventsDir = path.join(this.rootDir, 'events');
    this.seqFile = path.join(this.rootDir, 'fencing.seq');

    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.rootDir)) fs.mkdirSync(this.rootDir, { recursive: true });
    if (!fs.existsSync(this.locksDir)) fs.mkdirSync(this.locksDir, { recursive: true });
    if (!fs.existsSync(this.kvDir)) fs.mkdirSync(this.kvDir, { recursive: true });
    if (!fs.existsSync(this.eventsDir)) fs.mkdirSync(this.eventsDir, { recursive: true });
  }

  private getNextFencingToken(): number {
    const lockPath = path.join(this.rootDir, 'fencing.lock');
    let acquired = false;
    const deadline = Date.now() + 2000;

    while (Date.now() < deadline) {
      try {
        const fd = fs.openSync(lockPath, 'wx');
        fs.closeSync(fd);
        acquired = true;
        break;
      } catch {
        // Sleep a few milliseconds
        const end = Date.now() + 5;
        while (Date.now() < end) {}
      }
    }

    let token = 1;
    try {
      if (fs.existsSync(this.seqFile)) {
        const raw = fs.readFileSync(this.seqFile, 'utf8').trim();
        const val = parseInt(raw, 10);
        if (!Number.isNaN(val)) token = val + 1;
      }
      fs.writeFileSync(this.seqFile, String(token), 'utf8');
    } finally {
      if (acquired) {
        try { fs.unlinkSync(lockPath); } catch {}
      }
    }

    return token;
  }

  private getLockFilePath(key: string): string {
    return path.join(this.locksDir, `${sanitizeFilename(key)}.json`);
  }

  private getKvFilePath(key: string): string {
    return path.join(this.kvDir, `${sanitizeFilename(key)}.json`);
  }

  public async acquireLock(
    key: string,
    ownerId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<DistributedLock | null> {
    if (this.isClosed) throw new Error('Coordination backend is closed');

    this.ensureDirectories();
    const filePath = this.getLockFilePath(key);
    const now = Date.now();

    // Check if existing file is present
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const existing: DistributedLock = JSON.parse(raw);

        if (existing.expiresAt > now) {
          // Still active
          if (existing.ownerId === ownerId) {
            // Re-entrant renewal by same owner
            const renewed: DistributedLock = {
              ...existing,
              expiresAt: now + ttlMs,
              renewCount: existing.renewCount + 1,
              ttlMs,
              metadata: metadata ?? existing.metadata,
            };
            const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
            fs.writeFileSync(tmpPath, JSON.stringify(renewed), 'utf8');
            fs.renameSync(tmpPath, filePath);
            return renewed;
          }
          // Owned by another process
          return null;
        }

        // Expired lock: safe to remove and re-acquire
        try { fs.unlinkSync(filePath); } catch {}
      } catch {
        // File reading or parse error: try to clean up
        try { fs.unlinkSync(filePath); } catch {}
      }
    }

    const fencingToken = this.getNextFencingToken();
    const lock: DistributedLock = {
      lockKey: key,
      ownerId,
      fencingToken,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      ttlMs,
      renewCount: 0,
      metadata,
    };

    // Atomic write via 'wx' flag on temporary or direct lock file
    const atomicPath = `${filePath}.acq`;
    try {
      const fd = fs.openSync(atomicPath, 'wx');
      fs.writeSync(fd, JSON.stringify(lock), 0, 'utf8');
      fs.closeSync(fd);
      fs.renameSync(atomicPath, filePath);
      return lock;
    } catch {
      try { fs.unlinkSync(atomicPath); } catch {}
      return null;
    }
  }

  public async renewLock(
    key: string,
    ownerId: string,
    fencingToken: number,
    ttlMs: number
  ): Promise<boolean> {
    if (this.isClosed) return false;

    const filePath = this.getLockFilePath(key);
    if (!fs.existsSync(filePath)) return false;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const existing: DistributedLock = JSON.parse(raw);
      const now = Date.now();

      if (existing.expiresAt <= now) {
        try { fs.unlinkSync(filePath); } catch {}
        return false;
      }

      if (existing.ownerId !== ownerId || existing.fencingToken !== fencingToken) {
        return false;
      }

      const renewed: DistributedLock = {
        ...existing,
        expiresAt: now + ttlMs,
        renewCount: existing.renewCount + 1,
        ttlMs,
      };

      const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(renewed), 'utf8');
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async releaseLock(
    key: string,
    ownerId: string,
    fencingToken: number
  ): Promise<boolean> {
    if (this.isClosed) return false;

    const filePath = this.getLockFilePath(key);
    if (!fs.existsSync(filePath)) return false;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const existing: DistributedLock = JSON.parse(raw);

      if (existing.ownerId !== ownerId || existing.fencingToken !== fencingToken) {
        return false;
      }

      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async inspectLock(key: string): Promise<DistributedLock | null> {
    const filePath = this.getLockFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const existing: DistributedLock = JSON.parse(raw);
      if (existing.expiresAt <= Date.now()) {
        try { fs.unlinkSync(filePath); } catch {}
        return null;
      }
      return existing;
    } catch {
      return null;
    }
  }

  public async forceRelease(key: string): Promise<boolean> {
    const filePath = this.getLockFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch {}
    return false;
  }

  public async setNx(key: string, value: string, ttlMs?: number): Promise<boolean> {
    this.ensureDirectories();
    const filePath = this.getKvFilePath(key);
    const now = Date.now();

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const existing = JSON.parse(raw);
        if (existing.expiresAt === null || existing.expiresAt > now) {
          return false;
        }
      } catch {}
    }

    const payload = JSON.stringify({
      value,
      expiresAt: ttlMs ? now + ttlMs : null,
    });

    try {
      const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tmpPath, payload, 'utf8');
      fs.renameSync(tmpPath, filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async set(key: string, value: string, ttlMs?: number): Promise<void> {
    this.ensureDirectories();
    const filePath = this.getKvFilePath(key);
    const now = Date.now();
    const payload = JSON.stringify({
      value,
      expiresAt: ttlMs ? now + ttlMs : null,
    });

    const tmpPath = `${filePath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  public async get(key: string): Promise<string | null> {
    const filePath = this.getKvFilePath(key);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const item = JSON.parse(raw);
      if (item.expiresAt !== null && item.expiresAt <= Date.now()) {
        try { fs.unlinkSync(filePath); } catch {}
        return null;
      }
      return item.value;
    } catch {
      return null;
    }
  }

  public async delete(key: string): Promise<boolean> {
    const filePath = this.getKvFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch {}
    return false;
  }

  public async listKeys(prefix: string): Promise<string[]> {
    this.ensureDirectories();
    const results: string[] = [];
    const files = fs.readdirSync(this.kvDir);
    const now = Date.now();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const base64Part = file.slice(0, -5);
      let key = '';
      try {
        key = Buffer.from(base64Part, 'base64url').toString('utf8');
      } catch {
        continue;
      }

      if (key.startsWith(prefix)) {
        const filePath = path.join(this.kvDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          const item = JSON.parse(raw);
          if (item.expiresAt !== null && item.expiresAt <= now) {
            try { fs.unlinkSync(filePath); } catch {}
            continue;
          }
          results.push(key);
        } catch {}
      }
    }

    return results;
  }

  public async publish(channel: string, message: string): Promise<number> {
    if (this.isClosed) return 0;
    this.ensureDirectories();

    const channelDir = path.join(this.eventsDir, sanitizeFilename(channel));
    if (!fs.existsSync(channelDir)) fs.mkdirSync(channelDir, { recursive: true });

    const eventFileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}.json`;
    const eventFilePath = path.join(channelDir, eventFileName);

    try {
      fs.writeFileSync(eventFilePath, message, 'utf8');
      return 1;
    } catch {
      return 0;
    }
  }

  public async subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<BackendSubscription> {
    if (this.isClosed) throw new Error('Coordination backend is closed');
    this.ensureDirectories();

    const channelDir = path.join(this.eventsDir, sanitizeFilename(channel));
    if (!fs.existsSync(channelDir)) fs.mkdirSync(channelDir, { recursive: true });

    const processedFiles = new Set<string>();
    // Preload existing files so we only process new events
    try {
      const existing = fs.readdirSync(channelDir);
      for (const f of existing) processedFiles.add(f);
    } catch {}

    const interval = setInterval(() => {
      if (this.isClosed) return;
      try {
        const files = fs.readdirSync(channelDir);
        for (const file of files) {
          if (!processedFiles.has(file)) {
            processedFiles.add(file);
            const fullPath = path.join(channelDir, file);
            try {
              const content = fs.readFileSync(fullPath, 'utf8');
              handler(content);
            } catch {}
          }
        }
      } catch {}
    }, 50);

    this.activePollers.add(interval);

    return {
      unsubscribe: async () => {
        clearInterval(interval);
        this.activePollers.delete(interval);
      },
    };
  }

  public async healthCheck(): Promise<BackendHealth> {
    const start = Date.now();
    try {
      this.ensureDirectories();
      const testFile = path.join(this.rootDir, `.health-${Date.now()}`);
      fs.writeFileSync(testFile, 'ok', 'utf8');
      fs.unlinkSync(testFile);
      return {
        healthy: true,
        message: 'File-shared coordination backend operational',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        message: `File-shared backend health failure: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    for (const interval of this.activePollers) {
      clearInterval(interval);
    }
    this.activePollers.clear();
  }
}
