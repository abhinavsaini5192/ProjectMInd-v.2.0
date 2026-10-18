import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';
import { ObservationEvents } from '../../../src/agent/observation/events/ObservationEvents.js';

describe('Feature Knowledge Integration & Impact Notification', () => {
  it('emits resources_changed event on eventBus with affected resources without duplicating feature intelligence', async () => {
    const { processor, eventBus } = createObservationTestHarness();

    await processor.processExecutionReport(
      {
        taskId: 'task-feat-1',
        status: 'SUCCESS',
        summary: 'Modified AuthController and AuthService',
        modifiedFiles: ['src/auth/AuthController.ts', 'src/auth/AuthService.ts'],
      },
      'session-1'
    );

    const resourceEvents = eventBus.getEvents(ObservationEvents.RESOURCES_CHANGED);
    expect(resourceEvents.length).toBe(1);

    const event = resourceEvents[0]!;
    const payload = event.payload as any;
    expect(payload.taskId).toBe('task-feat-1');
    expect(payload.affectedResources).toEqual([
      'src/auth/AuthController.ts',
      'src/auth/AuthService.ts',
    ]);
    expect(payload.observationId).toBeDefined();
  });
});
