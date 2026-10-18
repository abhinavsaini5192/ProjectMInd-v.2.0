export type PermissionAction =
  | 'READ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXECUTE'
  | 'MANAGE'
  | 'ADMINISTER'
  | 'OBSERVE'
  | 'VERIFY'
  | 'REPORT'
  | 'REFRESH'
  | 'CONNECT'
  | 'CONFIGURE';

export const PERMISSION_ACTIONS: readonly PermissionAction[] = [
  'READ',
  'CREATE',
  'UPDATE',
  'DELETE',
  'EXECUTE',
  'MANAGE',
  'ADMINISTER',
  'OBSERVE',
  'VERIFY',
  'REPORT',
  'REFRESH',
  'CONNECT',
  'CONFIGURE',
] as const;

export function isPermissionAction(value: unknown): value is PermissionAction {
  return typeof value === 'string' && PERMISSION_ACTIONS.includes(value as PermissionAction);
}
