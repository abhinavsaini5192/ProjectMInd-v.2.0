import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { IKnowledgeUpdateValidator } from '../interfaces/IKnowledgeUpdateValidator.js';
import {
  InvalidKnowledgeUpdateError,
  KnowledgeUpdateScopeError,
} from '../errors/KnowledgeUpdateError.js';

const SECRET_PATTERNS = [
  { regex: /ghp_[A-Za-z0-9_]{36,}/g, mask: '[REDACTED_SECRET]' },
  { regex: /npm_[A-Za-z0-9_]{36,}/g, mask: '[REDACTED_SECRET]' },
  { regex: /sk-ant-[A-Za-z0-9\-_]{20,}/g, mask: '[REDACTED_SECRET]' },
  { regex: /sk-[A-Za-z0-9]{20,}/g, mask: '[REDACTED_SECRET]' },
  { regex: /xoxb-[A-Za-z0-9\-]+/g, mask: '[REDACTED_SECRET]' },
  { regex: /AKIA[0-9A-Z]{16}/g, mask: '[REDACTED_SECRET]' },
  { regex: /bearer\s+[A-Za-z0-9\-_\.=]{20,}/gi, mask: 'Bearer [REDACTED_SECRET]' },
  {
    regex: /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    mask: '$1=[REDACTED_SECRET]',
  },
];

export class KnowledgeUpdateValidator implements IKnowledgeUpdateValidator {
  public validate(update: KnowledgeUpdate): void {
    if (!update.repositoryId || !update.repositoryId.trim()) {
      throw new KnowledgeUpdateScopeError('Knowledge update repositoryId must not be empty.');
    }

    if (update.workspaceId !== undefined && !update.workspaceId.trim()) {
      throw new KnowledgeUpdateScopeError('Knowledge update workspaceId must not be an empty string.');
    }

    // Path traversal check
    for (const resource of update.affectedResources) {
      if (resource.includes('..') || resource.includes('\0')) {
        throw new InvalidKnowledgeUpdateError(
          `Security violation: Resource path '${resource}' contains directory traversal or invalid characters.`,
          { resource, updateId: update.updateId }
        );
      }
      if (/^[a-zA-Z]:[\\/]/.test(resource) || resource.startsWith('/etc/') || resource.startsWith('/var/')) {
        throw new InvalidKnowledgeUpdateError(
          `Security violation: Absolute system path '${resource}' is outside the repository scope.`,
          { resource, updateId: update.updateId }
        );
      }
    }

    // Anti-forging provenance check
    if (
      (update.source as string) === 'AGENT' ||
      update.source === 'MANUAL'
    ) {
      if (update.provenance === 'SYSTEM_VERIFIED') {
        throw new InvalidKnowledgeUpdateError(
          'Security violation: Agent-reported or manual updates cannot claim SYSTEM_VERIFIED provenance.',
          { updateId: update.updateId, source: update.source, provenance: update.provenance }
        );
      }
    }
  }

  public sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      sanitized[key] = this.sanitizeValue(value);
    }
    return sanitized;
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return this.redactSecrets(value);
    }
    if (Array.isArray(value)) {
      return value.map((v) => this.sanitizeValue(v));
    }
    if (value !== null && typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj)) {
        cleaned[k] = this.sanitizeValue(v);
      }
      return cleaned;
    }
    return value;
  }

  private redactSecrets(text: string): string {
    let result = text;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern.regex, pattern.mask);
    }
    return result;
  }
}
