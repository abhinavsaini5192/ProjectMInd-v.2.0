import type { RawVerificationInput } from '../../../verification/interfaces/IVerificationNormalizer.js';

export interface SubmitVerificationRequestBody {
  readonly input: RawVerificationInput;
  readonly taskId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
}
