export const SECURITY_EVENTS = {
  AUTHENTICATION_SUCCEEDED: 'security.authentication.succeeded',
  AUTHENTICATION_FAILED: 'security.authentication.failed',
  AUTHORIZATION_DENIED: 'security.authorization.denied',
  SCOPE_VIOLATION: 'security.scope.violation',
  CREDENTIAL_REVOKED: 'security.credential.revoked',
  IDENTITY_CREATED: 'security.identity.created',
  IDENTITY_DISABLED: 'security.identity.disabled',
  ROLE_CHANGED: 'security.role.changed',
  PERMISSION_CHANGED: 'security.permission.changed',
  POLICY_VIOLATION: 'security.policy.violation',
  SECRET_DETECTED: 'security.secret.detected',
  INVALID_PROVENANCE: 'security.provenance.invalid',
  SECURITY_CONFIGURATION_ERROR: 'security.configuration.error',
  SUSPICIOUS_ACCESS: 'security.access.suspicious',
  RECOVERY_AUTHORIZATION_FAILED: 'security.recovery.authorization.failed',
  SECURITY_VIOLATION_DETECTED: 'security.violation.detected',
} as const;

export type SecurityEventType = (typeof SECURITY_EVENTS)[keyof typeof SECURITY_EVENTS];

export * from '../models/SecurityEvent.js';
