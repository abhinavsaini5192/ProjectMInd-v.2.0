# Tool Execution & Observation Bridging

## 1. Tool Routing

All tool invocations (`ToolRequest`) flow through `AgentToolCoordinator`:
- **Timeout Protection**: Enforced using `AgentRuntimeLimits.toolTimeoutMs`. Operations exceeding timeout are aborted with `RuntimeTimeoutError`.
- **Payload Size Bounds**: Large request payloads exceeding `maxRequestSizeBytes` are rejected with `RuntimeCapacityError`.
- **Permission Checking**: Agent session status is validated before dispatching to `IAgentToolPipeline`.

## 2. Asynchronous Observation Ingestion

Every tool response (`ToolResponse`) is asynchronously dispatched to `AgentObservationCoordinator`:
- Creates a normalized `ExecutionObservation` with `source: 'SYSTEM'` and `type: 'TOOL_EXECUTION'`.
- Records latency, success status, and error details into the observation timeline without blocking the agent's tool execution flow.
