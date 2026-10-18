import { JobError } from '../models/JobError.js';

export class TenantIsolationGuard {
  public static readonly MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB

  public static assertWorkspaceAccess(targetWorkspaceId: string, allowedWorkspaceId: string): void {
    if (targetWorkspaceId !== allowedWorkspaceId) {
      throw new JobError(
        'JOB_SCOPE_INVALID',
        `Access denied: Target workspace '${targetWorkspaceId}' does not match caller workspace '${allowedWorkspaceId}'`,
        false
      );
    }
  }

  public static assertOrganizationAccess(targetOrgId: string, allowedOrgId: string): void {
    if (targetOrgId !== allowedOrgId) {
      throw new JobError(
        'JOB_AUTHORIZATION_FAILED',
        `Access denied: Cross-organization access between '${targetOrgId}' and '${allowedOrgId}' is prohibited`,
        false
      );
    }
  }

  public static assertPayloadSafe(payload: unknown, maxBytes: number = TenantIsolationGuard.MAX_PAYLOAD_BYTES): void {
    if (payload === null || payload === undefined) return;

    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const size = Buffer.byteLength(serialized, 'utf8');

    if (size > maxBytes) {
      throw new JobError(
        'JOB_PAYLOAD_INVALID',
        `Payload size (${size} bytes) exceeds maximum allowable limit of ${maxBytes} bytes`,
        false
      );
    }

    // Check for dangerous system command injection indicators and prototype pollution
    const payloadStr = serialized.toLowerCase();
    const hasDangerousKey =
      typeof payload === 'object' &&
      payload !== null &&
      (Object.prototype.hasOwnProperty.call(payload, '__proto__') ||
       Object.prototype.hasOwnProperty.call(payload, 'constructor') ||
       Object.prototype.hasOwnProperty.call(payload, 'prototype'));

    if (
      payloadStr.includes('__proto__') ||
      payloadStr.includes('constructor.prototype') ||
      payloadStr.includes('/bin/sh') ||
      payloadStr.includes('cmd.exe /c') ||
      hasDangerousKey
    ) {
      throw new JobError(
        'JOB_PAYLOAD_INVALID',
        'Payload contains prohibited executable or prototype pollution patterns',
        false
      );
    }
  }
}
