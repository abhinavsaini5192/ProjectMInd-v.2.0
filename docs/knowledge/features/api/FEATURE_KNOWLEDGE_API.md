# Feature Knowledge API Reference

## IFeatureKnowledgeAPI

The public interface for interacting with the unified feature intelligence surface.

```typescript
export interface IFeatureKnowledgeAPI {
  getFeatureKnowledge(queryOrId: FeatureKnowledgeQuery | string): Promise<FeatureKnowledgeResponse>;
  getFeatureProfile(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureKnowledgeResponse>;
  getFeatureSummary(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureKnowledgeSummary>;
  getFeatureMappings(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureMappingSection>;
  getFeatureDependencies(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureDependencySection>;
  getFeatureDependents(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureDependencySection>;
  getFeatureBehavior(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureBehaviorSection>;
  getFeatureHealth(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureHealthSection>;
  getFeatureImpact(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureImpactSection>;
  getFeatureHistory(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureHistorySection>;
  getFeatureArchitecture(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureArchitectureSection>;
  getFeatureContext(featureId: string, options?: FeatureKnowledgeOptions): Promise<FeatureKnowledgeContextPackage>;
  explainFeatureKnowledge(query: FeatureKnowledgeQuery): Promise<Record<string, string>>;
  getKnowledgeCompleteness(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeCompleteness>;
  getKnowledgeFreshness(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeFreshness>;
  getKnowledgeVersionStatus(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeVersion>;
}
```

---

## Method Details & Examples

### 1. Unified Query: `getFeatureKnowledge`
Retrieves full or partial knowledge for a feature based on query options.

```typescript
// Simple string overload:
const fullProfile = await api.getFeatureKnowledge('feat_auth');

// Selective sections query:
const partialProfile = await api.getFeatureKnowledge({
  featureId: 'feat_auth',
  sections: ['IDENTITY', 'MAPPINGS', 'DEPENDENCIES'],
  freshness: 'CURRENT',
});
```

### 2. Context Retrieval: `getFeatureContext`
Returns a compact, token-bounded context package designed for LLM prompts.

```typescript
const contextPkg = await api.getFeatureContext('feat_auth', {
  tokenBudget: 500,
});
console.log(contextPkg.entryPoints);
console.log(contextPkg.highSeverityRisks);
```

### 3. Section Retrieval: `getFeatureMappings`, `getFeatureHealth`, etc.
Direct access to specialized intelligence sections without manual parsing:

```typescript
const mappings = await api.getFeatureMappings('feat_auth');
const health = await api.getFeatureHealth('feat_auth');
```

### 4. Explanations: `explainFeatureKnowledge`
Returns evidence-based human-readable explanations of why facts were established:

```typescript
const explanations = await api.explainFeatureKnowledge({ featureId: 'feat_auth' });
// explanations.mappings -> "Feature has 6 mapped resource(s) verified by FeatureMappingEngine based on AST and endpoint analysis."
```
