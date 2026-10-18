# ProjectMind Developer SDK Guide (Phase 9.8)

## 1. Overview

The ProjectMind Developer SDK (`@projectmind/sdk` or `src/sdk/`) provides a type-safe client for external applications, CI/CD scripts, and plugin authors to interact with ProjectMind's repository intelligence services.

Key features:
- **Resilient Transport**: Bounded retries with exponential backoff and jitter for idempotent operations.
- **Safety First**: Non-idempotent mutations (like feedback submission or resource creation) are never retried blindly.
- **Cancellation & Timeouts**: Full support for native `AbortSignal` and configurable request timeouts.
- **Secret Redaction**: Credentials and authorization tokens are scrubbed from all diagnostic logs and error traces.
- **Namespaced Facades**: Clean division between `context`, `features`, `plans`, `feedback`, and `plugins`.

---

## 2. Installation & Client Setup

```typescript
import { ProjectMindClient } from '@projectmind/sdk';

const client = new ProjectMindClient({
  baseUrl: 'https://projectmind.internal.net',
  apiKey: process.env.PROJECTMIND_API_KEY,
  workspaceId: 'ws-enterprise-core',
  projectId: 'proj-payments-v2',
  timeoutMs: 15000,
  maxRetries: 3,
});
```

---

## 3. Working Code Examples

### Example 1: Requesting Task Context
```typescript
try {
  const contextBundle = await client.context.get({
    query: 'How is JWT verification implemented in authentication routes?',
    maxTokens: 4000,
    includeDependencies: true,
  });

  console.log(`Received context bundle ${contextBundle.bundleId}:`);
  for (const resource of contextBundle.resources) {
    console.log(`- ${resource.uri} (Relevance: ${resource.score}): ${resource.reason}`);
  }
} catch (err) {
  console.error('Failed to retrieve context:', err);
}
```

### Example 2: Querying Feature Architecture
```typescript
const features = await client.features.list({ page: 1, limit: 10 });
console.log(`Found ${features.total} features.`);

const authFeature = await client.features.get('feat-user-auth');
console.log(`Feature ${authFeature.name} maps to files:`, authFeature.associatedFiles);
```

### Example 3: Submitting Validated Feedback (Phase 9.7 Integration)
```typescript
await client.feedback.submit({
  feedbackType: 'CONTEXT_USEFUL',
  targetType: 'FILE',
  targetId: 'src/security/jwt.ts',
  signal: 'POSITIVE',
  value: 1.0,
  commentary: 'Directly resolved signature validation issue.',
});
```

### Example 4: Managing Plugins
```typescript
// List registered plugins
const plugins = await client.plugins.list({ pluginType: 'CONTEXT_PROVIDER' });

// Register new plugin from manifest
const registration = await client.plugins.register({
  pluginId: 'com.acme.github-pr-provider',
  name: 'GitHub PR Context Provider',
  version: '1.0.0',
  pluginType: 'CONTEXT_PROVIDER',
  declaredCapabilities: ['PROVIDE_CONTEXT'],
});

// Enable plugin
await client.plugins.enable(registration.pluginId);

// Check health
const health = await client.plugins.health(registration.pluginId);
console.log('Plugin health:', health.status);
```

---

## 4. Error Handling

The SDK exposes a hierarchy of typed errors:

```typescript
import {
  SDKError,
  AuthenticationError,
  SecurityError,
  NotFoundError,
  RateLimitError,
  ValidationError,
  TimeoutError,
} from '@projectmind/sdk';

try {
  await client.features.get('non-existent-feature');
} catch (err) {
  if (err instanceof NotFoundError) {
    console.warn('Feature does not exist.');
  } else if (err instanceof AuthenticationError) {
    console.error('Invalid credentials.');
  } else if (err instanceof TimeoutError) {
    console.error(`Request exceeded ${err.timeoutMs}ms.`);
  } else if (err instanceof SDKError) {
    console.error(`ProjectMind SDK Error [${err.code}]:`, err.message);
  }
}
```
