# ProjectMind Agent Adapters — Context Translation

## 1. Role of Context Translation

ProjectMind's `ContextOrchestrator` generates a rich, multi-dimensional `ContextPackage` containing:
- Selected features and components
- Related file resources and paths
- Architectural relationships and patterns
- Repository health and risk metrics
- Prior task history and observations
- Freshness, completeness, and warning diagnostics

The **Agent Adapter Layer** translates this `ContextPackage` into the representation preferred by the external agent without altering the selection or re-ranking the contents.

---

## 2. Supported Context Output Formats

`AgentContextMapper` supports four primary formatting targets:

### 1. `MARKDOWN` (Default for CLI and Chat Agents)
- Structured headers (`# Repository Context`, `## Active Features`, `## Relevant Files & Resources`).
- Clean bulleted lists with backtick paths (`src/auth/login.ts`).
- Fenced code blocks for architecture, health, and predicted impact.
- Human-readable task descriptions.
- Ideal for Claude Code, Aider, and conversational terminal agents.

### 2. `STRUCTURED_JSON` (Default for IDEs and Automation)
- Pure JSON serialization preserving full object trees.
- Enables IDE extensions to inspect feature boundaries programmatically.
- Ideal for Cursor, Windsurf, and custom VS Code extensions.

### 3. `XML_TAGGED` (Anthropic Prompting Convention)
- Emits prompt-optimized XML tags:
  ```xml
  <repository_context package_id="pkg_123">
    <task><![CDATA[Fix auth bug]]></task>
    <features>
      <feature id="feat_auth" name="Auth">Handles login</feature>
    </features>
    <resources>
      <resource path="src/auth/login.ts" type="file" />
    </resources>
  </repository_context>
  ```
- Aligned with Anthropic best practices for long-context system prompts.

### 4. `RAW` (In-Process / Testing)
- Returns the unmodified `ContextPackage` directly.

---

## 3. Preservation of Diagnostics & Metrics

When translating context, `AgentContextMapper` strictly preserves:
- **Knowledge Version**: `context.version.knowledgeVersion`
- **Freshness**: `context.freshness.status` (`CURRENT`, `RECENT`, `STALE`, etc.)
- **Completeness**: `context.completeness.level` (`FULL`, `PARTIAL`, `MINIMAL`)
- **Confidence Score**: `context.completeness.score` (0.0 to 1.0)
- **Active Warnings**: Array of warning strings to keep the external agent informed of potential staleness or missing dependencies.
