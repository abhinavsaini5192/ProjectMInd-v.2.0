export interface FreshnessValidationResult {
  readonly isFresh: boolean;
  readonly inputVersion: number;
  readonly currentVersion: number;
  readonly reason?: string | undefined;
}

export class StaleComputationError extends Error {
  constructor(
    public readonly resourceId: string,
    public readonly inputVersion: number,
    public readonly currentVersion: number
  ) {
    super(
      `Stale computation rejected for resource '${resourceId}': computation started with version ${inputVersion}, but current version is ${currentVersion}`
    );
    this.name = 'StaleComputationError';
  }
}

export class StaleResultDetector {
  /**
   * Asserts that the underlying resource has not evolved past the computation's input version.
   * Throws StaleComputationError if currentVersion > inputVersion.
   */
  public static async assertFresh(
    resourceId: string,
    inputVersion: number,
    fetchCurrentVersion: () => Promise<number>
  ): Promise<void> {
    const currentVersion = await fetchCurrentVersion();
    if (currentVersion > inputVersion) {
      throw new StaleComputationError(resourceId, inputVersion, currentVersion);
    }
  }

  /**
   * Checks freshness without throwing.
   */
  public static async checkFreshness(
    _resourceId: string,
    inputVersion: number,
    fetchCurrentVersion: () => Promise<number>
  ): Promise<FreshnessValidationResult> {
    const currentVersion = await fetchCurrentVersion();
    if (currentVersion > inputVersion) {
      return {
        isFresh: false,
        inputVersion,
        currentVersion,
        reason: `Current version (${currentVersion}) is newer than computation input version (${inputVersion})`,
      };
    }
    return {
      isFresh: true,
      inputVersion,
      currentVersion,
    };
  }
}
