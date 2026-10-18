export interface DeprecationInfo {
  readonly version: string;
  readonly deprecatedSince: string;
  readonly sunsetDate?: string | undefined;
  readonly migrationGuideUrl?: string | undefined;
}

export class ApiCompatibility {
  private readonly deprecations: Map<string, DeprecationInfo> = new Map();

  public registerDeprecation(info: DeprecationInfo): void {
    this.deprecations.set(info.version, info);
  }

  public getDeprecationInfo(version: string): DeprecationInfo | undefined {
    return this.deprecations.get(version);
  }

  public getDeprecationHeaders(version: string): Record<string, string> {
    const info = this.deprecations.get(version);
    if (!info) return {};

    const headers: Record<string, string> = {
      Deprecation: 'true',
    };
    if (info.sunsetDate) {
      headers['Sunset'] = info.sunsetDate;
    }
    if (info.migrationGuideUrl) {
      headers['Link'] = `<${info.migrationGuideUrl}>; rel="deprecation"`;
    }
    return headers;
  }
}
