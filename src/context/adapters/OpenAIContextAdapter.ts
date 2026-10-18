import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class OpenAIContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'openai-markdown';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    if (request.systemInstructions) {
      lines.push('SYSTEM INSTRUCTIONS:');
      lines.push(request.systemInstructions);
      lines.push('');
    }

    lines.push('REPOSITORY CONTEXT:');
    if (pkg.task.text) {
      lines.push(`Task Goal: ${pkg.task.text}`);
    }

    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push('\n### Active Features:');
      for (const feat of pkg.features) {
        lines.push(`- **${feat.name}** [${feat.role}]: ${feat.description}`);
        if (feat.entryPoints.length > 0) {
          lines.push(`  - Entry Points: ${feat.entryPoints.join(', ')}`);
        }
      }
    }

    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('\n### Relevant Files and Code:');
      for (const res of pkg.resources) {
        const file = res.filePath ?? res.resourceId;
        lines.push(`- \`${file}\` (${res.role})`);
        if (res.snippet) {
          lines.push(`  \`\`\`\n  ${res.snippet}\n  \`\`\``);
        }
      }
    }

    if (pkg.behavior.length > 0) {
      sectionsFormatted.push('BEHAVIOR');
      lines.push('\n### Control Flows:');
      for (const b of pkg.behavior) {
        const name = typeof b === 'string' ? b : b.name ?? b.flowId;
        lines.push(`- ${name}`);
      }
    }

    if (pkg.health?.activeRisks && pkg.health.activeRisks.length > 0) {
      sectionsFormatted.push('HEALTH');
      lines.push('\n### Known Risks / Gotchas:');
      for (const risk of pkg.health.activeRisks) {
        const rDesc = typeof risk === 'string' ? risk : `${risk.severity}: ${risk.description}`;
        lines.push(`- ${rDesc}`);
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
