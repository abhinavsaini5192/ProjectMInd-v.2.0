import type { McpServerState } from './McpServerState.js';
import { McpError } from '../errors/McpError.js';
import { McpErrorCodes } from '../errors/McpErrorCodes.js';

export class McpServerLifecycle {
  private state: McpServerState = 'STOPPED';
  private activeRequests = 0;
  private drainResolvers: Array<() => void> = [];

  public getState(): McpServerState {
    return this.state;
  }

  public isRunning(): boolean {
    return this.state === 'RUNNING';
  }

  public getActiveRequests(): number {
    return this.activeRequests;
  }

  /**
   * Transitions server state to STARTING, then to RUNNING.
   */
  public start(): void {
    if (this.state === 'RUNNING') {
      return;
    }
    if (this.state !== 'STOPPED' && this.state !== 'FAILED') {
      throw new McpError(
        `Cannot start server in state '${this.state}'`,
        McpErrorCodes.INTERNAL_ERROR
      );
    }

    this.state = 'STARTING';
    this.state = 'RUNNING';
  }

  /**
   * Tracks arrival of a new request. Throws if server is not accepting requests.
   */
  public enterRequest(): void {
    if (this.state === 'DRAINING') {
      throw new McpError(
        'Server is draining active connections and not accepting new requests',
        McpErrorCodes.SERVER_DRAINING
      );
    }
    if (this.state !== 'RUNNING') {
      throw new McpError(
        `Server is not running (current state: ${this.state})`,
        McpErrorCodes.INTERNAL_ERROR
      );
    }

    this.activeRequests++;
  }

  /**
   * Tracks completion of a request.
   */
  public exitRequest(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    if (this.activeRequests === 0 && this.drainResolvers.length > 0) {
      const resolvers = [...this.drainResolvers];
      this.drainResolvers = [];
      for (const resolve of resolvers) {
        resolve();
      }
    }
  }

  /**
   * Drains in-flight requests before stopping.
   */
  public async drain(timeoutMs: number = 5000): Promise<void> {
    if (this.state === 'STOPPED' || this.state === 'FAILED') {
      return;
    }

    this.state = 'DRAINING';

    if (this.activeRequests === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        // Remove resolver on timeout
        this.drainResolvers = this.drainResolvers.filter((r) => r !== resolve);
        resolve();
      }, timeoutMs);

      this.drainResolvers.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  /**
   * Gracefully shuts down the server.
   */
  public async stop(drainTimeoutMs: number = 5000): Promise<void> {
    if (this.state === 'STOPPED') {
      return;
    }

    await this.drain(drainTimeoutMs);

    this.state = 'STOPPING';
    this.state = 'STOPPED';
  }

  /**
   * Marks the server as failed due to unrecoverable error.
   */
  public fail(): void {
    this.state = 'FAILED';
  }
}
