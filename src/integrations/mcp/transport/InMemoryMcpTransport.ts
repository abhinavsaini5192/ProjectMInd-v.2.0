import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';
import type { TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { IMcpTransport } from './IMcpTransport.js';

/**
 * An in-memory, bidirectional transport for fast, deterministic integration
 * and unit testing of MCP servers and clients without standard I/O streams or network sockets.
 */
export class InMemoryMcpTransport implements IMcpTransport {
  private peer?: InMemoryMcpTransport | undefined;
  private started: boolean = false;
  private closed: boolean = false;

  public onclose?: () => void;
  public onerror?: (error: Error) => void;
  public onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;
  public sessionId?: string;
  public setProtocolVersion?: (version: string) => void;

  /**
   * Creates a linked pair of in-memory transports connected to each other.
   * Typically: [serverTransport, clientTransport]
   */
  public static createLinkedPair(): [InMemoryMcpTransport, InMemoryMcpTransport] {
    const a = new InMemoryMcpTransport();
    const b = new InMemoryMcpTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  public async start(): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot start closed InMemoryMcpTransport');
    }
    this.started = true;
  }

  public async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    if (this.closed) {
      throw new Error('Cannot send on closed InMemoryMcpTransport');
    }
    if (!this.peer || this.peer.closed) {
      throw new Error('Peer transport is not connected or already closed');
    }

    const cloned = JSON.parse(JSON.stringify(message)) as JSONRPCMessage;
    const peer = this.peer;

    // Asynchronously dispatch to simulate real message pump
    queueMicrotask(() => {
      if (!peer.closed && peer.onmessage) {
        try {
          peer.onmessage(cloned);
        } catch (err) {
          peer.onerror?.(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });
  }

  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.onclose) {
      try {
        this.onclose();
      } catch {
        // Ignore errors in onclose
      }
    }

    if (this.peer && !this.peer.closed) {
      const peer = this.peer;
      this.peer = undefined;
      await peer.close();
    }
  }

  public isStarted(): boolean {
    return this.started;
  }

  public isClosed(): boolean {
    return this.closed;
  }
}
