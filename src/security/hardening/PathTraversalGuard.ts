import * as path from 'node:path';
import * as fs from 'node:fs';

export class PathTraversalError extends Error {
  constructor(
    public readonly reason: string,
    public readonly targetPath: string,
    public readonly baseRoot?: string | undefined
  ) {
    super(`Path traversal violation: ${reason} [path: '${targetPath}']`);
    this.name = 'PathTraversalError';
  }
}

export interface PathValidationOptions {
  readonly allowSymlinks?: boolean | undefined;
}

export class PathTraversalGuard {
  /**
   * Asserts that untrustedPath resolves strictly within baseRoot.
   * Throws PathTraversalError if traversal, null-bytes, or unauthorized escapes are detected.
   * Returns the canonical, normalized absolute path.
   */
  public static assertSafePath(
    baseRoot: string,
    untrustedPath: string,
    options?: PathValidationOptions
  ): string {
    if (typeof untrustedPath !== 'string' || untrustedPath.trim().length === 0) {
      throw new PathTraversalError('Path cannot be empty or non-string', untrustedPath, baseRoot);
    }

    // 1. Check for null byte injection
    if (untrustedPath.includes('\0')) {
      throw new PathTraversalError('Null byte detected in path', untrustedPath, baseRoot);
    }

    const resolvedBase = path.resolve(baseRoot);

    // 2. Reject absolute system paths when passed as untrusted relative components
    if (
      untrustedPath.startsWith('/etc/') ||
      untrustedPath.startsWith('/var/') ||
      untrustedPath.startsWith('/usr/') ||
      untrustedPath.startsWith('/bin/') ||
      untrustedPath.startsWith('/sbin/') ||
      untrustedPath.startsWith('/root/') ||
      /^[a-zA-Z]:[\\/]/.test(untrustedPath) ||
      untrustedPath.startsWith('\\\\')
    ) {
      // If the untrusted path is already an absolute system root, check if it equals or is inside baseRoot
      const resolvedTarget = path.resolve(untrustedPath);
      if (!this.isWithinBase(resolvedBase, resolvedTarget)) {
        throw new PathTraversalError(
          'Target path attempts unauthorized access to system root',
          untrustedPath,
          resolvedBase
        );
      }
    }

    // 3. Resolve target relative to baseRoot
    const resolvedTarget = path.resolve(resolvedBase, untrustedPath);

    // 4. Verify boundary containment with proper separator handling (prevents prefix collisions)
    if (!this.isWithinBase(resolvedBase, resolvedTarget)) {
      throw new PathTraversalError(
        'Resolved path escapes authorized root directory',
        untrustedPath,
        resolvedBase
      );
    }

    // 5. Check realpath for symlink traversal if requested or if file exists
    if (options?.allowSymlinks === false && fs.existsSync(resolvedTarget)) {
      try {
        const realTarget = fs.realpathSync(resolvedTarget);
        const realBase = fs.existsSync(resolvedBase) ? fs.realpathSync(resolvedBase) : resolvedBase;
        if (!this.isWithinBase(realBase, realTarget)) {
          throw new PathTraversalError(
            'Symlink resolves outside authorized root directory',
            untrustedPath,
            resolvedBase
          );
        }
      } catch (err: any) {
        if (err instanceof PathTraversalError) throw err;
        // If realpath fails due to permissions or broken link
        throw new PathTraversalError(`Failed to resolve realpath: ${err.message}`, untrustedPath, resolvedBase);
      }
    }

    return resolvedTarget;
  }

  /**
   * Returns true if untrustedPath safely resolves within baseRoot without throwing.
   */
  public static isSafePath(
    baseRoot: string,
    untrustedPath: string,
    options?: PathValidationOptions
  ): boolean {
    try {
      this.assertSafePath(baseRoot, untrustedPath, options);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes a relative path string by stripping leading drives/slashes and normalization.
   */
  public static sanitizeRelativePath(untrustedPath: string): string {
    if (!untrustedPath || typeof untrustedPath !== 'string') {
      return '';
    }

    // Remove null bytes
    let clean = untrustedPath.replace(/\0/g, '');

    // Strip Windows drive letters (e.g. C:)
    clean = clean.replace(/^[a-zA-Z]:/, '');

    // Strip leading slashes
    clean = clean.replace(/^[\\/]+/, '');

    // Normalize separators
    const normalized = path.normalize(clean);

    // Prevent .. traversal
    const parts = normalized.split(/[\\/]/).filter((p) => p !== '' && p !== '.' && p !== '..');
    return parts.join(path.sep);
  }

  private static isWithinBase(base: string, target: string): boolean {
    const normBase = path.normalize(base);
    const normTarget = path.normalize(target);

    if (normBase === normTarget) {
      return true;
    }

    // On Windows, handle case-insensitivity
    const isWindows = process.platform === 'win32';
    const compareBase = isWindows ? normBase.toLowerCase() : normBase;
    const compareTarget = isWindows ? normTarget.toLowerCase() : normTarget;

    const baseWithSep = compareBase.endsWith(path.sep) ? compareBase : compareBase + path.sep;
    return compareTarget.startsWith(baseWithSep);
  }
}
