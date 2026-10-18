import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class CodexContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'codex-code';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    lines.push('/*');
    lines.push(' * TASK CONTEXT: ' + (pkg.task.text || 'Code Completion'));

    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push(' * TARGET FEATURES:');
      for (const f of pkg.features) {
        lines.push(` *   - ${f.name} [${f.role}]: ${f.description}`);
      }
    }

    if (pkg.health?.activeRisks && pkg.health.activeRisks.length > 0) {
      sectionsFormatted.push('HEALTH');
      lines.push(' * RISKS & CONSTRAINTS:');
      for (const r of pkg.health.activeRisks) {
        const desc = typeof r === 'string' ? r : `${r.severity}: ${r.description}`;
        lines.push(` *   - ${desc}`);
      }
    }

    lines.push(' */');

    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('// REFERENCED MODULES:');
      for (const res of pkg.resources) {
        const file = res.filePath ?? res.resourceId;
        lines.push(`// import from "${file}"`);
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
