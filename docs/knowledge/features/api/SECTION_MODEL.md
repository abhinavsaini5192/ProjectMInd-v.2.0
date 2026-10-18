# Feature Knowledge Section Model

## Canonical Sections

The API defines 21 query sections:
- `IDENTITY`: Core identity attributes (name, description, status, type)
- `METADATA`: Architectural tags, origin, and custom annotations
- `MAPPINGS`: Mapped source files, classes, methods, endpoints
- `DEPENDENCIES`: Outgoing relationships (what this feature depends on)
- `DEPENDENTS`: Incoming relationships (downstream features depending on this)
- `RELATIONSHIPS`: Both incoming and outgoing relationships
- `ENTRY_POINTS`: HTTP routes, CLI commands, event listeners
- `BEHAVIOR`: Execution flows, call paths, sequence models
- `FLOWS`: Specific flow sequences
- `HEALTH`: Composite health score, dimension metrics, stability
- `RISKS`: Technical debt, security gaps, architectural risks
- `IMPACT`: Downstream blast radius and affected files/features
- `HISTORY`: Evolution timeline, events, regressions
- `MILESTONES`: Significant architectural milestones
- `TRENDS`: Directional evolution indicators
- `MATURITY`: Maturity classification (EMERGING, MATURE, DEPRECATED)
- `ARCHITECTURE`: Domain, layers, patterns, and component structures
- `SUMMARY`: High-level aggregated digest
- `EXPLANATION`: Evidence-based natural language justifications
- `REFERENCES`: Deduplicated target code and feature references
- `CONTEXT`: Bounded LLM context package

---

## Section Status Model

A critical rule in ProjectMind is that different absence/failure states must not be conflated:

| Status | Meaning | Reason Example |
|---|---|---|
| `AVAILABLE` | The subsystem was queried and returned valid data. | Subsystem executed normally. |
| `EMPTY` | The subsystem was queried, but no items exist for this feature. | Feature has 0 relationships or 0 mapped files. |
| `NOT_REQUESTED` | The client did not ask for this section; provider was skipped. | Query requested only `['IDENTITY']`. |
| `NOT_COMPUTED` | The subsystem is registered, but analysis has not been executed yet. | "Health analysis has not been run." |
| `STALE` | Knowledge exists, but an invalidation event or older snapshot was detected. | File modified since last health evaluation. |
| `PARTIAL` | Knowledge was retrieved, but some sub-components were unavailable. | Outgoing deps resolved, incoming deps timed out. |
| `FAILED` | An error occurred while communicating with the provider repository. | Database connection error, unexpected exception. |
| `INACCESSIBLE` | Access denied due to workspace or repository boundary violation. | Feature exists in another workspace. |
| `UNKNOWN` | Status could not be determined. | Fallback state. |

---

## Section Contract

Every section extends the base metadata structure:

```typescript
export interface BaseSection<T> {
  status: SectionStatus;
  reason?: string | undefined;
  itemCount: number;
  confidence?: number | undefined;
  freshness?: string | undefined;
  knowledgeVersion?: string | undefined;
  lastUpdatedAt?: number | undefined;
  sourceSubsystem?: string | undefined;
  error?: FeatureKnowledgeErrorInfo | undefined;
  data?: T | undefined;
}
```
