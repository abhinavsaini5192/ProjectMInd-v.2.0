import os from 'node:os';
import { randomUUID } from 'node:crypto';
import type { InstanceRecord, InstanceState } from '../models/InstanceRecord.js';
import {
  DEFAULT_DISTRIBUTED_CONFIG,
  type DistributedConfig,
  type ServiceRole,
} from '../models/DistributedConfig.js';
import type { IDistributedCoordinationBackend } from '../coordination/IDistributedCoordinationBackend.js';
import type { IDistributedServiceDiscovery } from './IDistributedServiceDiscovery.js';

export class DistributedServiceDiscovery implements IDistributedServiceDiscovery {
  private readonly backend: IDistributedCoordinationBackend;
  private readonly config: DistributedConfig;
  private readonly instanceId: string;
  private readonly role: ServiceRole;
  private readonly hostname: string;
  private readonly pid: number;
  private record: InstanceRecord | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isClosed = false;

  constructor(
    backend: IDistributedCoordinationBackend,
    config: Partial<DistributedConfig> = {},
    instanceIdOverride?: string
  ) {
    this.backend = backend;
    this.config = { ...DEFAULT_DISTRIBUTED_CONFIG, ...config };
    this.hostname = os.hostname();
    this.pid = process.pid;
    this.role = this.config.role;
    this.instanceId =
      instanceIdOverride ??
      this.config.instanceId ??
      `inst-${this.hostname}-${this.pid}-${randomUUID().slice(0, 6)}`;
  }

  public getInstanceId(): string {
    return this.instanceId;
  }

  public getRecord(): InstanceRecord | null {
    return this.record;
  }

  private instanceKey(id: string): string {
    return `discovery:inst:${id}`;
  }

  public async register(
    capabilities: readonly string[] = ['core', 'context', 'kernel'],
    metadata?: Record<string, unknown>
  ): Promise<InstanceRecord> {
    if (this.isClosed) throw new Error('Service discovery is closed');

    const now = Date.now();
    const fencingToken = now;

    this.record = {
      instanceId: this.instanceId,
      role: this.role,
      hostname: this.hostname,
      pid: this.pid,
      state: 'READY',
      capabilities,
      fencingToken,
      registeredAt: now,
      lastHeartbeatAt: now,
      version: '1.0.0',
      metadata,
    };

    const key = this.instanceKey(this.instanceId);
    // Set with TTL = staleThresholdMs * 2 so dead nodes expire even if hard killed
    await this.backend.set(key, JSON.stringify(this.record), this.config.staleThresholdMs * 2);

    // Start periodic heartbeat
    this.startHeartbeatLoop();

    return this.record;
  }

  private startHeartbeatLoop(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(async () => {
      if (this.isClosed || !this.record) return;
      try {
        await this.heartbeat();
      } catch {
        // Heartbeat failure log / retry next tick
      }
    }, this.config.heartbeatIntervalMs);
  }

  public async heartbeat(): Promise<boolean> {
    if (this.isClosed || !this.record) return false;

    const now = Date.now();
    this.record = {
      ...this.record,
      lastHeartbeatAt: now,
    };

    const key = this.instanceKey(this.instanceId);
    await this.backend.set(key, JSON.stringify(this.record), this.config.staleThresholdMs * 2);
    return true;
  }

  public async deregister(): Promise<boolean> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (!this.record) return true;

    // Update state to STOPPED before deletion to notify peers
    this.record = {
      ...this.record,
      state: 'STOPPED',
      lastHeartbeatAt: Date.now(),
    };

    const key = this.instanceKey(this.instanceId);
    await this.backend.delete(key);
    this.record = null;
    return true;
  }

  public async getActiveInstances(): Promise<readonly InstanceRecord[]> {
    const keys = await this.backend.listKeys('discovery:inst:');
    const now = Date.now();
    const active: InstanceRecord[] = [];

    for (const key of keys) {
      const raw = await this.backend.get(key);
      if (!raw) continue;

      try {
        const item: InstanceRecord = JSON.parse(raw);
        // Verify node is not stale
        const age = now - item.lastHeartbeatAt;
        if (age <= this.config.staleThresholdMs && item.state !== 'STOPPED' && item.state !== 'FAILED') {
          active.push(item);
        } else if (age > this.config.staleThresholdMs) {
          // Clean up stale registration record
          await this.backend.delete(key);
        }
      } catch {
        await this.backend.delete(key);
      }
    }

    return active;
  }

  public async getInstance(instanceId: string): Promise<InstanceRecord | null> {
    const key = this.instanceKey(instanceId);
    const raw = await this.backend.get(key);
    if (!raw) return null;

    try {
      const item: InstanceRecord = JSON.parse(raw);
      if (Date.now() - item.lastHeartbeatAt > this.config.staleThresholdMs) {
        await this.backend.delete(key);
        return null;
      }
      return item;
    } catch {
      return null;
    }
  }

  public async isLeader(): Promise<boolean> {
    const currentLeader = await this.getLeader();
    return currentLeader === this.instanceId;
  }

  public async getLeader(): Promise<string | null> {
    const leaderKey = 'discovery:cluster:leader';
    // Try to acquire leadership lock or inspect current holder
    const current = await this.backend.inspectLock(leaderKey);
    if (current && current.expiresAt > Date.now()) {
      return current.ownerId;
    }

    // Attempt to elect self if no active leader
    const acquired = await this.backend.acquireLock(leaderKey, this.instanceId, this.config.staleThresholdMs);
    if (acquired) {
      return this.instanceId;
    }

    const inspection = await this.backend.inspectLock(leaderKey);
    return inspection?.ownerId ?? null;
  }

  public async close(): Promise<void> {
    this.isClosed = true;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    await this.deregister();
  }
}
