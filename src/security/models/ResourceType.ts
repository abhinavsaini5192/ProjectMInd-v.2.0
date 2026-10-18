export type ResourceType =
  | 'WORKSPACE'
  | 'PROJECT'
  | 'REPOSITORY'
  | 'FEATURE'
  | 'CONTEXT'
  | 'TASK'
  | 'SESSION'
  | 'AGENT'
  | 'TOOL'
  | 'KNOWLEDGE'
  | 'VERIFICATION'
  | 'OBSERVATION'
  | 'CONFIGURATION'
  | 'SECURITY_POLICY'
  | 'AUDIT'
  | 'ANALYTICS';

export const RESOURCE_TYPES: readonly ResourceType[] = [
  'WORKSPACE',
  'PROJECT',
  'REPOSITORY',
  'FEATURE',
  'CONTEXT',
  'TASK',
  'SESSION',
  'AGENT',
  'TOOL',
  'KNOWLEDGE',
  'VERIFICATION',
  'OBSERVATION',
  'CONFIGURATION',
  'SECURITY_POLICY',
  'AUDIT',
  'ANALYTICS',
] as const;

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === 'string' && RESOURCE_TYPES.includes(value as ResourceType);
}
