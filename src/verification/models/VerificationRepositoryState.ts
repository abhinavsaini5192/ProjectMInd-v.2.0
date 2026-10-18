export type RepositoryStateBindingStatus = 'BOUND' | 'UNBOUND' | 'UNKNOWN';

export interface VerificationRepositoryState {
  readonly status: RepositoryStateBindingStatus;
  readonly commitId?: string | undefined;
  readonly branch?: string | undefined;
  readonly workingTreeHash?: string | undefined;
  readonly contextVersion?: number | undefined;
  readonly knowledgeVersion?: number | undefined;
  readonly changeSetId?: string | undefined;
}

export const UNKNOWN_REPOSITORY_STATE: VerificationRepositoryState = {
  status: 'UNKNOWN',
};
