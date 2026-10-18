import type { IWorkspaceService } from './IWorkspaceService.js';
import type { IWorkspaceRepository } from '../persistence/IWorkspaceRepository.js';
import type { Workspace, WorkspaceStatusType, CreateWorkspaceParams, UpdateWorkspaceParams } from '../models/Workspace.js';
import type { WorkspaceMember, AddWorkspaceMemberParams } from '../models/WorkspaceMember.js';
import type { SecurityContext } from '../../security/models/SecurityContext.js';
import type { IEventBus } from '../interfaces/IEventBus.js';
import { WORKSPACE_PROJECT_EVENTS, type WorkspaceProjectEventPayload } from '../events/WorkspaceProjectEvents.js';
import { ProjectMindError } from '../../errors/index.js';
import { ScopeViolationError } from '../../security/errors/SecurityError.js';
import * as crypto from 'crypto';

export class WorkspaceService implements IWorkspaceService {
  constructor(
    private readonly repository: IWorkspaceRepository,
    private readonly eventBus?: IEventBus | undefined,
    private readonly legacyManager?: any,
    private readonly legacyLocator?: any
  ) {}

  // ================= Legacy Method Compatibility =================
  public async initialize(repositoryId: string, repositoryPath: string): Promise<void> {
    if (this.legacyManager?.initializeWorkspace) {
      await this.legacyManager.initializeWorkspace(repositoryId, repositoryPath);
    }
  }

  public async load(repositoryId: string): Promise<void> {
    if (this.legacyManager?.loadWorkspace) {
      await this.legacyManager.loadWorkspace(repositoryId);
    }
  }

  public async locateByPath(localPath: string): Promise<string> {
    if (this.legacyLocator?.locateByLocalPath) {
      return this.legacyLocator.locateByLocalPath(localPath);
    }
    return 'default';
  }

  // ================= Canonical Workspace Operations =================

  public async createWorkspace(params: CreateWorkspaceParams, securityContext?: SecurityContext): Promise<Workspace> {
    const workspaceId = `ws_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const slug = (params.slug ?? params.name)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const now = new Date().toISOString();
    const ownerId = params.ownerId ?? securityContext?.principal?.principalId ?? 'system';

    const workspace: Workspace = {
      workspaceId,
      name: params.name,
      slug: slug || workspaceId,
      description: params.description,
      status: 'ACTIVE',
      ownerId,
      settings: params.settings ?? {},
      metadata: params.metadata,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.repository.saveWorkspace(workspace);

    // Automatically add owner as ADMIN member
    const ownerMember: WorkspaceMember = {
      memberId: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      workspaceId,
      principalId: ownerId,
      role: 'ADMIN',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.saveMember(ownerMember);

    this.publishEvent(WORKSPACE_PROJECT_EVENTS.WORKSPACE_CREATED, workspace.workspaceId, workspace, securityContext);

    return workspace;
  }

  public async getWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace> {
    this.assertWorkspaceScope(workspaceId, securityContext);

    const workspace = await this.repository.getWorkspace(workspaceId);
    if (!workspace) {
      throw new ProjectMindError(`Workspace '${workspaceId}' not found`, 'WORKSPACE_NOT_FOUND');
    }
    return workspace;
  }

  public async getWorkspaceBySlug(slug: string, securityContext?: SecurityContext): Promise<Workspace> {
    const workspace = await this.repository.getWorkspaceBySlug(slug);
    if (!workspace) {
      throw new ProjectMindError(`Workspace with slug '${slug}' not found`, 'WORKSPACE_NOT_FOUND');
    }
    this.assertWorkspaceScope(workspace.workspaceId, securityContext);
    return workspace;
  }

  public async listWorkspaces(status?: WorkspaceStatusType, securityContext?: SecurityContext): Promise<readonly Workspace[]> {
    const all = await this.repository.listWorkspaces(status);

    if (!securityContext || securityContext.isGlobalAdmin?.() || !securityContext.workspaceId || securityContext.workspaceId === '*') {
      return all;
    }

    return all.filter((w) => w.workspaceId === securityContext.workspaceId);
  }

  public async updateWorkspace(workspaceId: string, params: UpdateWorkspaceParams, securityContext?: SecurityContext): Promise<Workspace> {
    const current = await this.getWorkspace(workspaceId, securityContext);

    if (current.status === 'ARCHIVED' || current.status === 'DELETED') {
      throw new ProjectMindError(
        `Cannot update workspace '${workspaceId}' in ${current.status} state. Restore workspace first.`,
        'INVALID_WORKSPACE_STATE'
      );
    }

    const updated: Workspace = {
      ...current,
      name: params.name ?? current.name,
      description: params.description !== undefined ? params.description : current.description,
      settings: params.settings ? { ...current.settings, ...params.settings } : current.settings,
      metadata: params.metadata ? { ...(current.metadata ?? {}), ...params.metadata } : current.metadata,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.repository.saveWorkspace(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.WORKSPACE_UPDATED, workspaceId, updated, securityContext);

    return updated;
  }

  public async archiveWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace> {
    const current = await this.getWorkspace(workspaceId, securityContext);

    if (current.status === 'ARCHIVED') {
      return current;
    }

    const updated: Workspace = {
      ...current,
      status: 'ARCHIVED',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.repository.saveWorkspace(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.WORKSPACE_ARCHIVED, workspaceId, updated, securityContext);

    return updated;
  }

  public async restoreWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<Workspace> {
    const current = await this.getWorkspace(workspaceId, securityContext);

    if (current.status === 'ACTIVE') {
      return current;
    }

    const updated: Workspace = {
      ...current,
      status: 'ACTIVE',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.repository.saveWorkspace(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.WORKSPACE_RESTORED, workspaceId, updated, securityContext);

    return updated;
  }

  public async deleteWorkspace(workspaceId: string, securityContext?: SecurityContext): Promise<void> {
    const current = await this.getWorkspace(workspaceId, securityContext);

    // Soft delete retention
    const updated: Workspace = {
      ...current,
      status: 'DELETED',
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };

    await this.repository.saveWorkspace(updated);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.WORKSPACE_DELETED, workspaceId, updated, securityContext);
  }

  public async addMember(params: AddWorkspaceMemberParams, securityContext?: SecurityContext): Promise<WorkspaceMember> {
    this.assertWorkspaceScope(params.workspaceId, securityContext);

    const now = new Date().toISOString();
    const member: WorkspaceMember = {
      memberId: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      workspaceId: params.workspaceId,
      principalId: params.principalId,
      role: params.role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.saveMember(member);
    this.publishEvent(WORKSPACE_PROJECT_EVENTS.MEMBERSHIP_CHANGED, params.workspaceId, member, securityContext);

    return member;
  }

  public async removeMember(workspaceId: string, principalId: string, securityContext?: SecurityContext): Promise<void> {
    this.assertWorkspaceScope(workspaceId, securityContext);
    await this.repository.deleteMember(workspaceId, principalId);
    this.publishEvent(
      WORKSPACE_PROJECT_EVENTS.MEMBERSHIP_CHANGED,
      workspaceId,
      { workspaceId, principalId, action: 'REMOVED' },
      securityContext
    );
  }

  public async listMembers(workspaceId: string, securityContext?: SecurityContext): Promise<readonly WorkspaceMember[]> {
    this.assertWorkspaceScope(workspaceId, securityContext);
    return this.repository.listMembers(workspaceId);
  }

  // ================= Helpers =================

  private assertWorkspaceScope(workspaceId: string, securityContext?: SecurityContext): void {
    if (!securityContext) return;
    if (securityContext.isGlobalAdmin?.()) return;

    if (securityContext.workspaceId && securityContext.workspaceId !== '*' && securityContext.workspaceId !== workspaceId) {
      throw new ScopeViolationError(
        `Cross-workspace access violation: Target workspace '${workspaceId}' does not match authorized workspace '${securityContext.workspaceId}'`
      );
    }
  }

  private publishEvent<T>(eventName: string, workspaceId: string, data: T, securityContext?: SecurityContext): void {
    if (!this.eventBus) return;

    const payload: WorkspaceProjectEventPayload<T> = {
      eventId: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      eventName,
      scope: { workspaceId },
      timestamp: new Date().toISOString(),
      correlationId: securityContext?.sessionContext?.correlationId ?? `corr_${Date.now()}`,
      version: 1,
      principalId: securityContext?.principal?.principalId,
      data,
    };

    this.eventBus.publish(eventName, payload);
  }
}

export const IWorkspaceServiceToken = Symbol('WorkspaceService');
