import {
  DEFAULT_API_VERSION,
  isSupportedVersion,
  normalizeVersion,
  type SupportedApiVersion,
} from './ApiVersion.js';

export interface VersionResolutionResult {
  readonly version: string;
  readonly isSupported: boolean;
  readonly source: 'path' | 'header' | 'accept' | 'default';
  readonly canonicalPath: string;
}

export class VersionResolver {
  public resolve(
    path: string,
    headers: Record<string, string | undefined>
  ): VersionResolutionResult {
    // 1. Check path prefix: /api/v{N}/...
    const pathMatch = path.match(/^\/api\/(v[0-9]+)(\/.*)?$/i);
    if (pathMatch && pathMatch[1]) {
      const rawVer = normalizeVersion(pathMatch[1]);
      const isSupp = isSupportedVersion(rawVer);
      const remainingPath = pathMatch[2] ?? '/';
      return {
        version: rawVer,
        isSupported: isSupp,
        source: 'path',
        canonicalPath: `/api/${rawVer}${remainingPath}`,
      };
    }

    // 2. Check X-API-Version header
    const headerVer = headers['x-api-version'] || headers['X-API-Version'];
    if (headerVer && headerVer.trim().length > 0) {
      const rawVer = normalizeVersion(headerVer);
      return {
        version: rawVer,
        isSupported: isSupportedVersion(rawVer),
        source: 'header',
        canonicalPath: path,
      };
    }

    // 3. Check Accept header: application/vnd.projectmind.v1+json
    const acceptHeader = headers['accept'] || headers['Accept'];
    if (acceptHeader) {
      const acceptMatch = acceptHeader.match(/application\/vnd\.projectmind\.(v[0-9]+)\+json/i);
      if (acceptMatch && acceptMatch[1]) {
        const rawVer = normalizeVersion(acceptMatch[1]);
        return {
          version: rawVer,
          isSupported: isSupportedVersion(rawVer),
          source: 'accept',
          canonicalPath: path,
        };
      }
    }

    // 4. Default fallback
    return {
      version: DEFAULT_API_VERSION,
      isSupported: true,
      source: 'default',
      canonicalPath: path,
    };
  }
}
