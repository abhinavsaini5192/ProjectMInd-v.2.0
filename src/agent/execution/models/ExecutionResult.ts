import { ExecutionState } from './ExecutionState';
import { ActionResult } from './ActionResult';

export type ExecutionChange = string | { path: string; type: string };

export interface ExecutionResult {
  executionId: string;
  taskId: string;
  planId: string;
  status: ExecutionState;
  actions: ActionResult[];
  succeeded: number;
  failed: number;
  blocked: number;
  cancelled: number;
  duration: number;
  changes: ExecutionChange[];
  warnings: string[];
  errors: string[];
}
