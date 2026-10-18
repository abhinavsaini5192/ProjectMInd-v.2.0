# Verification Coordination

## 1. Overview

The `AgentVerificationCoordinator` bridges ProjectMind's Phase 7.7 Verification Engine with task completion validation:
- Captures test results, build diagnostics, linting, and typecheck status.
- Evaluates whether tasks satisfy their completion criteria.
- Prevents agents from completing tasks when verification status is `FAILED` or `NOT_STARTED`.
