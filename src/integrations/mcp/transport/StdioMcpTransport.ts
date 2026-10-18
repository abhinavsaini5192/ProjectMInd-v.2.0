import type { Readable, Writable } from 'node:stream';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { IMcpTransport } from './IMcpTransport.js';

export interface StdioMcpTransportOptions {
  stdin?: Readable | undefined;
  stdout?: Writable | undefined;
  maxBufferSize?: number | undefined;
}

/**
 * Standard I/O transport for connecting to MCP clients (such as Claude Desktop, Cursor, etc.)
 * over standard input and standard output streams.
 */
export class StdioMcpTransport extends StdioServerTransport implements IMcpTransport {
  constructor(options: StdioMcpTransportOptions = {}) {
    super(
      options.stdin,
      options.stdout,
      options.maxBufferSize !== undefined ? { maxBufferSize: options.maxBufferSize } : undefined
    );
  }
}
