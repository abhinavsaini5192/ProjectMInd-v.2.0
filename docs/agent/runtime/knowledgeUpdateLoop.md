# Knowledge Update Loop & Invalidation

## 1. Closed-Loop Feedback

When verified changes are merged or committed:
1. `IKnowledgeUpdateCoordinator` (Phase 7.8) triggers localized, incremental knowledge graph updates.
2. The runtime marks affected context sessions as `KNOWLEDGE_UPDATED` or `STALE_CONTEXT`.
3. The Context Coordinator invalidates cached packages.
4. Next context retrieval yields updated knowledge version and delta packages, preventing stale hallucinations.
