import type { ToolRequest } from '../models/ToolRequest.js';
import { ToolProtocolError } from '../errors/ToolProtocolError.js';
import { ToolVersionError } from '../errors/ToolVersionError.js';

export class ToolRequestValidator {
  public static readonly SUPPORTED_PROTOCOL_VERSION = '1.0';

  public static validate(rawRequest: unknown): asserts rawRequest is ToolRequest {
    if (!rawRequest || typeof rawRequest !== 'object' || Array.isArray(rawRequest)) {
      throw new ToolProtocolError('ToolRequest envelope must be a non-null object');
    }

    const req = rawRequest as Record<string, unknown>;

    if (typeof req['requestId'] !== 'string' || !req['requestId'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: requestId');
    }
    const requestId = req['requestId'];

    if (typeof req['protocolVersion'] !== 'string' || !req['protocolVersion'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: protocolVersion', { requestId }, requestId);
    }

    if (req['protocolVersion'] !== this.SUPPORTED_PROTOCOL_VERSION) {
      throw new ToolVersionError(
        `Unsupported protocol version '${req['protocolVersion']}'. Expected '${this.SUPPORTED_PROTOCOL_VERSION}'.`,
        { received: req['protocolVersion'], expected: this.SUPPORTED_PROTOCOL_VERSION },
        requestId
      );
    }

    if (typeof req['toolName'] !== 'string' || !req['toolName'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: toolName', { requestId }, requestId);
    }

    if (!/^[a-z0-9_]+$/i.test(req['toolName'])) {
      throw new ToolProtocolError(
        `Invalid tool name '${req['toolName']}'. Must only contain alphanumeric characters and underscores.`,
        { toolName: req['toolName'] },
        requestId
      );
    }

    if (typeof req['agentId'] !== 'string' || !req['agentId'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: agentId', { requestId }, requestId);
    }

    if (typeof req['workspaceId'] !== 'string' || !req['workspaceId'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: workspaceId', { requestId }, requestId);
    }

    if (typeof req['repositoryId'] !== 'string' || !req['repositoryId'].trim()) {
      throw new ToolProtocolError('ToolRequest missing required field: repositoryId', { requestId }, requestId);
    }

    if (!req['arguments'] || typeof req['arguments'] !== 'object' || Array.isArray(req['arguments'])) {
      throw new ToolProtocolError('ToolRequest arguments must be a non-null key-value object', { requestId }, requestId);
    }

    if (req['sessionId'] !== undefined && (typeof req['sessionId'] !== 'string' || !req['sessionId'].trim())) {
      throw new ToolProtocolError('ToolRequest sessionId must be a non-empty string if provided', { requestId }, requestId);
    }

    if (req['metadata'] !== undefined && (typeof req['metadata'] !== 'object' || Array.isArray(req['metadata']))) {
      throw new ToolProtocolError('ToolRequest metadata must be an object if provided', { requestId }, requestId);
    }
  }
}
