export class StaleFencingTokenError extends Error {
  public readonly resourceKey: string;
  public readonly providedToken: number;
  public readonly expectedToken: number;

  constructor(resourceKey: string, providedToken: number, expectedToken: number) {
    super(
      `Stale fencing token error on '${resourceKey}': provided token ${providedToken} is older than highest observed token ${expectedToken}. Write rejected to prevent state corruption.`
    );
    this.name = 'StaleFencingTokenError';
    this.resourceKey = resourceKey;
    this.providedToken = providedToken;
    this.expectedToken = expectedToken;
  }
}

export class FencingGuard {
  private readonly highestSeenTokens = new Map<string, number>();

  /**
   * Records a newly observed fencing token on a resource.
   * Returns true if the token is strictly greater than or equal to the previous token.
   */
  public recordToken(resourceKey: string, fencingToken: number): boolean {
    const current = this.highestSeenTokens.get(resourceKey) ?? 0;
    if (fencingToken >= current) {
      this.highestSeenTokens.set(resourceKey, fencingToken);
      return true;
    }
    return false;
  }

  /**
   * Asserts that the provided fencing token is currently valid and not superseded.
   * Throws StaleFencingTokenError if an older token attempts an operation.
   */
  public assertValid(resourceKey: string, fencingToken: number): void {
    const current = this.highestSeenTokens.get(resourceKey) ?? 0;
    if (fencingToken < current) {
      throw new StaleFencingTokenError(resourceKey, fencingToken, current);
    }
    // Update to this token if higher
    if (fencingToken > current) {
      this.highestSeenTokens.set(resourceKey, fencingToken);
    }
  }

  /**
   * Gets the highest observed fencing token for a resource.
   */
  public getHighestToken(resourceKey: string): number {
    return this.highestSeenTokens.get(resourceKey) ?? 0;
  }

  /**
   * Resets token memory for a resource (for test cleanup or resource teardown).
   */
  public reset(resourceKey?: string): void {
    if (resourceKey) {
      this.highestSeenTokens.delete(resourceKey);
    } else {
      this.highestSeenTokens.clear();
    }
  }
}
