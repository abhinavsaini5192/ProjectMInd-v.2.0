/**
 * Data Classification and Handling Rules (Phase 8.9 Governance)
 */

export type DataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SENSITIVE' | 'SECRET';

export type DataCategory =
  | 'PROJECT_METADATA'
  | 'SOURCE_METADATA'
  | 'SOURCE_CONTENT'
  | 'SECURITY_EVENTS'
  | 'CREDENTIALS'
  | 'AGENT_IDENTITY'
  | 'CONTEXT'
  | 'VERIFICATION'
  | 'AUDIT_RECORDS';

export interface DataHandlingPolicy {
  readonly classification: DataClassification;
  readonly canLog: boolean;
  readonly canExposeCrossScope: boolean;
  readonly requiresEncryptionAtRest: boolean;
  readonly requiresExplicitAuthorization: boolean;
  readonly description: string;
}

export const DATA_HANDLING_POLICIES: Record<DataClassification, DataHandlingPolicy> = {
  PUBLIC: {
    classification: 'PUBLIC',
    canLog: true,
    canExposeCrossScope: true,
    requiresEncryptionAtRest: false,
    requiresExplicitAuthorization: false,
    description: 'Publicly distributable information without access restrictions',
  },
  INTERNAL: {
    classification: 'INTERNAL',
    canLog: true,
    canExposeCrossScope: false,
    requiresEncryptionAtRest: false,
    requiresExplicitAuthorization: true,
    description: 'Internal platform operational data; requires authenticated identity',
  },
  CONFIDENTIAL: {
    classification: 'CONFIDENTIAL',
    canLog: true,
    canExposeCrossScope: false,
    requiresEncryptionAtRest: true,
    requiresExplicitAuthorization: true,
    description: 'Workspace- or repository-scoped data; strictly isolated to authorized tenant',
  },
  SENSITIVE: {
    classification: 'SENSITIVE',
    canLog: false,
    canExposeCrossScope: false,
    requiresEncryptionAtRest: true,
    requiresExplicitAuthorization: true,
    description: 'Audit logs, security events, and user personal data; restricted access only',
  },
  SECRET: {
    classification: 'SECRET',
    canLog: false,
    canExposeCrossScope: false,
    requiresEncryptionAtRest: true,
    requiresExplicitAuthorization: true,
    description: 'Cryptographic keys, tokens, and credentials; never logged, exposed, or transmitted in plaintext',
  },
};

export const DEFAULT_CATEGORY_CLASSIFICATIONS: Record<DataCategory, DataClassification> = {
  PROJECT_METADATA: 'CONFIDENTIAL',
  SOURCE_METADATA: 'CONFIDENTIAL',
  SOURCE_CONTENT: 'CONFIDENTIAL',
  SECURITY_EVENTS: 'SENSITIVE',
  CREDENTIALS: 'SECRET',
  AGENT_IDENTITY: 'INTERNAL',
  CONTEXT: 'CONFIDENTIAL',
  VERIFICATION: 'CONFIDENTIAL',
  AUDIT_RECORDS: 'SENSITIVE',
};

export class DataClassifier {
  public static getClassification(category: DataCategory): DataClassification {
    return DEFAULT_CATEGORY_CLASSIFICATIONS[category] ?? 'CONFIDENTIAL';
  }

  public static getPolicy(classification: DataClassification): DataHandlingPolicy {
    return DATA_HANDLING_POLICIES[classification];
  }

  public static canLog(classification: DataClassification): boolean {
    return DATA_HANDLING_POLICIES[classification].canLog;
  }

  public static canLogCategory(category: DataCategory): boolean {
    const classification = this.getClassification(category);
    return this.canLog(classification);
  }

  public static isSafeToExpose(classification: DataClassification, isSameScope: boolean): boolean {
    if (classification === 'SECRET') return false;
    if (classification === 'PUBLIC') return true;
    return isSameScope;
  }
}
