import { TokenEstimator } from './TokenEstimator.js';

export interface TruncationResult<T> {
  items: T[];
  wasTruncated: boolean;
  tokensUsed: number;
}

export class ContextTruncationPolicy {
  public static truncateArray<T>(
    items: T[],
    quota: number,
    itemEstimator?: (item: T) => number
  ): TruncationResult<T> {
    const kept: T[] = [];
    let used = 0;
    let wasTruncated = false;

    for (const item of items) {
      const itemTokens = itemEstimator ? itemEstimator(item) : TokenEstimator.estimate(item);
      if (used + itemTokens <= quota) {
        kept.push(item);
        used += itemTokens;
      } else {
        wasTruncated = true;
        break;
      }
    }

    return {
      items: kept,
      wasTruncated,
      tokensUsed: used,
    };
  }

  public static truncateString(text: string, maxTokens: number): { text: string; wasTruncated: boolean } {
    const currentTokens = TokenEstimator.estimate(text);
    if (currentTokens <= maxTokens) {
      return { text, wasTruncated: false };
    }

    const maxChars = Math.max(20, maxTokens * 4);
    return {
      text: `${text.slice(0, maxChars - 15)}... [truncated]`,
      wasTruncated: true,
    };
  }
}
