import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentOperationType } from '../models/AgentOperation.js';
import { isSupportedProtocolVersion } from '../models/AgentProtocolVersion.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';
import { AgentVersionError } from '../errors/AgentVersionError.js';
import { AgentBoundary } from '../architecture/AgentBoundary.js';

const VALID_OPERATIONS: ReadonlySet<AgentOperationType> = new Set([
  'GET_CONTEXT',
  'GET_FEATURE',
  'GET_FEATURE_CONTEXT',
  'GET_IMPACT',
  'GET_ARCHITECTURE',
  'GET_HISTORY',
  'GET_HEALTH',
  'EXPLAIN_CONTEXT',
  'REFRESH_CONTEXT',
  'REPORT_EXECUTION',
  'REPORT_VERIFICATION',
  'UPDATE_KNOWLEDGE',
]);

export class AgentRequestValidator {
  public static validate(request: AgentRequest): void {
    if (!request || typeof request !== 'object') {
      throw new AgentValidationError('Request must be a valid non-null object');
    }

    if (!request.requestId || typeof request.requestId !== 'string' || request.requestId.trim() === '') {
      throw new AgentValidationError("Request missing mandatory 'requestId'");
    }

    if (!request.protocolVersion || typeof request.protocolVersion !== 'string') {
      throw new AgentValidationError("Request missing mandatory 'protocolVersion'");
    }

    if (!isSupportedProtocolVersion(request.protocolVersion)) {
      throw new AgentVersionError(
        `Unsupported agent protocol version '${request.protocolVersion}'`,
        { version: request.protocolVersion }
      );
    }

    if (!request.agentId || typeof request.agentId !== 'string' || request.agentId.trim() === '') {
      throw new AgentValidationError("Request missing mandatory 'agentId'");
    }

    if (!request.operation || !VALID_OPERATIONS.has(request.operation)) {
      throw new AgentValidationError(
        `Invalid or unsupported operation '${request.operation}'`
      );
    }

    if (!request.workspaceContext || typeof request.workspaceContext !== 'object') {
      throw new AgentValidationError("Request missing mandatory 'workspaceContext'");
    }

    // Assert workspace boundary
    AgentBoundary.assertValidWorkspaceScope(request.workspaceContext);

    // Assert execution safety boundary
    AgentBoundary.assertWithinBoundary(request.operation, request.payload);
  }
}
