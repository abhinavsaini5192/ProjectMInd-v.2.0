# Response Model & DTOs

## FeatureKnowledgeResponse

```typescript
export interface FeatureKnowledgeResponse {
  success: boolean;
  profile: FeatureKnowledgeProfile;
  metadata: FeatureKnowledgeMetadata;
  errors?: FeatureKnowledgeErrorInfo[] | undefined;
}
```

---

## FeatureKnowledgeProfile

The canonical aggregate response containing all feature intelligence:

```typescript
export interface FeatureKnowledgeProfile {
  featureId: string;
  identity: FeatureIdentitySection;
  mappings: FeatureMappingSection;
  dependencies: FeatureDependencySection;
  behavior: FeatureBehaviorSection;
  health: FeatureHealthSection;
  impact: FeatureImpactSection;
  history: FeatureHistorySection;
  architecture: FeatureArchitectureSection;
  summary: FeatureSummarySection;
  explanations: Record<string, string>;
  references: FeatureKnowledgeReference[];
  completeness: FeatureKnowledgeCompleteness;
  confidence: FeatureKnowledgeConfidence;
  freshness: FeatureKnowledgeFreshness;
  contextPackage?: FeatureKnowledgeContextPackage | undefined;
}
```

---

## FeatureKnowledgeMetadata

Metadata concerning request execution, versioning, and latency:

```typescript
export interface FeatureKnowledgeMetadata {
  requestId: string;
  generatedAt: number;
  durationMs: number;
  workspaceId: string;
  repositoryId: string;
  knowledgeVersion: string;
  freshness: FeatureKnowledgeFreshness;
  versionStatus: FeatureKnowledgeVersion;
}
```

---

## Example Conceptual JSON Response

```json
{
  "success": true,
  "profile": {
    "featureId": "feat_auth",
    "identity": {
      "status": "AVAILABLE",
      "data": {
        "id": "feat_auth",
        "name": "Authentication",
        "type": "USER_FACING",
        "status": "ACTIVE"
      }
    },
    "mappings": {
      "status": "AVAILABLE",
      "itemCount": 6,
      "data": {
        "mappings": [
          { "resourceId": "POST /login", "role": "PRIMARY", "confidence": 0.98 }
        ]
      }
    },
    "dependencies": {
      "status": "AVAILABLE",
      "data": {
        "dependencies": [{ "featureId": "feat_user_mgmt", "relationshipType": "DEPENDS_ON" }]
      }
    },
    "health": {
      "status": "AVAILABLE",
      "data": {
        "healthScore": 88,
        "healthStatus": "HEALTHY",
        "risks": [{ "description": "missing OAuth failure verification", "severity": "HIGH" }]
      }
    },
    "completeness": {
      "status": "COMPLETE",
      "completenessRatio": 1.0
    },
    "confidence": {
      "level": "VERY_HIGH",
      "overallScore": 0.94
    },
    "freshness": {
      "status": "CURRENT"
    }
  },
  "metadata": {
    "requestId": "req_1694900000_abc123",
    "generatedAt": 1694900000000,
    "durationMs": 4,
    "knowledgeVersion": "1.0.0"
  }
}
```
