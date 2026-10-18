export type IdentityType = 'USER' | 'AGENT' | 'SERVICE' | 'SYSTEM' | 'UNKNOWN';

export const IDENTITY_TYPES: readonly IdentityType[] = [
  'USER',
  'AGENT',
  'SERVICE',
  'SYSTEM',
  'UNKNOWN',
] as const;

export function isIdentityType(value: unknown): value is IdentityType {
  return typeof value === 'string' && IDENTITY_TYPES.includes(value as IdentityType);
}
