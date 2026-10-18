import type { IAgentAdapterValidator } from '../interfaces/IAgentAdapterValidator.js';
import type { AdapterRequest } from '../models/AdapterRequest.js';
import type { AdapterResponse } from '../models/AdapterResponse.js';
import type { AdapterMetadata } from '../models/AdapterMetadata.js';
import { AdapterValidationError } from '../errors/AgentAdapterError.js';

export class AgentAdapterValidator implements IAgentAdapterValidator {
  public validateAdapter(adapter: AdapterMetadata): void {
    if (!adapter) {
      throw new AdapterValidationError('unknown', 'Adapter metadata must be defined');
    }

    if (!adapter.adapterId || typeof adapter.adapterId !== 'string') {
      throw new AdapterValidationError('unknown', 'Adapter adapterId must be a non-empty string');
    }

    if (!adapter.name || typeof adapter.name !== 'string') {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter name must be a non-empty string');
    }

    if (!adapter.adapterVersion || typeof adapter.adapterVersion !== 'string') {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter adapterVersion must be defined');
    }

    if (!adapter.protocolVersion || typeof adapter.protocolVersion !== 'string') {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter protocolVersion must be defined');
    }

    if (!adapter.provider) {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter provider must be specified');
    }

    if (!adapter.protocol) {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter protocol must be specified');
    }

    if (!Array.isArray(adapter.capabilities)) {
      throw new AdapterValidationError(adapter.adapterId, 'Adapter capabilities must be an array');
    }
  }

  public validateRequest(
    request: AdapterRequest,
    expectedWorkspace?: { workspaceId: string; repositoryId: string }
  ): void {
    if (!request) {
      throw new AdapterValidationError('unknown', 'Request cannot be null or undefined');
    }

    if (!request.requestId) {
      throw new AdapterValidationError(request.adapterId ?? 'unknown', 'requestId must be provided');
    }

    if (!request.operation) {
      throw new AdapterValidationError(request.adapterId ?? 'unknown', 'operation must be provided');
    }

    if (!request.workspaceContext) {
      throw new AdapterValidationError(
        request.adapterId ?? 'unknown',
        'workspaceContext must be provided'
      );
    }

    const { workspaceId, repositoryId } = request.workspaceContext;
    if (!workspaceId || !repositoryId) {
      throw new AdapterValidationError(
        request.adapterId ?? 'unknown',
        'workspaceContext must include both workspaceId and repositoryId'
      );
    }

    // Scope boundary validation
    if (expectedWorkspace) {
      if (
        workspaceId !== expectedWorkspace.workspaceId ||
        repositoryId !== expectedWorkspace.repositoryId
      ) {
        throw new AdapterValidationError(
          request.adapterId ?? 'unknown',
          `Workspace scope mismatch: request references [${workspaceId}:${repositoryId}] but expected [${expectedWorkspace.workspaceId}:${expectedWorkspace.repositoryId}]`
        );
      }
    }

    // Anti-elevation check: External agent cannot claim authoritative verification truth
    if (request.payload && typeof request.payload === 'object') {
      const payloadObj = request.payload as Record<string, unknown>;
      if (
        payloadObj.trustedAuthority === true ||
        payloadObj.source === 'KERNEL_VERIFIED' ||
        payloadObj.evidenceGrade === 'A'
      ) {
        throw new AdapterValidationError(
          request.adapterId ?? 'unknown',
          'Security violation: external agent adapter cannot claim elevated kernel authority or pre-verified evidence grade'
        );
      }
    }
  }

  public validateResponse(response: AdapterResponse): void {
    if (!response) {
      throw new AdapterValidationError('unknown', 'Response cannot be null or undefined');
    }

    if (!response.requestId) {
      throw new AdapterValidationError(
        response.adapterId ?? 'unknown',
        'Response requestId must be defined'
      );
    }

    if (!response.status) {
      throw new AdapterValidationError(
        response.adapterId ?? 'unknown',
        'Response status must be defined'
      );
    }

    if (response.status === 'ERROR' && !response.error) {
      throw new AdapterValidationError(
        response.adapterId ?? 'unknown',
        "Response marked as 'ERROR' but error object is missing"
      );
    }
  }
}
