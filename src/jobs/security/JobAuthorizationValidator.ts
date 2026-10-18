import type { Job } from '../models/Job.js';
import type { JobSecurityContext } from './JobSecurityContext.js';
import { JobError } from '../models/JobError.js';

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'password',
  'passwd',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'client_secret',
  'api_key',
  'apikey',
  'private_key',
  'privatekey',
]);

export class JobAuthorizationValidator {
  public static validate(job: Job, context?: JobSecurityContext): void {
    // 1. Workspace scope check
    if (context && context.workspaceId !== job.workspaceId) {
      throw new JobError(
        'JOB_SCOPE_INVALID',
        `Job workspace '${job.workspaceId}' does not match security context workspace '${context.workspaceId}'. Cross-workspace execution denied.`,
        false
      );
    }

    // 2. Repository scope check
    if (context && context.repositoryId && job.repositoryId && context.repositoryId !== job.repositoryId) {
      throw new JobError(
        'JOB_SCOPE_INVALID',
        `Job repository '${job.repositoryId}' does not match security context repository '${context.repositoryId}'. Cross-repository execution denied.`,
        false
      );
    }

    // 3. Payload secret scan
    this.scanForSecrets(job.payload, '');
  }

  private static scanForSecrets(obj: unknown, path: string): void {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        this.scanForSecrets(obj[i], `${path}[${i}]`);
      }
      return;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lower = key.toLowerCase();
      if (
        FORBIDDEN_PAYLOAD_KEYS.has(lower) ||
        lower.includes('secret') ||
        lower.includes('password')
      ) {
        throw new JobError(
          'JOB_PAYLOAD_INVALID',
          `Job payload contains prohibited secret key '${path ? `${path}.${key}` : key}'. Raw credentials are strictly forbidden in job payloads.`,
          false
        );
      }
      if (typeof value === 'object' && value !== null) {
        this.scanForSecrets(value, path ? `${path}.${key}` : key);
      }
    }
  }
}
