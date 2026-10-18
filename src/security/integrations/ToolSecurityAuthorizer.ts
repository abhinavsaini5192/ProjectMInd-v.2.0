import type { IAuthorizer } from '../interfaces/IAuthorizer.js';
import type { SecurityContext } from '../models/SecurityContext.js';
import type { PermissionAction } from '../models/PermissionAction.js';
import type { ResourceType } from '../models/ResourceType.js';
import type { ResourceScope } from '../models/ResourceScope.js';
import { PermissionDeniedError } from '../errors/SecurityError.js';
import { LogRedactor } from '../../platform/logging/LogRedactor.js';

export interface ToolSecurityMapping {
  readonly action: PermissionAction;
  readonly resourceType: ResourceType;
  readonly requiredCapability?: string | undefined;
}

export const CANONICAL_TOOL_SECURITY_MAPPINGS: Record<string, ToolSecurityMapping> = {
  projectmind_get_context: {
    action: 'READ',
    resourceType: 'CONTEXT',
    requiredCapability: 'READ_CONTEXT',
  },
  projectmind_get_feature: {
    action: 'READ',
    resourceType: 'FEATURE',
    requiredCapability: 'READ_CONTEXT',
  },
  projectmind_get_impact: {
    action: 'READ',
    resourceType: 'KNOWLEDGE',
    requiredCapability: 'READ_CONTEXT',
  },
  projectmind_report_execution: {
    action: 'REPORT',
    resourceType: 'OBSERVATION',
    requiredCapability: 'REPORT_EXECUTION',
  },
  projectmind_report_verification: {
    action: 'REPORT',
    resourceType: 'VERIFICATION',
    requiredCapability: 'REPORT_VERIFICATION',
  },
  projectmind_update_knowledge: {
    action: 'UPDATE',
    resourceType: 'KNOWLEDGE',
    requiredCapability: 'UPDATE_KNOWLEDGE',
  },
  projectmind_refresh_context: {
    action: 'REFRESH',
    resourceType: 'CONTEXT',
    requiredCapability: 'REFRESH_CONTEXT',
  },
};

export class ToolSecurityAuthorizer {
  constructor(private readonly authorizer: IAuthorizer) {}

  /**
   * Authorizes a tool call against the current security context and target scope.
   * Throws PermissionDeniedError if unauthorized or capability is missing.
   */
  public async authorizeToolCall(
    toolName: string,
    context: SecurityContext,
    targetScope?: ResourceScope
  ): Promise<void> {
    const mapping = CANONICAL_TOOL_SECURITY_MAPPINGS[toolName];
    if (!mapping) {
      throw new PermissionDeniedError(`Unknown or unmapped tool: '${toolName}'`);
    }

    // 1. Technical capability check (if required capability is specified)
    if (mapping.requiredCapability) {
      const hasCapability =
        context.capabilities.includes(mapping.requiredCapability) ||
        context.capabilities.includes('*');

      if (!hasCapability && context.principal.type === 'AGENT') {
        throw new PermissionDeniedError(
          `Agent lacks technical capability '${mapping.requiredCapability}' required for tool '${toolName}'`
        );
      }
    }

    // 2. Determine target scope
    const scope: ResourceScope = targetScope ?? {
      workspaceId: context.workspaceId,
      repositoryId: context.repositoryId,
      sessionId: context.sessionId,
      taskId: context.taskId,
    };

    // 3. Perform canonical authorization
    const authzResult = await this.authorizer.authorize({
      principal: context.principal,
      action: mapping.action,
      resourceType: mapping.resourceType,
      resourceId: toolName,
      scope,
      context,
    });

    if (!authzResult.allowed) {
      throw new PermissionDeniedError(
        `Authorization denied for tool '${toolName}': ${authzResult.reason}`
      );
    }
  }

  /**
   * Redacts sensitive secrets from tool input parameters before processing.
   */
  public sanitizeToolParameters<T>(params: T): T {
    return LogRedactor.redactObject(params);
  }
}
