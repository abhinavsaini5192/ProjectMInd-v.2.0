# Token Budgeting & Section Quotas

## Overview

The Token Budgeting Subsystem (`src/context/budgeting/`) ensures that prompts never overflow model context windows or consume unnecessary tokens.

## Budget Allocation Breakdown

Default context budget: **4,000 tokens**.
- **Reserved for System/User Prompt**: 12.5% (max 500 tokens).
- **Reserved for Metadata/Warnings**: 7.5% (max 300 tokens).
- **Available for Context**: Remaining tokens (3,200 tokens default).

### Default Proportional Quotas

| Section | Default Share | Description |
| :--- | :--- | :--- |
| **RESOURCES** | 35% | File paths, symbols, code snippets |
| **BEHAVIOR** | 15% | Key execution flows, control flow steps |
| **IDENTITY** | 10% | Feature identity, descriptions, categories |
| **DEPENDENCIES** | 10% | Direct and indirect feature relationships |
| **ENTRY_POINTS** | 10% | Function / API invocation points |
| **TESTS** | 5% | Associated test files and verification suites |
| **HEALTH & RISKS** | 5% | Health status, active security / stability risks |
| **IMPACT** | 5% | Blast radius, downstream affected features |
| **HISTORY** | 5% | Milestones, evolution notes |

## Truncation & Compression Policies

1. **Compact Mode (`ContextCompressionPolicy`)**:
   - Automatically enabled when `tokenBudget < 2000` or `request.compactMode === true`.
   - Truncates feature descriptions to <= 120 characters.
   - Restricts entry points and flows to top 2 items.
   - Strips code snippets from resources to preserve file listings.
   - Drops selection explanations.

2. **Deterministic Quota Truncation (`ContextTruncationPolicy`)**:
   - Truncates item arrays in descending relevance score order.
   - Once a section quota is reached, remaining items are pruned.
   - Emits `TRUNCATED_CONTENT` warning with details.
   - If an entire section must be omitted, emits `OMITTED_SECTION` warning.
