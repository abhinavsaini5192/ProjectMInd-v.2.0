// Phase 7.1 Agent Integration Architecture
export * from './models/index.js';
export * from './errors/index.js';
export * from './architecture/index.js';
export * from './interfaces/index.js';
export * from './events/index.js';
export * from './runtime/index.js';
export * from './handlers/index.js';
export * from './adapters/index.js';
export * from './di/index.js';
export * from './protocol/index.js';
export * from './context/index.js';
export * from './observation/index.js';
export * from './collaboration/index.js';
export * from './planning/index.js';

// Explicit disambiguations for overlapping barrel exports
export { AgentRuntimeError } from './errors/index.js';
export { TaskLifecycleError, TaskNotFoundError } from './runtime/index.js';
export type { AgentTask } from './models/index.js';
export type { IAgentAdapter } from './interfaces/index.js';
export type { ExecutionReportResult } from './handlers/index.js';
export type { ScopeValidationParams } from './runtime/index.js';
export type { ConflictSeverity } from './observation/index.js';
