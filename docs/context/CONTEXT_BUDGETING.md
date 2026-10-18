# Context Budgeting & Compression

## 1. Token Budget Allocation

Context packages must fit cleanly inside model context windows without wasting token capacity on peripheral or boilerplate data.

The budgeting subsystem coordinates:
- System prompt and formatting overhead reservation ($~12.5\%$).
- Metadata and quality report reservation ($~7.5\%$).
- Context item allocation ($~80\%$).

Configured defaults apply when no explicit budget is specified (default: 4,000 tokens for standard contexts; 8,000 tokens maximum default).

## 2. Context Compression Modes

The [`ContextCompressionEngine`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextCompressionEngine.ts) applies 4 canonical compression modes:

- `FULL`: Complete resource representations with comprehensive file structures.
- `COMPACT`: Omits non-essential metadata and extracts symbol-level AST fragments.
- `SUMMARY`: Produces structured behavioral and relational summaries without full source blocks.
- `REFERENCE_ONLY`: Emits lightweight pointer references (file paths, symbol names, line numbers) for agent self-retrieval.

## 3. Symbol & Source Fragment Selection

When a task refers to a specific entity (e.g. `AuthService.login`), ProjectMind extracts the targeted symbol and surrounding lines rather than embedding the entire multi-thousand line file.

Source fragments include:
- `path`: Target file path.
- `symbol`: Full symbol signature.
- `fragment`: Extracted source code fragment.
- `startLine` & `endLine`: Physical line boundaries.
