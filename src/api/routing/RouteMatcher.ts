export interface CompiledRoute {
  readonly regex: RegExp;
  readonly paramNames: readonly string[];
}

export interface RouteMatchResult {
  readonly matched: boolean;
  readonly params: Record<string, string>;
}

export class RouteMatcher {
  private static readonly PARAM_REGEX = /:([a-zA-Z0-9_]+)/g;

  public static compile(pattern: string): CompiledRoute {
    const paramNames: string[] = [];
    let regexStr = pattern.replace(RouteMatcher.PARAM_REGEX, (_, paramName) => {
      paramNames.push(paramName);
      return '([^/]+)';
    });

    // Ensure strict start and end match, with optional trailing slash
    if (!regexStr.endsWith('/')) {
      regexStr = `^${regexStr}/?$`;
    } else {
      regexStr = `^${regexStr}?$`;
    }

    const regex = new RegExp(regexStr);
    return { regex, paramNames };
  }

  public static match(compiled: CompiledRoute, path: string): RouteMatchResult {
    const match = compiled.regex.exec(path);
    if (!match) {
      return { matched: false, params: {} };
    }

    const params: Record<string, string> = {};
    for (let i = 0; i < compiled.paramNames.length; i++) {
      const name = compiled.paramNames[i]!;
      const value = match[i + 1];
      if (value !== undefined) {
        params[name] = decodeURIComponent(value);
      }
    }

    return { matched: true, params };
  }
}
