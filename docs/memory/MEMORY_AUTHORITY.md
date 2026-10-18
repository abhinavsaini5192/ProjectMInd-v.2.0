# Memory Authority & Confidence

## 1. Tripartite Separation

ProjectMind strictly distinguishes three independent dimensions for every memory record:

1. **Provenance**: WHERE the information came from (`DEVELOPER`, `AGENT`, `VERIFICATION`, etc.).
2. **Authority**: HOW authoritative the information is (`AUTHORITATIVE`, `VERIFIED`, `PROVISIONAL`, `NON_AUTHORITATIVE`).
3. **Confidence**: Probabilistic certainty metric (numerical float from 0.0 to 1.0).

### Example
- Source: `AGENT`
- Provenance: `AGENT`
- Confidence: `0.95` (The agent is 95% confident)
- Authority: `NON_AUTHORITATIVE` (It cannot dictate project truth without verification)

## 2. Authority Levels

Defined in [MemoryEnums.ts](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/memory/project/models/MemoryEnums.ts):
- `AUTHORITATIVE`: Definitive truth authored by developers or architects.
- `VERIFIED`: Confirmed by automated verification or compiler tests.
- `PROVISIONAL`: Temporarily accepted pending confirmation.
- `NON_AUTHORITATIVE`: Informational or agent-generated suggestions.

Lower-authority claims are never permitted to override higher-authority facts during hybrid retrieval or context assembly.
