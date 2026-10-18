import { ActionGraph } from '../../actions/models/ActionGraph';
import { ExecutionContext } from '../models/ExecutionContext';
import { ExecutionResult } from '../models/ExecutionResult';
import { ExecutionState } from '../models/ExecutionState';
import { ActionResult } from '../models/ActionResult';
import { ExecutionScheduler } from './ExecutionScheduler';
import { IActionExecutor } from '../executors/IActionExecutor';
import { FailureType, ExecutionError } from '../models/FailureTypes';
import { AgentAction } from '../../actions/models/AgentAction';
import { KernelEventDispatcher } from '../../../kernel/core/KernelEventDispatcher';
import { ExecutionEventType } from '../events/ExecutionEvents';

export class ExecutionEngine {
  constructor(
    private scheduler: ExecutionScheduler,
    private executors: IActionExecutor[],
    private dispatcher: KernelEventDispatcher
  ) {}

  public async execute(graph: ActionGraph, context: ExecutionContext): Promise<ExecutionResult> {
    this.dispatcher.publish(ExecutionEventType.EXECUTION_STARTED, { executionId: context.executionId });
    
    this.scheduler.initialize(graph);
    const actionResults: ActionResult[] = [];
    const startedAt = Date.now();

    let isRunning = true;
    while (isRunning) {
      if (context.isCancelled) {
        this.markRemainingAsCancelled(graph);
        break;
      }

      const readyActions = this.scheduler.getNextReadyActions(graph);
      
      if (readyActions.length === 0) {
         // Check if we are done or deadlocked
         const states = this.scheduler.getFinalStates();
         const hasPending = Array.from(states.values()).some(s => s === ExecutionState.PENDING || s === ExecutionState.RUNNING);
         if (!hasPending) isRunning = false;
         continue; // In a real async runner we'd wait for events here, but this is a synchronous simulation loop
      }

      for (const action of readyActions) {
        this.scheduler.updateActionState(action.actionId, ExecutionState.RUNNING);
        
        try {
          const result = await this.executeAction(action, context);
          actionResults.push(result);
          this.scheduler.updateActionState(action.actionId, result.status);
          
          if (result.status === ExecutionState.SUCCEEDED) {
            this.dispatcher.publish(ExecutionEventType.ACTION_SUCCEEDED, { actionId: action.actionId });
          } else {
            this.dispatcher.publish(ExecutionEventType.ACTION_FAILED, { actionId: action.actionId, errors: result.errors });
          }

        } catch (error: any) {
          this.scheduler.updateActionState(action.actionId, ExecutionState.FAILED);
          actionResults.push({
             actionId: action.actionId,
             status: ExecutionState.FAILED,
             startedAt: Date.now(),
             completedAt: Date.now(),
             output: {},
             warnings: [],
             errors: [error.message],
             changes: []
          });
          this.dispatcher.publish(ExecutionEventType.ACTION_FAILED, { actionId: action.actionId, errors: [error.message] });
        }
      }
    }

    const finalStates = this.scheduler.getFinalStates();
    const stateCounts = Array.from(finalStates.values()).reduce((acc, state) => {
       acc[state] = (acc[state] || 0) + 1;
       return acc;
    }, {} as Record<string, number>);

    const overallStatus = (stateCounts[ExecutionState.FAILED] ?? 0) > 0 
       ? ExecutionState.FAILED 
       : (context.isCancelled ? ExecutionState.CANCELLED : ExecutionState.SUCCEEDED);

    const result: ExecutionResult = {
      executionId: context.executionId,
      taskId: context.taskId,
      planId: context.planId,
      status: overallStatus,
      actions: actionResults,
      succeeded: stateCounts[ExecutionState.SUCCEEDED] || 0,
      failed: stateCounts[ExecutionState.FAILED] || 0,
      blocked: stateCounts[ExecutionState.BLOCKED] || 0,
      cancelled: stateCounts[ExecutionState.CANCELLED] || 0,
      duration: Date.now() - startedAt,
      changes: actionResults.flatMap(r => r.changes),
      warnings: actionResults.flatMap(r => r.warnings),
      errors: actionResults.flatMap(r => r.errors)
    };

    if (overallStatus === ExecutionState.SUCCEEDED) {
       this.dispatcher.publish(ExecutionEventType.EXECUTION_COMPLETED, { executionId: context.executionId });
    } else {
       this.dispatcher.publish(ExecutionEventType.EXECUTION_FAILED, { executionId: context.executionId });
    }

    return result;
  }

  private async executeAction(action: AgentAction, context: ExecutionContext): Promise<ActionResult> {
    // 1. Security enforcement
    const decision = context.policyDecisions.get(action.actionId);
    if (!decision) throw new ExecutionError(FailureType.PERMISSION_DENIED, 'No security decision found for action');
    if (decision.decision === 'DENY') throw new ExecutionError(FailureType.PERMISSION_DENIED, 'Action was DENIED by policy');
    if (decision.decision === 'REQUIRE_APPROVAL') throw new ExecutionError(FailureType.PERMISSION_DENIED, 'Action REQUIRE_APPROVAL was unapproved');

    // 2. Find executor
    const executor = this.executors.find(e => e.canExecute(action));
    if (!executor) throw new ExecutionError(FailureType.INTERNAL_ERROR, `No executor configured for ${action.type}`);

    // 3. Execute
    return await executor.execute(action, context);
  }

  private markRemainingAsCancelled(graph: ActionGraph): void {
     for (const action of graph.getAllActions()) {
        const state = this.scheduler.getFinalStates().get(action.actionId);
        if (state === ExecutionState.PENDING || state === ExecutionState.READY) {
           this.scheduler.updateActionState(action.actionId, ExecutionState.CANCELLED);
        }
     }
  }
}
