import * as path from 'path';

export class FilesystemValidator {
  static isValidPath(p: string): boolean {
    return typeof p === 'string' && p.trim().length > 0;
  }

  static isSafeSubpath(basePath: string, subPath: string): boolean {
    if (!subPath || typeof subPath !== 'string' || subPath.includes('\0')) {
      return false;
    }
    const resolvedBase = path.resolve(basePath);
    const resolvedSub = path.resolve(basePath, subPath);

    if (resolvedBase === resolvedSub) {
      return true;
    }

    const isWindows = process.platform === 'win32';
    const compareBase = isWindows ? resolvedBase.toLowerCase() : resolvedBase;
    const compareSub = isWindows ? resolvedSub.toLowerCase() : resolvedSub;
    const baseWithSep = compareBase.endsWith(path.sep) ? compareBase : compareBase + path.sep;

    return compareSub.startsWith(baseWithSep);
  }
}
