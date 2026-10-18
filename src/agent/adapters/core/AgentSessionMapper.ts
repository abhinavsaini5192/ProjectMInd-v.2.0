import type { IAgentSessionMapper, SessionLinkOptions } from '../interfaces/IAgentSessionMapper.js';
import type { AdapterSession } from '../models/AdapterSession.js';

export class AgentSessionMapper implements IAgentSessionMapper {
  private readonly providerToCanonical = new Map<string, string>();
  private readonly canonicalToProvider = new Map<string, string>();
  private readonly sessions = new Map<string, AdapterSession>();

  public mapSession(
    providerSessionId: string,
    canonicalSessionId?: string,
    options?: SessionLinkOptions
  ): AdapterSession {
    if (!providerSessionId) {
      throw new Error('providerSessionId must be provided');
    }

    const existingCanonical = this.providerToCanonical.get(providerSessionId);
    if (existingCanonical) {
      const existing = this.sessions.get(existingCanonical);
      if (existing) {
        return existing;
      }
    }

    const canonicalId =
      canonicalSessionId ??
      `session_adapter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return this.linkSession(providerSessionId, canonicalId, options);
  }

  public getCanonicalSessionId(providerSessionId: string): string | undefined {
    return this.providerToCanonical.get(providerSessionId);
  }

  public getProviderSessionId(canonicalSessionId: string): string | undefined {
    return this.canonicalToProvider.get(canonicalSessionId);
  }

  public linkSession(
    providerSessionId: string,
    canonicalSessionId: string,
    options?: SessionLinkOptions
  ): AdapterSession {
    this.providerToCanonical.set(providerSessionId, canonicalSessionId);
    this.canonicalToProvider.set(canonicalSessionId, providerSessionId);

    const now = new Date().toISOString();
    const session: AdapterSession = {
      providerSessionId,
      canonicalSessionId,
      adapterId: options?.adapterId ?? 'unknown_adapter',
      provider: options?.provider ?? 'GENERIC',
      protocol: options?.protocol ?? 'CANONICAL',
      workspaceId: options?.workspaceId ?? 'default_ws',
      repositoryId: options?.repositoryId ?? 'default_repo',
      taskId: options?.taskId,
      createdAt: now,
      lastActivityAt: now,
      metadata: options?.metadata ?? {},
    };

    this.sessions.set(canonicalSessionId, session);
    return session;
  }

  public unlinkSession(providerSessionId: string): boolean {
    const canonicalId = this.providerToCanonical.get(providerSessionId);
    if (!canonicalId) {
      return false;
    }

    this.providerToCanonical.delete(providerSessionId);
    this.canonicalToProvider.delete(canonicalId);
    this.sessions.delete(canonicalId);
    return true;
  }

  public clear(): void {
    this.providerToCanonical.clear();
    this.canonicalToProvider.clear();
    this.sessions.clear();
  }
}
