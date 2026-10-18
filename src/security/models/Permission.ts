import type { PermissionAction } from './PermissionAction.js';
import type { ResourceType } from './ResourceType.js';

export interface Permission {
  readonly action: PermissionAction;
  readonly resourceType: ResourceType;
  readonly description?: string | undefined;
}

export function formatPermission(action: PermissionAction, resourceType: ResourceType): string {
  return `${action}:${resourceType}`;
}

export function parsePermission(permissionStr: string): { action: PermissionAction; resourceType: ResourceType } | null {
  const parts = permissionStr.split(':');
  if (parts.length !== 2) {
    return null;
  }
  return {
    action: parts[0] as PermissionAction,
    resourceType: parts[1] as ResourceType,
  };
}
