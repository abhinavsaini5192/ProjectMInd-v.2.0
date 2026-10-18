import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class JsonContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'json';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const formattedContent = JSON.stringify(pkg, null, 2);
    const estimatedTokens = this.estimateTokens(formattedContent);

    return {
      formattedContent,
      format: this.format,
      estimatedTokens,
      sectionsFormatted: [
        'IDENTITY',
        'RESOURCES',
        'BEHAVIOR',
        'DEPENDENCIES',
        'TESTS',
        'HEALTH',
        'METADATA',
        'WARNINGS',
      ],
      metadata: {
        packageId: pkg.packageId,
        generatedAt: pkg.generatedAt,
      },
    };
  }
}
