# Packaging & Canonical Context Package Model

## The Canonical Model

The `ContextPackage` interface (`src/context/models/ContextPackage.ts`) is the provider-independent representation of all gathered intelligence:

```typescript
export interface ContextPackage {
  packageId: string;
  generatedAt: number;
  task: {
    text: string;
    intent?: Record<string, any> | undefined;
  };
  features: ContextFeature[];
  resources: ContextResource[];
  architecture?: Record<string, any> | undefined;
  behavior: any[];
  dependencies: any[];
  tests: any[];
  health?: Record<string, any> | undefined;
  impact?: Record<string, any> | undefined;
  history: any[];
  warnings: ContextWarning[];
  selectionReasons: Record<string, string>;
  completeness: ContextCompleteness;
  freshness: ContextFreshness;
  estimatedTokens: number;
  version: ContextVersion;
  allocation?: ContextAllocation | undefined;
  compiledPromptText?: string | undefined;
}
```

## Metadata Guarantees

### 1. Completeness (`ContextCompleteness`)
- Measures ratio of successfully provided sections to requested sections.
- Categorized as:
  - `FULL`: >= 0.95
  - `HIGH`: >= 0.75
  - `PARTIAL`: >= 0.40
  - `MINIMAL`: < 0.40
- Includes explicit `missingSections` and `missingReasons`.

### 2. Freshness (`ContextFreshness`)
- Status: `CURRENT`, `RECENT`, `STALE`, or `UNKNOWN`.
- Tracks `lastUpdatedAt` and `ageMs`.
- Explicit `invalidationReasons` when underlying feature data is out of sync.

### 3. Versioning (`ContextVersion`)
- Tracks `packageVersion: '6.10.0'`.
- Tracks `knowledgeVersion` from Phase 6.9.
- Flags `isConsistent` and notes any `mismatchedSubsystems`.
