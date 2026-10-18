import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IAgentOperationRouter } from '../interfaces/IAgentOperationRouter.js';
import { AgentOperationError } from '../errors/AgentOperationError.js';

export class AgentOperationRouter implements IAgentOperationRouter {
  private readonly handlers = new Map<AgentOperationType, IAgentOperationHandler>();

  public registerHandler(handler: IAgentOperationHandler): void {
    this.handlers.set(handler.operation, handler);
  }

  public getHandler(operation: AgentOperationType): IAgentOperationHandler | undefined {
    return this.handlers.get(operation);
  }

  public async route(request: AgentRequest, session?: AgentSession | undefined): Promise<unknown> {
    const handler = this.handlers.get(request.operation);
    if (!handler) {
      throw new AgentOperationError(
        `No handler registered for operation '${request.operation}'`,
        request.operation
      );
    }

    return handler.handle(request, session);
  }
}
