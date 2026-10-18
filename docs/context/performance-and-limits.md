# Performance & System Limits

## Benchmarks & Latency Targets

- **Context Planning**: < 5 ms.
- **Context Retrieval (Local API)**: < 50 ms.
- **Selection & Multi-Factor Scoring**: < 10 ms.
- **Token Budgeting & Truncation**: < 5 ms.
- **Package Construction & Sanitization**: < 10 ms.
- **Model Adapter Formatting**: < 10 ms.
- **Total Orchestration Latency**: < 100 ms (uncached), < 5 ms (cached).

## Guardrails & Hard Limits

1. **Max Dependency Depth**: Bounded to at most `3` (default `1`). Prevents recursive dependency tree explosion across large enterprise mono-repos.
2. **Max Features**: Can be bounded via `request.maxFeatures` (defaults to all direct + direct dependencies).
3. **Max Resources**: Can be bounded via `request.maxResources` (defaults to all scored within token quota).
4. **Token Budget Bounds**: Validated to be positive. Default is `4000`, minimum supported is `100`.
5. **Cache Size & TTL**: In-memory cache default TTL is `60,000 ms`. Cache entries are evicted after expiry.
