import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class GenericModelAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'generic-markdown';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    if (request.includeDelimiters) {
      lines.push('--- BEGIN CONTEXT PACKAGE ---');
    }

    lines.push('# ProjectMind Context');

    if (pkg.task.text) {
      lines.push(`**Task Context:** ${pkg.task.text}`);
    }

    // 1. Features
    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push('\n## Features');
      for (const feat of pkg.features) {
        lines.push(`### [${feat.role}] ${feat.name} (\`${feat.featureId}\`)`);
        if (feat.description) lines.push(feat.description);
        if (feat.entryPoints.length > 0) {
          lines.push(`- **Entry Points:** ${feat.entryPoints.map((e) => `\`${e}\``).join(', ')}`);
        }
        if (feat.primaryFlows.length > 0) {
          lines.push(`- **Primary Flows:** ${feat.primaryFlows.join(', ')}`);
        }
        if (feat.risks.length > 0) {
          lines.push(`- **Risks:** ${feat.risks.join('; ')}`);
        }
      }
    }

    // 2. Resources
    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('\n## Relevant Resources');
      for (const res of pkg.resources) {
        const file = res.filePath ?? res.resourceId;
        const sym = res.symbolName ? ` (Symbol: \`${res.symbolName}\`)` : '';
        lines.push(`- \`${file}\` [${res.role}]${sym} (Feature: \`${res.featureId}\`)`);
        if (res.snippet) {
          lines.push('  ```');
          lines.push(`  ${res.snippet}`);
          lines.push('  ```');
        }
      }
    }

    // 3. Behavior Flows
    if (pkg.behavior.length > 0) {
      sectionsFormatted.push('BEHAVIOR');
      lines.push('\n## Key Execution Flows');
      for (const flow of pkg.behavior) {
        const name = typeof flow === 'string' ? flow : flow.name ?? flow.flowId;
        lines.push(`- ${name}`);
      }
    }

    // 4. Dependencies
    if (pkg.dependencies.length > 0) {
      sectionsFormatted.push('DEPENDENCIES');
      lines.push('\n## Dependencies');
      for (const dep of pkg.dependencies) {
        lines.push(`- \`${dep.sourceFeatureId}\` -> \`${dep.targetFeatureId}\` (${dep.relationshipType})`);
      }
    }

    // 5. Risks
    if (pkg.health?.activeRisks && pkg.health.activeRisks.length > 0) {
      sectionsFormatted.push('HEALTH');
      lines.push('\n## Active Risks');
      for (const risk of pkg.health.activeRisks) {
        const rDesc = typeof risk === 'string' ? risk : `${risk.severity}: ${risk.description}`;
        lines.push(`- [WARNING] ${rDesc}`);
      }
    }

    // 6. Tests
    if (pkg.tests.length > 0) {
      sectionsFormatted.push('TESTS');
      lines.push('\n## Associated Tests');
      for (const t of pkg.tests) {
        const tDesc = typeof t === 'string' ? t : t.resourceId ?? JSON.stringify(t);
        lines.push(`- \`${tDesc}\``);
      }
    }

    // 7. Warnings
    if (pkg.warnings.length > 0) {
      sectionsFormatted.push('WARNINGS');
      lines.push('\n## Context Warnings');
      for (const w of pkg.warnings) {
        lines.push(`- [${w.type}] ${w.message}`);
      }
    }

    // 8. Explanations
    if (request.includeExplanations && Object.keys(pkg.selectionReasons).length > 0) {
      sectionsFormatted.push('EXPLANATIONS');
      lines.push('\n## Selection Explanations');
      for (const [k, v] of Object.entries(pkg.selectionReasons)) {
        lines.push(`- **${k}**: ${v}`);
      }
    }

    if (request.includeDelimiters) {
      lines.push('\n--- END CONTEXT PACKAGE ---');
    }

    const formattedContent = lines.join('\n');
    const estimatedTokens = this.estimateTokens(formattedContent);

    return {
      formattedContent,
      format: this.format,
      estimatedTokens,
      sectionsFormatted,
      metadata: {
        packageId: pkg.packageId,
        generatedAt: pkg.generatedAt,
      },
    };
  }
}
