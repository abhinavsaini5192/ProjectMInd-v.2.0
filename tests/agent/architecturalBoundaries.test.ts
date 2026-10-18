import { describe, it, expect } from 'vitest';
import {
  AGENT_ARCHITECTURE_BOUNDARY,
  PROHIBITED_CAPABILITIES,
} from '../../src/agent/architecture/AgentArchitecture.js';
import { AgentBoundary } from '../../src/agent/architecture/AgentBoundary.js';
import { AgentOperationError } from '../../src/agent/errors/AgentOperationError.js';
import { AgentScopeError } from '../../src/agent/errors/AgentScopeError.js';

describe('Architectural Boundaries & Guarantees', () => {
  it('confirms the defined architectural boundary and non-goals', () => {
    expect(AGENT_ARCHITECTURE_BOUNDARY.layer).toBe('AGENT_INTEGRATION_BOUNDARY');
    expect(AGENT_ARCHITECTURE_BOUNDARY.supportedProtocolVersions).toContain('1.0');
    expect(AGENT_ARCHITECTURE_BOUNDARY.nonGoals).toEqual(
      expect.arrayContaining([
        'Autonomous Code Execution',
        'Shell/Terminal Process Execution',
        'Uncontrolled Direct File Modifications',
        'Agent Authentication/Identity Provider Implementation',
      ])
    );
    expect(PROHIBITED_CAPABILITIES).toContain('EXECUTE_SHELL_COMMAND');
    expect(PROHIBITED_CAPABILITIES).toContain('ARBITRARY_CODE_EXECUTION');
  });

  it('rejects forbidden execution payloads trying to break boundary', () => {
    expect(() =>
      AgentBoundary.assertWithinBoundary('GET_CONTEXT', { shellCommand: 'node -e "..."' })
    ).toThrow(AgentOperationError);

    expect(() =>
      AgentBoundary.assertWithinBoundary('GET_CONTEXT', { execSync: 'whoami' })
    ).toThrow(AgentOperationError);

    expect(() =>
      AgentBoundary.assertWithinBoundary('GET_CONTEXT', { taskText: 'Clean valid payload' })
    ).not.toThrow();
  });

  it('enforces mandatory repository and workspace scoping', () => {
    expect(() =>
      AgentBoundary.assertValidWorkspaceScope({ workspaceId: '', repositoryId: 'repo' })
    ).toThrow(AgentScopeError);

    expect(() =>
      AgentBoundary.assertValidWorkspaceScope({ workspaceId: 'ws', repositoryId: '' })
    ).toThrow(AgentScopeError);

    expect(() =>
      AgentBoundary.assertValidWorkspaceScope({ workspaceId: 'ws', repositoryId: 'repo' })
    ).not.toThrow();
  });
});
