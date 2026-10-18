# ProjectMind Remediation 4 — AI/ML Reality Audit, Provider Verification & Capability Integrity Report

## Executive Summary

This report delivers an evidence-driven, source-level audit of ProjectMind's AI, ML, semantic retrieval, embedding, SLM, LLM, and research/training components. The audit revalidated and addressed previously identified findings:
- **`FINDING-AI-003`**: Local SLM inference is not implemented (verified as a stub/heuristic fallback; now explicitly guarded and truthfully reported).
- **`FINDING-AI-004`**: Provider adapters and semantic embeddings are mock-based or deterministic rather than neural (verified: embeddings use 32-bit FNV-1a character 3-gram feature hashing, NOT neural transformer weights; provider adapters are now fortified to probe endpoints truthfully and fail closed rather than returning silent mock strings).

ProjectMind is **not** an in-process neural network system or local GPU model runtime. Rather, ProjectMind is an **authoritative repository intelligence engine** that relies on deterministic Abstract Syntax Tree (AST) parsing, compiler symbol extraction, dependency graph analysis, and lexical/subword feature hashing. Model-derived outputs are treated as **untrusted proposals** bounded by strict schema validation and knowledge graph hallucination detection.

---

## 1. Baseline Repository & Environment State

- **Repository**: `ProjectMind`
- **Branch**: `main`
- **Baseline Git HEAD Commit**: `c8c5eaa6fcb5e39edd2d6eeb5f5c4123c4f3834f`
- **Node.js Version**: `v24.13.1`
- **npm Version**: `11.8.0`
- **Python Version**: `3.14.3`
- **Vitest Version**: `4.1.11`
- **TypeScript Version**: `5.4.5`
- **Working Tree Integrity**: All existing untracked files and working-tree modifications from previous remediations (Remediation 1, 2, and 3) were strictly preserved. No destructive Git commands (`git reset`, `git clean`, `git checkout .`) were executed.

---

## 2. Exhaustive AI/ML Component Audit & Classifications

Every AI, ML, retrieval, embedding, prompt, and research script across the repository was inspected at the source code level and classified into one of six standardized categories:

1. **Category 1**: Real pretrained neural model
2. **Category 2**: Real external model API integration
3. **Category 3**: Deterministic algorithm or heuristic
4. **Category 4**: Mock, stub, or simulated implementation
5. **Category 5**: Interface with no functioning implementation
6. **Category 6**: Implemented but not currently configured or exercised

### Detailed Audit Table

| Component | Source File Path | Verified Classification | Evidence / Source-Level Behavior |
|:---|:---|:---:|:---|
| **Local Semantic Embedding Provider** | `src/retrieval/embeddings/LocalSemanticEmbeddingProvider.ts` | **3. Deterministic Algorithm** | Uses 32-bit FNV-1a hashing over character 3-grams to project subwords into a 384-dimensional unit vector. Normalizes via L2 norm. Zero neural layers, no transformer weights, zero matrix multiplications. |
| **Local SLM Provider** | `src/intelligence/slm/providers/LocalSLMProvider.ts` | **5. Interface Stub** | `predict()` unconditionally throws `new Error('LocalSLMProvider inference not implemented yet.')`. `isHealthy()` returns `false`. |
| **SLM Inference Client** | `src/intelligence/slm/SLMClient.ts` | **3. Heuristic / 5. Stub** | GGUF, ONNX, and HTTP branches are commented out. Unconditionally routes to `invokeHeuristicFallback()`, returning `backendUsed: 'heuristic'` and `[Heuristic Reply]`. |
| **Ollama Provider** | `src/intelligence/slm/providers/OllamaProvider.ts` | **2. External Model API Integration (Live Probe)** | Previously returned `'Ollama Mock'`. Fortified to make real HTTP calls to `/api/generate` and probe `/api/tags` for health. Fails with `SLMUnavailableError` if daemon is down. |
| **OpenAI-Compatible Provider** | `src/intelligence/slm/providers/OpenAICompatibleProvider.ts` | **2. External Model API Integration (Live Probe)** | Previously returned `'OpenAI Mock'`. Fortified to make real HTTP calls to `/v1/chat/completions` and probe `/v1/models` for health. Fails with `SLMUnavailableError` if unreachable. |
| **Local HTTP Provider** | `src/intelligence/slm/providers/LocalHTTPProvider.ts` | **4. Mock / Simulation Stub** | Probes configured `/health` endpoint. If unreachable or simulated, flags `ModelAvailability.UNAVAILABLE`. Supports abort/timeout simulation for testing. |
| **Mock SLM Provider** | `src/intelligence/slm/providers/MockSLMProvider.ts` | **4. Mock Test Double** | In-memory controllable test double. Exposes `isMock: true` and runtime metadata `{ isMock: true, isNeural: false, isSimulated: true }`. |
| **LLM Adapter Interface** | `src/intelligence/adapters/LLMAdapter.ts` | **5. Interface** | Abstract interface defining `generateStructured<T>()` and `generateText()`. |
| **Mock LLM Adapter** | `src/intelligence/adapters/MockLLMAdapter.ts` | **4. Mock Test Double** | The only implementation of `LLMAdapter` in `src/`. Exposes `isMock: true` and in-memory keyword matching. Used as default fallback in `RepositoryIntelligenceEngine`. |
| **Repository Intelligence Engine** | `src/intelligence/RepositoryIntelligenceEngine.ts` | **3. Deterministic Orchestrator / 4. Default Mock** | Facade orchestrator for change classification and graph updates. Defaults to `new MockLLMAdapter()` when no external adapter is injected. |
| **OpenAI Context Adapter** | `src/context/adapters/OpenAIContextAdapter.ts` | **3. Deterministic Algorithm** | Markdown serializer formatting repository facts, features, and risk items into text blocks for LLM consumption. Does not make API calls. |
| **Agent Tool Mapper** | `src/agent/adapters/core/AgentToolMapper.ts` | **3. Deterministic Algorithm** | Pure schema mapper converting internal `AgentTool` structures to OpenAI function schemas, Anthropic tool schemas, and Cursor tools. |
| **SLM Output Validator** | `src/intelligence/slm/core/SLMOutputValidator.ts` | **3. Deterministic Algorithm** | Enforces Zod schema compliance and validates that all proposed features and context files exist in `knownRepositoryEntities`. Throws `HALLUCINATION` error on fabricated entities. |
| **SLM Fallback Manager** | `src/intelligence/slm/core/SLMFallbackManager.ts` | **3. Deterministic Algorithm** | Catches SLM errors and returns deterministic candidates from repository analysis with dampened `confidence: 0.1`. |
| **SLM Decision Router** | `src/intelligence/slm/routing/SLMDecisionRouter.ts` | **3. Deterministic Algorithm** | Evaluates trust score and strictly routes security-critical tasks to `RoutingDecision.DETERMINISTIC_ONLY`. |
| **Confidence Calibrator** | `src/intelligence/slm/routing/ConfidenceCalibrator.ts` | **3. Deterministic Algorithm** | Mathematical calibration scaling proposed model confidence against empirical historical accuracy. |
| **Semantic Index** | `src/retrieval/index/SemanticIndex.ts` | **3. Deterministic Algorithm** | In-memory vector store computing cosine similarity against stored 384-dimensional FNV-1a hash vectors with scope filtering. |
| **Hybrid Retrieval Engine** | `src/retrieval/engine/HybridRetrievalEngine.ts` | **3. Deterministic Algorithm** | Merges Path A (authoritative AST facts and project memory) with Path B (probabilistic semantic vector similarity). Evaluates 10-dimensional ranker. Functions 100% offline without models. |
| **Learning Intelligence Service** | `src/intelligence/learning/services/` | **3. Deterministic Algorithm** | Rule- and policy-based scoring weight adjustments (e.g. relevance multipliers, threshold filtering, atomic rollback). No gradient descent, no backpropagation, no neural weights. |
| **Python Fine-Tuning Engine** | `research/training/FineTuningEngine.py` | **4. Simulated Prototype** | Demonstration loop executing `loss = 2.0 / (epoch + 1)`. No PyTorch or TensorFlow imports; no neural model weights exist. |
| **Python Evaluation Framework** | `research/evaluation/EvaluationFramework.py` | **4. Simulated Prototype** | Returns hardcoded dictionary (`accuracy: 0.92, precision: 0.89, recall: 0.91, f1: 0.90`). Prototype for pipeline demonstration. |
| **Python Inference Runtime** | `research/inference/InferenceRuntime.py` | **4. Simulated Prototype** | Returns static string `"Simulated model output for repository intelligence."`. |
| **Python Tokenizer Framework** | `research/tokenizer/TokenizerFramework.py` | **3. Deterministic Algorithm** | Character-to-ordinal encoder `[ord(c) for c in text]`. Used for synthetic compression ratio measurement. |

---

## 3. Provider Behavior Verification & Remediation

### 3.1 Trace Analysis

1. **`LocalSLMProvider`**:
   - Trace: `predict(request)` -> throws `LocalSLMProvider inference not implemented yet.`
   - Verification: Confirmed. Never fabricates output. Truthfully reports `isHealthy(): false`.
2. **`OllamaProvider`**:
   - Previous Trace: `generate(request)` -> returned `{ output: 'Ollama Mock' }` with `healthCheck(): true`.
   - Remediated Trace:
     - `healthCheck()` executes `GET /api/tags` against configured endpoint with an `AbortController` timeout (2s). If unreachable, returns `false`.
     - `generate(request)` executes `POST /api/generate` with model, prompt, system prompt, temperature, and token limits.
     - If the connection fails or Ollama daemon is absent, throws `SLMUnavailableError` honestly instead of masking the failure.
3. **`OpenAICompatibleProvider`**:
   - Previous Trace: `generate(request)` -> returned `{ output: 'OpenAI Mock' }` with `healthCheck(): true`.
   - Remediated Trace:
     - `healthCheck()` executes `GET /v1/models` against configured endpoint with an `AbortController` timeout (2s). If unreachable, returns `false`.
     - `generate(request)` executes `POST /v1/chat/completions` with model parameters and parses choices.
     - If the endpoint is down or unreachable, throws `SLMUnavailableError` honestly.
4. **`LocalHTTPProvider`**:
   - Remediated Trace:
     - `healthCheck()` probes `/health` endpoint. If no endpoint is configured or server is unreachable, returns `false`.
     - `listModels()` sets `availability: UNAVAILABLE` when health check fails.
5. **`MockSLMProvider` & `MockLLMAdapter`**:
   - Updated to explicitly publish `isMock: true` and `{ isMock: true, isNeural: false, isSimulated: true }` in metadata to eliminate accidental confusion with production providers.

### 3.2 Schema Validation & Hallucination Guardrails

- `SLMOutputValidator` validates model output against Zod schema (`slmPredictionSchema`).
- Hallucination check verifies that every proposed feature in `relevantFeatures` and context file in `recommendedContext` exists in the repository knowledge graph.
- When an unknown feature or entity is returned, `SLMOutputValidator` throws `SLMError('HALLUCINATION', ...)`.
- `SLMGateway` catches this and safely triggers `SLMFallbackManager`, which supplies deterministic candidates from repository analysis with dampened `confidence: 0.1` and explicit audit explanation.

---

## 4. Capability Claims Corrected

1. **Semantic Embeddings**:
   - Corrected all references claiming "deep neural embeddings" or "transformer embedding models".
   - Accurately documented in `IEmbeddingProvider.ts` and `LocalSemanticEmbeddingProvider.ts` as:
     `isNeural: false`, `algorithm: 'FNV-1a 32-bit character 3-gram feature hashing'`.
2. **Local Model Inference**:
   - Confirmed that local SLM inference is currently a stub throwing an explicit error (`FINDING-AI-003`).
   - Confirmed that `SLMInferenceClient` routes to heuristic fallback.
3. **Learning Feedback**:
   - Clarified in documentation and metadata that the learning engine applies deterministic policy rules and weight multipliers, not neural backpropagation or gradient updates.
4. **Research Scripts**:
   - Added explicit docstrings and notices in `FineTuningEngine.py`, `EvaluationFramework.py`, `TokenizerFramework.py`, and `InferenceRuntime.py` stating that these are prototype demonstration harnesses with synthetic metrics, not trained model weights.

---

## 5. Safe Model Integration Boundary

ProjectMind preserves the following core principles for optional model integrations:

```
┌─────────────────────────────────────────────────────────────┐
│                 SAFE MODEL INTEGRATION BOUNDARY             │
├─────────────────────────────────────────────────────────────┤
│ 1. AST & Graph Facts = AUTHORITATIVE GROUND TRUTH           │
│ 2. Model Outputs = UNTRUSTED PROPOSALS                      │
│ 3. Proposed Entities MUST Exist in Knowledge Graph          │
│ 4. Missing/Unreachable Models FAIL CLOSED (Truthful Status) │
│ 5. Provider Failures Must NEVER Produce Fabricated Results  │
│ 6. Core Platform Remains 100% Usable Offline Without Models │
└─────────────────────────────────────────────────────────────┘
```

- **Deterministic Primacy**: AST extraction, compiler symbol graphs, test results, and ADR records remain ground truth.
- **Untrusted Proposals**: External or local model outputs are treated as suggestions requiring schema parsing and entity containment verification.
- **Fail-Closed & Offline Operation**: If external AI models fail or are absent, deterministic retrieval (Path A) and AST-based context packages continue operating with 100% availability.

---

## 6. Targeted Regression Test Suite

Created `tests/intelligence/aiMlRealityAudit.test.ts` containing 20 comprehensive unit tests covering:

1. **Mock & Stub Identifiability**:
   - `MockSLMProvider` is explicitly identifiable as a mock (`isMock: true`, `isNeural: false`, `isSimulated: true`).
   - `MockLLMAdapter` is explicitly identifiable as a mock (`isMock: true`).
   - `LocalSLMProvider` truthfully throws `not implemented` and returns `isHealthy(): false`.
   - `SLMInferenceClient` explicitly reports `backendUsed: 'heuristic'`.
2. **Truthful Provider Health & Error Surfacing**:
   - `OllamaProvider` reports `healthCheck(): false` and `ModelAvailability.UNAVAILABLE` when daemon is down.
   - `OllamaProvider` throws `SLMUnavailableError` instead of returning fake mock output.
   - `OpenAICompatibleProvider` reports `healthCheck(): false` and `ModelAvailability.UNAVAILABLE` when endpoint is down.
   - `OpenAICompatibleProvider` throws `SLMUnavailableError` instead of returning fake mock output.
   - `LocalHTTPProvider` reports `healthCheck(): false` and `ModelAvailability.UNAVAILABLE` when endpoint is down.
3. **Deterministic Embedding Verification**:
   - `LocalSemanticEmbeddingProvider` explicitly declares `isNeural: false` and FNV-1a feature hashing algorithm.
   - Produces 100% deterministic unit vectors (L2 norm ~ 1.0; cosine similarity with identical text is 1.0).
   - Shows higher similarity for shared subwords than disjoint tokens.
4. **Schema Validation & Hallucination Rejection**:
   - Rejects responses missing the prediction payload.
   - Rejects responses with malformed schemas or out-of-bounds confidence.
   - Detects and rejects hallucinated features not in the knowledge graph.
   - Detects and rejects hallucinated context files not in the repository.
5. **Safe Fallback & Deterministic Isolation**:
   - Activates deterministic fallback with `confidence: 0.1` when model hallucinates.
   - Activates deterministic fallback with `confidence: 0.1` when provider fails.
   - Strictly routes security-critical tasks to `RoutingDecision.DETERMINISTIC_ONLY`.
   - `HybridRetrievalEngine` operates 100% reliably without any embedding provider or semantic index.

---

## 7. Verification Outcomes

| Verification Gate | Command | Result | Notes / Details |
|:---|:---|:---:|:---|
| **Targeted AI/ML Audit Tests** | `npx vitest run tests/intelligence/aiMlRealityAudit.test.ts` | **PASS** | 20 of 20 tests passed. |
| **SLM & Retrieval Tests** | `npx vitest run tests/intelligence/slm/ tests/retrieval/` | **PASS** | 46 of 46 tests passed across 11 test files. |
| **Strict TypeScript Check** | `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 type errors across whole repository. |
| **Production TypeScript Check**| `npm run typecheck:prod` | **PASS** | 0 type errors across production config. |
| **Production Build** | `npm run build` | **PASS** | Compiled and normalized ESM specifiers across 1,090 files in `dist/`. |
| **Full Repository Test Suite** | `npm test` | **PASS** | **570 test files passed (570/570)**, **2,247 tests passed (2,247/2,247)**. |
| **CLI Functionality** | `node bin/projectmind.js --help` | **PASS** | CLI loads cleanly and renders usage. |
| **Platform Diagnostics** | `node bin/projectmind.js doctor` | **PASS** | All 11 diagnostics PASSED (WAL, schema migrations, recovery). |
| **Dependency Security Audit** | `npm audit` | **PASS** | Found 0 vulnerabilities. |
| **Python Research Tests** | `python -m unittest research/tests/test_research.py` | **PASS** | 2 of 2 tests passed. |

---

## 8. Capability Truth Matrix

| Capability | Advertised Concept | Verified Implementation | Status Verdict |
|:---|:---|:---|:---:|
| **Semantic Embeddings** | Vector similarity retrieval | Deterministic 32-bit FNV-1a character 3-gram feature hashing (384 dimensions). | **VERIFIED (Deterministic Feature Hasher)** |
| **Local Neural Inference** | Built-in offline SLM | `LocalSLMProvider` is an explicit stub throwing `not implemented`. `SLMInferenceClient` runs heuristic fallback. | **VERIFIED (Stub / Not Implemented)** |
| **External Model Adapters** | Ollama & OpenAI HTTP APIs | Honest HTTP adapters with endpoint probing and fail-closed error handling. | **VERIFIED (External Integration Ready)** |
| **Test Doubles** | Mock inference | `MockSLMProvider` and `MockLLMAdapter` explicitly tagged as `isMock: true`. | **VERIFIED (Mock Test Double)** |
| **Learning Intelligence** | Codebase adaptation | Deterministic policy rules, threshold validation, and scoring weight adjustments. | **VERIFIED (Deterministic Policy Engine)** |
| **Hallucination Detection** | AI safety guardrails | Schema parsing + knowledge graph entity containment check + low-confidence fallback. | **VERIFIED** |
| **Deterministic Isolation** | Offline operation | Hybrid retrieval, AST extraction, context generation work 100% without models. | **VERIFIED** |
| **Model Training & Fine-Tuning**| Custom SLM training | Demonstration prototype scripts with synthetic loss and hardcoded metrics. | **VERIFIED (Demonstration Prototype Only)** |

---

## 9. Updated Finding Statuses

- **`FINDING-AI-003: Local SLM inference is not implemented`**:
  - **Status**: **RESOLVED / CLARIFIED**.
  - **Action**: Confirmed and hardened. `LocalSLMProvider` truthfully throws `not implemented` and reports `isHealthy(): false`. `SLMInferenceClient` routes to heuristic fallback. No misleading claims of bundled neural weights remain.
- **`FINDING-AI-004: Provider adapters and semantic embeddings may be mock-based or deterministic rather than neural`**:
  - **Status**: **RESOLVED / REMEDIATED**.
  - **Action**:
    1. `LocalSemanticEmbeddingProvider` now explicitly identifies itself as non-neural (`isNeural: false`, `algorithm: 'FNV-1a 32-bit character 3-gram feature hashing'`).
    2. `OllamaProvider` and `OpenAICompatibleProvider` were fortified with honest endpoint health probing and real HTTP fetch operations that fail closed with `SLMUnavailableError` rather than silently fabricating mock strings.
    3. `MockSLMProvider` and `MockLLMAdapter` are explicitly identified as mocks (`isMock: true`).
    4. 20 regression tests lock in this truthful behavior.

---

## 10. Conclusion

ProjectMind's AI/ML architecture has been rigorously audited and aligned with technical reality. The platform makes no false claims of proprietary neural network weights, GPU fine-tuning, or local transformer execution. Its real, robust strength lies in **deterministic repository intelligence, authoritative knowledge graphs, AST-based symbol extraction, and fail-safe hybrid retrieval**. When external models are integrated, they are strictly bounded as untrusted proposal generators whose assertions must be grounded in verified repository facts.
