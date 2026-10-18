export class TokenEstimator {
  /**
   * Fast, reliable token estimation heuristic: ~4 characters per token for English text and code.
   */
  public static estimate(input: unknown): number {
    if (input === null || input === undefined) {
      return 0;
    }

    if (typeof input === 'string') {
      if (input.length === 0) return 0;
      // Word and whitespace heuristic: ~3.5 to 4 chars per token on average
      return Math.max(1, Math.ceil(input.length / 4));
    }

    if (typeof input === 'number' || typeof input === 'boolean') {
      return 1;
    }

    if (Array.isArray(input)) {
      let tokens = 2; // Array brackets
      for (const item of input) {
        tokens += this.estimate(item);
      }
      return tokens;
    }

    if (typeof input === 'object') {
      try {
        const json = JSON.stringify(input);
        return Math.max(1, Math.ceil(json.length / 4));
      } catch {
        return 10;
      }
    }

    return 1;
  }
}
