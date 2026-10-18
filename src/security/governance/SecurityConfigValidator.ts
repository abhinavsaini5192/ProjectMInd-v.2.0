export interface PlatformSecurityConfig {
  readonly environment: 'development' | 'test' | 'staging' | 'production';
  readonly debugMode: boolean;
  readonly allowUnsafeDevDefaults: boolean;
  readonly authMode: 'none' | 'token' | 'mtls' | 'oauth';
  readonly corsPolicy?: {
    readonly allowedOrigins: readonly string[];
    readonly allowCredentials?: boolean | undefined;
  } | undefined;
  readonly secretConfiguration?: Record<string, unknown> | undefined;
}

export interface SecurityConfigValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedAt: number;
}

export class SecurityConfigValidator {
  /**
   * Validates production security configuration at startup.
   * Enforces fail-closed rules when running in production or staging.
   */
  public static validate(config: PlatformSecurityConfig): SecurityConfigValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const isProductionLike = config.environment === 'production' || config.environment === 'staging';

    // 1. Debug Mode check
    if (isProductionLike && config.debugMode) {
      errors.push('CRITICAL: debugMode must be disabled in production/staging environments');
    }

    // 2. Unsafe Dev Defaults check
    if (isProductionLike && config.allowUnsafeDevDefaults) {
      errors.push('CRITICAL: allowUnsafeDevDefaults must be false in production/staging environments');
    }

    // 3. Auth Mode check
    if (isProductionLike && config.authMode === 'none') {
      errors.push("CRITICAL: authMode cannot be 'none' in production/staging environments");
    } else if (config.authMode === 'none') {
      warnings.push("Authentication is disabled (authMode='none'); only permitted for local unit tests");
    }

    // 4. CORS Policy check
    if (config.corsPolicy) {
      const hasWildcardOrigin = config.corsPolicy.allowedOrigins.includes('*');
      if (hasWildcardOrigin && config.corsPolicy.allowCredentials) {
        errors.push("CORS security violation: wildcard origin '*' is strictly prohibited when allowCredentials is true");
      }
      if (isProductionLike && hasWildcardOrigin) {
        warnings.push("CORS wildcard origin '*' detected in production-like environment; recommend explicit origin whitelist");
      }
    }

    // 5. Plaintext secret inspection
    if (config.secretConfiguration) {
      for (const [key, val] of Object.entries(config.secretConfiguration)) {
        if (typeof val === 'string') {
          const lowerKey = key.toLowerCase();
          const isSecretField =
            lowerKey.includes('secret') ||
            lowerKey.includes('password') ||
            lowerKey.includes('token') ||
            lowerKey.includes('apikey');

          if (isSecretField && (val.startsWith('sk_') || val.length > 32)) {
            warnings.push(
              `Configuration property '${key}' appears to contain a raw credential value; use a secure vault reference instead`
            );
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      checkedAt: Date.now(),
    };
  }
}
