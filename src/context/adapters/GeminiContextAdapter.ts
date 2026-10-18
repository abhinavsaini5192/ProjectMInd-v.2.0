import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class GeminiContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'gemini-markdown';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    lines.push('### Project Context Grounding');

    if (pkg.task.text) {
      lines.push(`**User Goal:** ${pkg.task.text}`);
    }

    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push('\n#### Identified Domain Features');
      for (const feat of pkg.features) {
        lines.push(`* **${feat.name}** (\`${feat.featureId}\`): ${feat.description}`);
        if (feat.entryPoints.length > 0) {
          lines.push(`  * Entrypoints: ${feat.entryPoints.map((e) => `\`${e}\``).join(', ')}`);
        }
      }
    }

    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('\n#### Core Code Artifacts');
      for (const res of pkg.resources) {
        const file = res.filePath ?? res.resourceId;
        lines.push(`* File: \`${file}\` [Role: ${res.role}]`);
      }
    }

    if (pkg.behavior.length > 0) {
      sectionsFormatted.push('BEHAVIOR');
      lines.push('\n#### Functional Execution Flows');
      for (const f of pkg.behavior) {
        const name = typeof f === 'string' ? f : f.name ?? f.flowId;
        lines.push(`* ${name}`);
      }
    }

    if (pkg.health?.activeRisks && pkg.health.activeRisks.length > 0) {
      sectionsFormatted.push('HEALTH');
      lines.push('\n#### Risk and Health Guardrails');
      for (const r of pkg.health.activeRisks) {
        const desc = typeof r === 'string' ? r : `${r.severity}: ${r.description}`;
        lines.push(`* **Risk Alert**: ${desc}`);
      }
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
