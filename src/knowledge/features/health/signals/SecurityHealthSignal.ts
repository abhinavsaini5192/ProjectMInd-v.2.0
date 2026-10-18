import { SecuritySanitizer } from '../../../../intelligence/agent/hardening/SecuritySanitizer.js';
import type { IFeatureHealthSignal, HealthContext } from '../interfaces/IFeatureHealthSignal.js';
import type { HealthSignal } from '../models/HealthSignal.js';
import type { HealthSignalType } from '../models/HealthSignalType.js';
import { HealthSignalHelper } from './HealthSignalHelper.js';

export class SecurityHealthSignal implements IFeatureHealthSignal {
  public readonly id = 'SecurityHealthSignal';
  public readonly signalType: HealthSignalType = 'EXPOSED_SECRET';

  public async compute(context: HealthContext): Promise<HealthSignal[]> {
    const signals: HealthSignal[] = [];
    const featureId = context.feature.featureId;
    const mappings = context.mappings || [];

    // 1. Inspect configuration & code resources for exposed secrets
    for (const mapping of mappings) {
      const meta = (mapping as unknown as { metadata?: Record<string, unknown> }).metadata || {};

      // Check if value or raw content contains exposed secrets
      const rawText = typeof meta.rawContent === 'string' ? meta.rawContent : '';
      const rawKey = typeof meta.configKey === 'string' ? meta.configKey : '';
      const rawVal = typeof meta.configValue === 'string' ? meta.configValue : '';

      const testContent = `${mapping.resourceId} ${rawKey} ${rawVal} ${rawText}`;
      const redacted = SecuritySanitizer.redactSecrets(testContent);

      if (redacted !== testContent || meta.hasExposedSecret === true) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'EXPOSED_SECRET',
            severity: 'CRITICAL',
            value: 'POTENTIAL_EXPOSED_SECRET_DETECTED',
            normalizedValue: 100,
            description: `Potential hardcoded secret or token detected in resource "${mapping.resourceId}".`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'SECURITY_AUDIT',
                sourceId: mapping.resourceId,
                evidenceType: 'SECRET_SCAN_MATCH',
                description: `SecuritySanitizer detected sensitive secret/token pattern in resource ${mapping.resourceId}.`,
                strength: 1.0,
                confidence: 0.95
              })
            ],
            source: this.id,
            confidence: 0.95
          })
        );
      }

      // Check for prompt injection indicators in documentation resources
      if (mapping.resourceType === 'DOCUMENTATION' || /doc|readme|guide/i.test(mapping.resourceId)) {
        if (rawText) {
          const injection = SecuritySanitizer.checkPromptInjection(rawText, false);
          if (injection.detected) {
            signals.push(
              HealthSignalHelper.createSignal({
                featureId,
                signalType: 'PROMPT_INJECTION_VULNERABILITY',
                severity: 'CRITICAL',
                value: injection.matches?.join(', ') || 'PROMPT_INJECTION_SUSPECTED',
                normalizedValue: 95,
                description: `Suspected prompt injection sequence found in documentation resource "${mapping.resourceId}".`,
                evidence: [
                  HealthSignalHelper.createEvidence({
                    sourceType: 'DOCUMENTATION_RESOURCE',
                    sourceId: mapping.resourceId,
                    evidenceType: 'PROMPT_INJECTION_MATCH',
                    description: `Injection pattern flagged: ${injection.matches?.join(', ') || 'Pattern matched suspicious instruction override'}`,
                    confidence: 0.92
                  })
                ],
                source: this.id,
                confidence: 0.92
              })
            );
          }
        }
      }

      // Insecure configuration (e.g. debug enabled, permissive cors)
      if (meta.permissiveCors === true || /allow-all|\*.*origin/i.test(rawVal)) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'PERMISSIVE_CORS',
            severity: 'HIGH',
            value: 'CORS_ALLOW_ALL',
            normalizedValue: 75,
            description: `Wildcard or permissive CORS policy detected in resource "${mapping.resourceId}".`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'SECURITY_AUDIT',
                sourceId: mapping.resourceId,
                evidenceType: 'PERMISSIVE_CORS_RULE',
                description: `Permissive origin configuration found.`,
                confidence: 0.9
              })
            ],
            source: this.id,
            confidence: 0.9
          })
        );
      }
    }

    // 2. Check for missing authentication on sensitive features/endpoints
    const isSensitiveFeature =
      /admin|auth|payment|billing|user|secret|credential|token/i.test(context.feature.name) ||
      (context.feature.type as any) === 'CORE' ||
      context.feature.type === 'PLATFORM';

    const endpoints = mappings.filter(
      (m) => m.resourceType === 'ENDPOINT' || /endpoint|routes|controller|api/i.test(m.resourceId)
    );

    if (isSensitiveFeature && endpoints.length > 0) {
      const hasAuthMiddleware = mappings.some((m) =>
        /auth|jwt|guard|permission|rbac|session/i.test(m.resourceId)
      );

      if (!hasAuthMiddleware) {
        signals.push(
          HealthSignalHelper.createSignal({
            featureId,
            signalType: 'MISSING_AUTHENTICATION',
            severity: 'CRITICAL',
            value: 'UNAUTHENTICATED_SENSITIVE_ENDPOINT',
            normalizedValue: 90,
            description: `Sensitive feature "${context.feature.name}" exposes endpoints without detected authentication guard or middleware.`,
            evidence: [
              HealthSignalHelper.createEvidence({
                sourceType: 'SECURITY_AUDIT',
                sourceId: featureId,
                evidenceType: 'MISSING_AUTH_GUARD',
                description: `Sensitive endpoints mapped without auth middleware.`,
                confidence: 0.88
              })
            ],
            source: this.id,
            confidence: 0.88
          })
        );
      }
    }

    return signals;
  }
}
