import { describe, it, expect, beforeEach } from 'vitest';
import { TaskUnderstandingEngine } from '../../src/context/task/TaskUnderstandingEngine.js';
import { DeterministicSemanticModel } from '../../src/context/task/DeterministicSemanticModel.js';

describe('Phase 9.3 - TaskUnderstandingEngine & Classification', () => {
  let engine: TaskUnderstandingEngine;

  beforeEach(() => {
    engine = new TaskUnderstandingEngine();
  });

  describe('Task Type & Intent Classification', () => {
    it('classifies implementation request: "Add OAuth authentication"', async () => {
      const task = await engine.understandTask({
        taskText: 'Add OAuth authentication support for Google and GitHub',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('IMPLEMENTATION');
      expect(task.intent).toBe('ADD');
      expect(task.candidateFeatures).toContain('oauth');
      expect(task.candidateFeatures).toContain('authentication');
      expect(task.confidence).toBeGreaterThanOrEqual(0.85);
      expect(task.provenance).toBe('DETERMINISTIC_RULES');
    });

    it('classifies bug fix request: "Fix payment timeout error"', async () => {
      const task = await engine.understandTask({
        taskText: 'Fix payment timeout error when customer cards expire',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('DEBUGGING');
      expect(task.intent).toBe('DEBUG');
      expect(task.candidateFeatures).toContain('payment');
    });

    it('classifies investigation request: "Why does this API return 401?"', async () => {
      const task = await engine.understandTask({
        taskText: 'Why does this API return 401 unauthorized on expired sessions?',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('INVESTIGATION');
      expect(task.intent).toBe('INVESTIGATE');
      expect(task.candidateFeatures).toContain('api');
      expect(task.candidateFeatures).toContain('session');
    });

    it('classifies refactoring request: "Refactor database query layer"', async () => {
      const task = await engine.understandTask({
        taskText: 'Refactor database query layer to eliminate N+1 queries',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('REFACTOR');
      expect(task.intent).toBe('MODIFY');
      expect(task.candidateFeatures).toContain('database');
    });

    it('classifies testing request: "Add tests for user authentication"', async () => {
      const task = await engine.understandTask({
        taskText: 'Add unit tests for user authentication and password validation',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('TESTING');
      expect(task.intent).toBe('TEST');
      expect(task.candidateFeatures).toContain('authentication');
      expect(task.candidateFeatures).toContain('user');
    });

    it('classifies architecture and performance tasks', async () => {
      const arch = await engine.understandTask({
        taskText: 'Design distributed event architecture for notification service',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });
      expect(arch.taskType).toBe('ARCHITECTURE');
      expect(arch.intent).toBe('DESIGN');

      const perf = await engine.understandTask({
        taskText: 'Optimize slow query latency in checkout database',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });
      expect(perf.taskType).toBe('PERFORMANCE');
      expect(perf.intent).toBe('OPTIMIZE');
    });

    it('handles ambiguous or unknown requests without forced over-classification', async () => {
      const task = await engine.understandTask({
        taskText: 'hello world greeting script',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.taskType).toBe('UNKNOWN');
      expect(task.confidence).toBeLessThanOrEqual(0.5);
    });
  });

  describe('Constraint Extraction', () => {
    it('extracts explicit constraints from task text', async () => {
      const task = await engine.understandTask({
        taskText: 'Fix checkout error without modifying the database schema and keep API backwards compatible',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      expect(task.constraints.some((c) => c.type === 'EXPLICIT_CONSTRAINT')).toBe(true);
      const explicit = task.constraints.filter((c) => c.type === 'EXPLICIT_CONSTRAINT');
      expect(explicit.length).toBeGreaterThanOrEqual(1);
      expect(explicit[0].confidence).toBeGreaterThan(0.9);
    });

    it('extracts inferred constraints for bug fixes with bounded confidence <= 0.7', async () => {
      const task = await engine.understandTask({
        taskText: 'Fix login error in authentication',
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
      });

      const inferred = task.constraints.filter((c) => c.type === 'INFERRED_CONSTRAINT');
      expect(inferred.length).toBeGreaterThan(0);
      for (const inf of inferred) {
        expect(inf.confidence).toBeLessThanOrEqual(0.7);
      }
    });
  });
});
