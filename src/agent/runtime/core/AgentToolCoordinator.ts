import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../protocol/models/ToolResponse.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentToolPipeline } from '../../protocol/interfaces/IAgentToolPipeline.js';
import type { IAgentToolCoordinator } from '../interfaces/IAgentToolCoordinator.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';
import { RuntimeCapacityError, RuntimeTimeoutError } from '../errors/AgentRuntimeError.js';

export class AgentToolCoordinator implements IAgentToolCoordinator {
  constructor(
    private readonly pipeline: IAgentToolPipeline,
    private readonly defaultTimeoutMs: number = 30000,
    private readonly maxPayloadSizeBytes: number = 10 * 1024 * 1024,
    private readonly telemetry?: IAgentRuntimeTelemetry | undefined
  ) {}

  public validatePermissions(toolName: string, session?: AgentSession | undefined): boolean {
    if (!session) {
      return true;
    }
    // All registered canonical tools are permitted if session is ACTIVE
    return session.status === 'ACTIVE';
  }

  public async executeTool(request: ToolRequest, session?: AgentSession | undefined): Promise<ToolResponse> {
    const payloadSize = this.estimatePayloadSize(request);
    if (payloadSize > this.maxPayloadSizeBytes) {
      this.telemetry?.incrementRejectedRequests();
      throw new RuntimeCapacityError(
        `Tool request payload exceeds maximum limit of ${this.maxPayloadSizeBytes} bytes`,
        'PAYLOAD_SIZE',
        this.maxPayloadSizeBytes,
        payloadSize
      );
    }

    const startTime = Date.now();
    let isSuccess = false;

    try {
      const response = await this.executeWithTimeout(request, session, this.defaultTimeoutMs);
      isSuccess = response.success;
      return response;
    } catch (err: unknown) {
      isSuccess = false;
      throw err;
    } finally {
      const durationMs = Date.now() - startTime;
      this.telemetry?.recordToolExecution(durationMs, isSuccess);
    }
  }

  private async executeWithTimeout(
    request: ToolRequest,
    session: AgentSession | undefined,
    timeoutMs: number
  ): Promise<ToolResponse> {
    let timer: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new RuntimeTimeoutError(`executeTool(${request.toolName})`, timeoutMs));
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        this.pipeline.execute(request, session),
        timeoutPromise,
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private estimatePayloadSize(request: ToolRequest): number {
    try {
      return JSON.stringify(request).length;
    } catch {
      return 0;
    }
  }
}
