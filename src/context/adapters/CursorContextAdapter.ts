import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class CursorContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'cursor-compact';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    lines.push(`// Cursor Context: ${pkg.task.text || 'Repository Intelligence'}`);

    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push('// Features: ' + pkg.features.map((f) => `${f.name} (${f.role})`).join(', '));
    }

    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('// Relevant Files:');
      for (const res of pkg.resources) {
        const file = res.filePath ?? res.resourceId;
        lines.push(`@${file} (${res.role})`);
      }
    }

    if (pkg.features.some((f) => f.entryPoints.length > 0)) {
      sectionsFormatted.push('ENTRY_POINTS');
      const allEntries = pkg.features.flatMap((f) => f.entryPoints);
      lines.push('// Entry Points: ' + allEntries.join(', '));
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
