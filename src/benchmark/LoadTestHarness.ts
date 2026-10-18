import * as fs from 'node:fs';
import * as path from 'node:path';

export interface LatencyStats {
  readonly count: number;
  readonly totalDurationMs: number;
  readonly throughputOpsPerSec: number;
  readonly avgMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly p50Ms: number;
  readonly p90Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly errorCount: number;
  readonly timeoutCount: number;
}

export interface ResourceDelta {
  readonly heapUsedDeltaBytes: number;
  readonly rssDeltaBytes: number;
  readonly initialMemory: NodeJS.MemoryUsage;
  readonly finalMemory: NodeJS.MemoryUsage;
}

export interface LoadTestResult {
  readonly scenarioName: string;
  readonly concurrency: number;
  readonly iterations: number;
  readonly warmupIterations: number;
  readonly stats: LatencyStats;
  readonly resources: ResourceDelta;
  readonly timestamp: string;
}

export interface LoadTestOptions {
  readonly concurrency?: number | undefined; // default 1
  readonly iterations?: number | undefined; // default 100
  readonly warmupIterations?: number | undefined; // default 10
  readonly timeoutMs?: number | undefined; // default 10000
}

export class LoadTestHarness {
  /**
   * Executes a benchmark workload across configurable concurrency, warming up first,
   * collecting fine-grained latency percentiles, error rates, and resource deltas.
   */
  public async runBenchmark<T>(
    scenarioName: string,
    operation: (iteration: number) => Promise<T> | T,
    options: LoadTestOptions = {}
  ): Promise<LoadTestResult> {
    const concurrency = Math.max(1, options.concurrency ?? 1);
    const iterations = Math.max(1, options.iterations ?? 100);
    const warmupIterations = Math.max(0, options.warmupIterations ?? 10);
    const timeoutMs = options.timeoutMs ?? 10000;

    // 1. Warm-up Phase (primes JIT compiler, inline caches, and connection buffers)
    for (let w = 0; w < warmupIterations; w++) {
      try {
        await operation(w);
      } catch {
        // Ignore warm-up exceptions
      }
    }

    // Capture baseline memory
    if (global.gc) {
      global.gc();
    }
    const initialMemory = process.memoryUsage();

    const sampleLatencies: number[] = [];
    let errorCount = 0;
    let timeoutCount = 0;

    let currentIndex = 0;
    const overallStart = performance.now();

    // 2. Concurrency-controlled execution workers
    const workerPromises: Promise<void>[] = [];

    for (let workerId = 0; workerId < concurrency; workerId++) {
      const worker = async () => {
        while (true) {
          const idx = currentIndex++;
          if (idx >= iterations) {
            break;
          }

          const opStart = performance.now();
          try {
            // Apply bounded timeout
            const opPromise = Promise.resolve(operation(idx));
            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
            );

            await Promise.race([opPromise, timeoutPromise]);
            const elapsed = performance.now() - opStart;
            sampleLatencies.push(elapsed);
          } catch (err: any) {
            if (err?.message === 'Operation timed out') {
              timeoutCount++;
            } else {
              errorCount++;
            }
          }
        }
      };

      workerPromises.push(worker());
    }

    await Promise.all(workerPromises);
    const totalElapsedMs = performance.now() - overallStart;

    const finalMemory = process.memoryUsage();
    const resources: ResourceDelta = {
      heapUsedDeltaBytes: finalMemory.heapUsed - initialMemory.heapUsed,
      rssDeltaBytes: finalMemory.rss - initialMemory.rss,
      initialMemory,
      finalMemory,
    };

    const stats = this.calculateStats(sampleLatencies, totalElapsedMs, errorCount, timeoutCount);

    return {
      scenarioName,
      concurrency,
      iterations,
      warmupIterations,
      stats,
      resources,
      timestamp: new Date().toISOString(),
    };
  }

  public calculateStats(
    samples: number[],
    totalDurationMs: number,
    errorCount: number,
    timeoutCount: number
  ): LatencyStats {
    if (samples.length === 0) {
      return {
        count: 0,
        totalDurationMs: Number(totalDurationMs.toFixed(2)),
        throughputOpsPerSec: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p90Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        errorCount,
        timeoutCount,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const total = sorted.reduce((acc, v) => acc + v, 0);
    const count = sorted.length;

    const p50Idx = Math.floor(count * 0.5);
    const p90Idx = Math.min(count - 1, Math.floor(count * 0.9));
    const p95Idx = Math.min(count - 1, Math.floor(count * 0.95));
    const p99Idx = Math.min(count - 1, Math.floor(count * 0.99));

    const throughput = (count / (totalDurationMs || 1)) * 1000;

    return {
      count,
      totalDurationMs: Number(totalDurationMs.toFixed(2)),
      throughputOpsPerSec: Number(throughput.toFixed(2)),
      avgMs: Number((total / count).toFixed(3)),
      minMs: Number(sorted[0].toFixed(3)),
      maxMs: Number(sorted[count - 1].toFixed(3)),
      p50Ms: Number(sorted[p50Idx].toFixed(3)),
      p90Ms: Number(sorted[p90Idx].toFixed(3)),
      p95Ms: Number(sorted[p95Idx].toFixed(3)),
      p99Ms: Number(sorted[p99Idx].toFixed(3)),
      errorCount,
      timeoutCount,
    };
  }

  public saveReport(reportPath: string, reportData: Record<string, unknown>): void {
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2), 'utf8');
  }
}
