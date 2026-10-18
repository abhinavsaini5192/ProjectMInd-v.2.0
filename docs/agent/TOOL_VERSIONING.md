# Tool Protocol Versioning & Deprecation Policy (Phase 7.2)

## 1. Protocol Versioning Principle

ProjectMind adheres to Semantic Versioning (`MAJOR.MINOR.PATCH`) for tool definitions and protocol specifications:

1. **Protocol Envelope Version (`protocolVersion`)**:
   - The current protocol envelope version is `"1.0"`.
   - Breaking changes to the outer `ToolRequest` or `ToolResponse` envelopes require incrementing the protocol version (e.g., `"2.0"`).
   - The `AgentToolPipeline` rejects envelopes with mismatched major versions via `TOOL_VERSION_UNSUPPORTED`.

2. **Tool Definition Version (`version`)**:
   - Each tool has an independent semantic version (e.g., `"1.0.0"`).
   - **Patch (`1.0.1`)**: Non-functional adjustments, clarifications in descriptions, tightening internal validations.
   - **Minor (`1.1.0`)**: Adding optional input parameters, adding new fields to output schemas, backward-compatible enhancements.
   - **Major (`2.0.0`)**: Renaming required fields, changing property types, removing output fields.

---

## 2. Deprecation Lifecycle

When a tool or schema property is deprecated:
1. **Notice Phase**: The tool is marked with `deprecated: true` in its discovery metadata and a warning is included in `ToolResponse.warnings`.
2. **Grace Period**: The tool remains fully functional for a minimum of 2 minor releases.
3. **Disabled Phase**: The tool returns `TOOL_DISABLED` with a migration pointer.
4. **Removal**: The tool is removed in the next major protocol revision.
