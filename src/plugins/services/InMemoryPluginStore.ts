import type { IPluginStore, PluginRegistrationFilter, PluginInstallationFilter } from '../interfaces/IPluginStore.js';
import type { PluginRegistration } from '../models/PluginRegistration.js';
import type { PluginInstallation } from '../models/PluginInstallation.js';
import type { PluginPermissionGrant } from '../models/PluginPermissionGrant.js';
import type { PluginExecutionRecord } from '../models/PluginExecutionRecord.js';

export class InMemoryPluginStore implements IPluginStore {
  private readonly registrations = new Map<string, PluginRegistration>();
  private readonly installations = new Map<string, PluginInstallation>(); // key: `${workspaceId}:${projectId ?? 'root'}:${pluginId}`
  private readonly grants = new Map<string, PluginPermissionGrant>(); // key: `${workspaceId}:${projectId ?? 'root'}:${pluginId}`
  private readonly executionRecords = new Map<string, PluginExecutionRecord[]>(); // key: pluginId -> records
  private readonly configurations = new Map<string, Record<string, unknown>>(); // key: `${workspaceId}:${projectId ?? 'root'}:${pluginId}`

  private makeScopeKey(pluginId: string, workspaceId: string, projectId?: string): string {
    return `${workspaceId}:${projectId ?? 'root'}:${pluginId}`;
  }

  // Registrations
  public async saveRegistration(registration: PluginRegistration): Promise<void> {
    this.registrations.set(registration.pluginId, Object.freeze({ ...registration }));
  }

  public async getRegistration(pluginId: string): Promise<PluginRegistration | undefined> {
    return this.registrations.get(pluginId);
  }

  public async listRegistrations(filter?: PluginRegistrationFilter): Promise<PluginRegistration[]> {
    let list = Array.from(this.registrations.values());
    if (filter) {
      if (filter.pluginType) {
        list = list.filter((r) => r.descriptor.pluginType === filter.pluginType);
      }
      if (filter.publisher) {
        list = list.filter((r) => r.descriptor.publisher.toLowerCase() === filter.publisher!.toLowerCase());
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        list = list.filter(
          (r) =>
            r.pluginId.toLowerCase().includes(q) ||
            r.descriptor.name.toLowerCase().includes(q) ||
            r.descriptor.description.toLowerCase().includes(q)
        );
      }
    }
    return list;
  }

  public async deleteRegistration(pluginId: string): Promise<boolean> {
    return this.registrations.delete(pluginId);
  }

  // Installations
  public async saveInstallation(installation: PluginInstallation): Promise<void> {
    const key = this.makeScopeKey(installation.pluginId, installation.workspaceId, installation.projectId);
    this.installations.set(key, Object.freeze({ ...installation }));
  }

  public async getInstallation(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<PluginInstallation | undefined> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    return this.installations.get(key);
  }

  public async listInstallations(filter: PluginInstallationFilter): Promise<PluginInstallation[]> {
    const list: PluginInstallation[] = [];
    for (const inst of this.installations.values()) {
      if (inst.workspaceId === filter.workspaceId) {
        if (filter.projectId && inst.projectId !== filter.projectId) {
          continue;
        }
        if (filter.enabledOnly && !inst.enabled) {
          continue;
        }
        list.push(inst);
      }
    }
    return list;
  }

  public async deleteInstallation(pluginId: string, workspaceId: string, projectId?: string): Promise<boolean> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    return this.installations.delete(key);
  }

  // Permission Grants
  public async saveGrant(grant: PluginPermissionGrant): Promise<void> {
    const key = this.makeScopeKey(grant.pluginId, grant.workspaceId, grant.projectId);
    this.grants.set(key, Object.freeze({ ...grant }));
  }

  public async getGrant(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<PluginPermissionGrant | undefined> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    return this.grants.get(key);
  }

  public async listGrants(workspaceId: string, projectId?: string): Promise<PluginPermissionGrant[]> {
    const list: PluginPermissionGrant[] = [];
    for (const grant of this.grants.values()) {
      if (grant.workspaceId === workspaceId) {
        if (projectId && grant.projectId !== projectId) {
          continue;
        }
        list.push(grant);
      }
    }
    return list;
  }

  public async revokeGrant(pluginId: string, workspaceId: string, projectId?: string): Promise<boolean> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    const existing = this.grants.get(key);
    if (!existing) return false;
    this.grants.set(key, {
      ...existing,
      status: 'REVOKED',
      revokedAt: new Date().toISOString(),
    });
    return true;
  }

  // Execution Records
  public async saveExecutionRecord(record: PluginExecutionRecord): Promise<void> {
    const existing = this.executionRecords.get(record.pluginId) ?? [];
    existing.push(Object.freeze({ ...record }));
    // Keep max 500 records per plugin to prevent memory bloat
    if (existing.length > 500) {
      existing.shift();
    }
    this.executionRecords.set(record.pluginId, existing);
  }

  public async listExecutionRecords(pluginId: string, limit: number = 50): Promise<PluginExecutionRecord[]> {
    const records = this.executionRecords.get(pluginId) ?? [];
    return records.slice(-limit).reverse();
  }

  // Configurations
  public async saveConfiguration(
    pluginId: string,
    workspaceId: string,
    config: Record<string, unknown>,
    projectId?: string
  ): Promise<void> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    this.configurations.set(key, Object.freeze({ ...config }));
  }

  public async getConfiguration(
    pluginId: string,
    workspaceId: string,
    projectId?: string
  ): Promise<Record<string, unknown> | undefined> {
    const key = this.makeScopeKey(pluginId, workspaceId, projectId);
    return this.configurations.get(key);
  }
}
