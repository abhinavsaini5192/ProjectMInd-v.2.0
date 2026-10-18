import { ToolPayloadTooLargeError } from '../errors/ToolPayloadTooLargeError.js';
import { ToolArgumentError } from '../errors/ToolArgumentError.js';

export class ToolSafetyValidator {
  public static readonly DEFAULT_MAX_PAYLOAD_BYTES = 512 * 1024; // 512 KB

  private static readonly DANGEROUS_KEYS = new Set([
    'exec',
    'eval',
    'spawn',
    'fork',
    'shellcommand',
    'shell',
    'child_process',
    '__proto__',
    'constructor',
    'prototype',
  ]);

  private static readonly PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)|%2e%2e|\0/i;

  public static validate(
    args: Record<string, unknown>,
    toolName: string,
    maxPayloadBytes: number = this.DEFAULT_MAX_PAYLOAD_BYTES,
    requestId?: string
  ): void {
    // 1. Check serialized payload size
    const serialized = JSON.stringify(args);
    const byteSize = Buffer.byteLength(serialized, 'utf8');

    if (byteSize > maxPayloadBytes) {
      throw new ToolPayloadTooLargeError(
        `Payload size (${byteSize} bytes) exceeds maximum allowed limit of ${maxPayloadBytes} bytes for tool '${toolName}'`,
        { toolName, byteSize, maxPayloadBytes },
        requestId
      );
    }

    // 2. Deep inspection for forbidden keys and path traversals
    this.inspectNode(args, toolName, 0, requestId);
  }

  private static inspectNode(
    node: unknown,
    toolName: string,
    depth: number,
    requestId?: string
  ): void {
    if (depth > 10 || !node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        if (typeof item === 'string') {
          this.checkPathTraversal(item, toolName, requestId);
        } else if (typeof item === 'object') {
          this.inspectNode(item, toolName, depth + 1, requestId);
        }
      }
      return;
    }

    const obj = node as Record<string, unknown>;
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      if (this.DANGEROUS_KEYS.has(lowerKey)) {
        throw new ToolArgumentError(
          `Security violation: forbidden argument key '${key}' detected in invocation of '${toolName}'`,
          { toolName, forbiddenKey: key },
          requestId
        );
      }

      if (typeof value === 'string') {
        this.checkPathTraversal(value, toolName, requestId);
      } else if (typeof value === 'object' && value !== null) {
        this.inspectNode(value, toolName, depth + 1, requestId);
      }
    }
  }

  private static checkPathTraversal(val: string, toolName: string, requestId?: string): void {
    if (this.PATH_TRAVERSAL_PATTERN.test(val)) {
      throw new ToolArgumentError(
        `Security violation: directory traversal or null byte pattern detected in argument value for tool '${toolName}'`,
        { toolName, snippet: val.substring(0, 50) },
        requestId
      );
    }
  }
}
