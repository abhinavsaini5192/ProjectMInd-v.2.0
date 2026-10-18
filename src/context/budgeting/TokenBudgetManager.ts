import type { ITokenBudgetManager, BudgetedContextResult } from '../interfaces/ITokenBudgetManager.js';
import type { SelectedContextData } from '../interfaces/IContextSelector.js';
import type { ContextBudget } from '../models/ContextBudget.js';
import type { ContextAllocation } from '../models/ContextAllocation.js';
import type { ContextSection } from '../models/ContextSection.js';
import type { ContextWarning } from '../models/ContextWarning.js';
import type { ContextResource } from '../models/ContextResource.js';
import type { ContextFeature } from '../models/ContextFeature.js';
import { TokenEstimator } from './TokenEstimator.js';
import { ContextBudgetAllocator } from './ContextBudgetAllocator.js';
import { ContextCompressionPolicy } from './ContextCompressionPolicy.js';
import { ContextTruncationPolicy } from './ContextTruncationPolicy.js';

export class TokenBudgetManager implements ITokenBudgetManager {
  public estimateTokens(textOrObj: unknown): number {
    return TokenEstimator.estimate(textOrObj);
  }

  public applyBudget(
    data: SelectedContextData,
    budget: ContextBudget
  ): BudgetedContextResult {
    let workingData = data;
    if (budget.compactMode) {
      workingData = ContextCompressionPolicy.compress(data);
    }

    const allocations = ContextBudgetAllocator.allocate(budget.availableForContext);
    const actualUsage: Record<string, number> = {};
    const truncatedSections: ContextSection[] = [];
    const omittedSections: ContextSection[] = [];
    const warnings: ContextWarning[] = [];

    // 1. Features (IDENTITY & Core feature metadata)
    const featureQuota = allocations['IDENTITY'] ?? 200;
    const featureTrunc = ContextTruncationPolicy.truncateArray<ContextFeature>(
      workingData.features,
      featureQuota,
      (f) => f.estimatedTokens ?? this.estimateTokens(f)
    );
    actualUsage['IDENTITY'] = featureTrunc.tokensUsed;
    if (featureTrunc.wasTruncated) {
      truncatedSections.push('IDENTITY');
      warnings.push({
        type: 'TRUNCATED_CONTENT',
        message: 'Some features were omitted to fit the token budget.',
        section: 'IDENTITY',
      });
    }

    // 2. Resources
    const resourceQuota = allocations['RESOURCES'] ?? 600;
    const resourceTrunc = ContextTruncationPolicy.truncateArray<ContextResource>(
      workingData.resources,
      resourceQuota,
      (r) => r.estimatedTokens ?? this.estimateTokens(r)
    );
    actualUsage['RESOURCES'] = resourceTrunc.tokensUsed;
    if (resourceTrunc.wasTruncated) {
      truncatedSections.push('RESOURCES');
      warnings.push({
        type: 'TRUNCATED_CONTENT',
        message: 'Resource listings were truncated to fit the token budget.',
        section: 'RESOURCES',
      });
    }
    if (workingData.resources.length > 0 && resourceTrunc.items.length === 0) {
      omittedSections.push('RESOURCES');
      warnings.push({
        type: 'OMITTED_SECTION',
        message: 'All resources were omitted due to strict token budget.',
        section: 'RESOURCES',
      });
    }

    // 3. Behavior Flows
    const behaviorQuota = allocations['BEHAVIOR'] ?? 300;
    const behaviorTrunc = ContextTruncationPolicy.truncateArray(
      workingData.behaviorFlows,
      behaviorQuota,
      (b) => this.estimateTokens(b)
    );
    actualUsage['BEHAVIOR'] = behaviorTrunc.tokensUsed;
    if (behaviorTrunc.wasTruncated) {
      truncatedSections.push('BEHAVIOR');
      warnings.push({
        type: 'TRUNCATED_CONTENT',
        message: 'Behavior flows were truncated to fit the token budget.',
        section: 'BEHAVIOR',
      });
    }

    // 4. Tests
    const testQuota = allocations['TESTS'] ?? 150;
    const testTrunc = ContextTruncationPolicy.truncateArray(
      workingData.tests,
      testQuota,
      (t) => this.estimateTokens(t)
    );
    actualUsage['TESTS'] = testTrunc.tokensUsed;
    if (testTrunc.wasTruncated) truncatedSections.push('TESTS');

    // 5. Risks / Health
    const healthQuota = allocations['HEALTH'] ?? 150;
    const riskTrunc = ContextTruncationPolicy.truncateArray(
      workingData.risks,
      healthQuota,
      (r) => this.estimateTokens(r)
    );
    actualUsage['HEALTH'] = riskTrunc.tokensUsed;
    if (riskTrunc.wasTruncated) truncatedSections.push('HEALTH');

    // 6. Milestones / History
    const historyQuota = allocations['HISTORY'] ?? 100;
    const milestoneTrunc = ContextTruncationPolicy.truncateArray(
      workingData.milestones,
      historyQuota,
      (m) => this.estimateTokens(m)
    );
    actualUsage['HISTORY'] = milestoneTrunc.tokensUsed;
    if (milestoneTrunc.wasTruncated) truncatedSections.push('HISTORY');

    // 7. Explanations
    actualUsage['EXPLANATIONS'] = this.estimateTokens(workingData.explanations);

    const totalUsed = Object.values(actualUsage).reduce((sum, u) => sum + u, 0);
    const totalAllocated = Object.values(allocations).reduce((sum, a) => sum + a, 0);
    const remainingTokens = Math.max(0, budget.availableForContext - totalUsed);

    const allocation: ContextAllocation = {
      sectionAllocations: allocations,
      actualUsage,
      totalAllocated,
      totalUsed,
      remainingTokens,
      truncatedSections,
      omittedSections,
    };

    const finalData: SelectedContextData = {
      features: featureTrunc.items.length > 0 ? featureTrunc.items : workingData.features.slice(0, 1),
      resources: resourceTrunc.items,
      behaviorFlows: behaviorTrunc.items,
      tests: testTrunc.items,
      risks: riskTrunc.items,
      milestones: milestoneTrunc.items,
      explanations: workingData.explanations,
    };

    return {
      data: finalData,
      allocation,
      warnings,
    };
  }
}
