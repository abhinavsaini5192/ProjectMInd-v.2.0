import type { SecurityPrincipal } from '../models/SecurityPrincipal.js';

export type ProvenanceSource =
  | 'AGENT_REPORTED'
  | 'SYSTEM_OBSERVED'
  | 'SYSTEM_VERIFIED'
  | 'MANUAL'
  | 'CI'
  | 'UNKNOWN';

export class InvalidProvenanceError extends Error {
  constructor(
    public readonly principalId: string,
    public readonly claimedSource: string,
    public readonly reason: string
  ) {
    super(`Invalid provenance: principal '${principalId}' cannot claim source '${claimedSource}': ${reason}`);
    this.name = 'InvalidProvenanceError';
  }
}

export class ProvenanceValidator {
  /**
   * Asserts whether a principal has sufficient trust and authority to claim a given provenance source.
   * Enforces fail-closed rules: external agents and users cannot claim SYSTEM_* or CI sources.
   */
  public static validateProvenance(
    principal: SecurityPrincipal,
    claimedSource: ProvenanceSource
  ): { isValid: boolean; normalizedSource: ProvenanceSource; reason?: string } {
    const isSystem = principal.type === 'SYSTEM' || principal.authenticationMethod === 'SYSTEM';
    const isService = principal.type === 'SERVICE';
    const isAgent = principal.type === 'AGENT';
    const isUser = principal.type === 'USER';

    // 1. SYSTEM_VERIFIED requires internal SYSTEM or verified service authority
    if (claimedSource === 'SYSTEM_VERIFIED' && !isSystem) {
      return {
        isValid: false,
        normalizedSource: 'AGENT_REPORTED',
        reason: "Non-system principal cannot assert 'SYSTEM_VERIFIED' provenance",
      };
    }

    // 2. SYSTEM_OBSERVED requires internal system or monitoring service
    if (claimedSource === 'SYSTEM_OBSERVED' && !isSystem && !isService) {
      return {
        isValid: false,
        normalizedSource: 'AGENT_REPORTED',
        reason: "External agent/user cannot assert 'SYSTEM_OBSERVED' provenance",
      };
    }

    // 3. CI requires service credential or system integration
    if (claimedSource === 'CI' && isAgent) {
      return {
        isValid: false,
        normalizedSource: 'AGENT_REPORTED',
        reason: "Interactive agent cannot claim 'CI' provenance; must be attested by CI webhook or service principal",
      };
    }

    // Default valid mapping
    let normalized = claimedSource;
    if (isAgent && (claimedSource === 'UNKNOWN' || !claimedSource)) {
      normalized = 'AGENT_REPORTED';
    } else if (isUser && (claimedSource === 'UNKNOWN' || !claimedSource)) {
      normalized = 'MANUAL';
    }

    return {
      isValid: true,
      normalizedSource: normalized,
    };
  }

  public static assertProvenance(principal: SecurityPrincipal, claimedSource: ProvenanceSource): ProvenanceSource {
    const res = this.validateProvenance(principal, claimedSource);
    if (!res.isValid) {
      throw new InvalidProvenanceError(principal.principalId, claimedSource, res.reason ?? 'Provenance denied');
    }
    return res.normalizedSource;
  }
}
