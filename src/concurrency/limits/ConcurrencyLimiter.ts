import type { IConcurrencyLimiter } from './IConcurrencyLimiter.js';

interface Waiter {
  resolve: (release: () => void) => void;
  reject: (err: Error) => void;
  timer?: NodeJS.Timeout | undefined;
}

export class ConcurrencyLimiter implements IConcurrencyLimiter {
  private active = 0;
  private readonly waiters: Waiter[] = [];
  public readonly capacity: number;

  constructor(capacity: number) {
    if (capacity <= 0) {
      throw new Error('ConcurrencyLimiter capacity must be greater than 0');
    }
    this.capacity = capacity;
  }

  public get activeCount(): number {
    return this.active;
  }

  public get queueDepth(): number {
    return this.waiters.length;
  }

  public async acquire(timeoutMs?: number): Promise<() => void> {
    if (this.active < this.capacity) {
      this.active++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject };

      if (timeoutMs && timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = this.waiters.indexOf(waiter);
          if (idx !== -1) {
            this.waiters.splice(idx, 1);
            reject(new Error(`Concurrency limit acquisition timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }

      this.waiters.push(waiter);
    });
  }

  private release(): void {
    this.active--;
    if (this.waiters.length > 0 && this.active < this.capacity) {
      const next = this.waiters.shift()!;
      if (next.timer) {
        clearTimeout(next.timer);
      }
      this.active++;
      let released = false;
      const releaseFn = () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
      next.resolve(releaseFn);
    }
  }

  public async run<T>(task: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const release = await this.acquire(timeoutMs);
    try {
      return await task();
    } finally {
      release();
    }
  }
}
