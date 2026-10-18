# Model Context Adapters

## Overview

ProjectMind supports model-specific prompt adaptation without contaminating the core context representation. Adapters implement `IModelContextAdapter` and are registered in `AdapterRegistry`.

## Supported Adapters

### 1. `GenericModelAdapter` (`generic-markdown`)
- Outputs clean, standard GitHub Flavored Markdown.
- Headings: `# ProjectMind Context`, `## Features`, `## Relevant Resources`, `## Key Execution Flows`.
- Suitable for any standard LLM or chat interface.

### 2. `AnthropicContextAdapter` (`claude-xml`)
- Formats prompts specifically for Claude 3 / 3.5 models using semantic XML tags.
- Tags: `<project_mind_context>`, `<task_context>`, `<target_features>`, `<relevant_resources>`, `<behavior_flows>`, `<risks>`.
- Preserves code snippets inside `<![CDATA[ ... ]]>` blocks.

### 3. `OpenAIContextAdapter` (`openai-markdown`)
- Separates system instructions from repository context grounding.
- Headings: `SYSTEM INSTRUCTIONS:`, `REPOSITORY CONTEXT:`, `### Active Features:`, `### Relevant Files and Code:`.

### 4. `GeminiContextAdapter` (`gemini-markdown`)
- Formats context into structured grounding headers.
- Headings: `### Project Context Grounding`, `#### Identified Domain Features`, `#### Core Code Artifacts`, `#### Risk and Health Guardrails`.

### 5. `CursorContextAdapter` (`cursor-compact`)
- Ultra-compact, code-comment-style prompt tailored for Cursor IDE context.
- Uses `@file` directives and `// Features:` inline comments.

### 6. `CodexContextAdapter` (`codex-code`)
- Code-centric context format designed for code completion models.
- Uses C-style comment blocks `/* ... */` and import comments `// import from "..."`.

### 7. `JsonContextAdapter` (`json`)
- Outputs the canonical `ContextPackage` as structured, indented JSON.
