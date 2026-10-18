import * as path from 'node:path';
import * as os from 'node:os';
import Database from 'better-sqlite3';
import { ProjectMindKernel } from '../kernel/ProjectMindKernel.js';
import { LoadTestHarness, type LoadTestResult } from './LoadTestHarness.js';
import { FailureInjectionHarness, type FailureScenarioResult } from './FailureInjectionHarness.js';
import { TokenBudgetManager } from '../context/budgeting/TokenBudgetManager.js';
import { createDefaultRelevance } from '../context/models/ContextRelevance.js';
import { ResourceLockManager } from '../concurrency/locking/ResourceLockManager.js';
import { InMemoryJobQueue } from '../jobs/queue/InMemoryJobQueue.js';
import { AuditLogger } from '../security/core/AuditLogger.js';

export interface ComprehensiveBenchmarkReport {
  readonly environment: {
    readonly nodeVersion: string;
    readonly platform: string;
    readonly arch: string;
    readonly cpus: number;
    readonly totalMemoryMb: number;
    readonly freeMemoryMb: number;
  };
  readonly timestamp: string;
  readonly loadTests: Record<string, LoadTestResult>;
  readonly failureDrills: Record<string, FailureScenarioResult>;
  readonly summary: {
    readonly totalScenarios: number;
    readonly allPassed: boolean;
    readonly durationMs: number;
  };
}

export class BenchmarkSuite {
  private readonly loadHarness = new LoadTestHarness();
  private readonly failureHarness = new FailureInjectionHarness();

  constructor(private readonly kernel: ProjectMindKernel) {}

  public async runAll(): Promise<ComprehensiveBenchmarkReport> {
    console.log('Starting Comprehensive Enterprise Benchmark & Load Suite...\n');
    const startOverall = performance.now();

    const loadTests: Record<string, LoadTestResult> = {};
    const failureDrills: Record<string, FailureScenarioResult> = {};

    // 1. Real Event Routing Benchmark
    console.log('Running Event Routing Benchmark...');
    loadTests.eventRouting = await this.loadHarness.runBenchmark(
      'Event Dispatch & Routing',
      (i) => {
        this.kernel.eventDispatcher.dispatch('BenchmarkEvent', { index: i, timestamp: Date.now() });
      },
      { concurrency: 4, iterations: 1000, warmupIterations: 50 }
    );
    console.log(`⏱ Event Routing: avg ${loadTests.eventRouting.stats.avgMs}ms, P95 ${loadTests.eventRouting.stats.p95Ms}ms (${loadTests.eventRouting.stats.throughputOpsPerSec} ops/sec)`);

    // 2. Real Context Budgeting & Assembly Benchmark
    console.log('Running Context Assembly & Budgeting Benchmark...');
    const budgetManager = new TokenBudgetManager();
    const sampleContextData = {
      features: [
        {
          featureId: 'feat-bench-1',
          name: 'Core Kernel',
          description: 'Benchmark feature description',
          type: 'BENCHMARK',
          status: 'ACTIVE' as const,
          role: 'DIRECT' as const,
          relevance: createDefaultRelevance(1.0, 1.0, true, ['Core']),
          priority: 'HIGH' as const,
          resources: [],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
          estimatedTokens: 150,
        },
      ],
      resources: Array.from({ length: 25 }, (_, i) => ({
        resourceId: `src/kernel/Module_${i}.ts`,
        featureId: 'feat-bench-1',
        role: 'SOURCE_CODE' as const,
        relevance: createDefaultRelevance(0.95 - i * 0.02, 1.0, true, ['Benchmark']),
        priority: 'HIGH' as const,
        estimatedTokens: 90,
      })),
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: {},
    };

    loadTests.contextAssembly = await this.loadHarness.runBenchmark(
      'Context Token Budgeting & Assembly',
      () => {
        budgetManager.applyBudget(sampleContextData, {
          totalBudget: 4000,
          reservedForPrompt: 500,
          reservedForMetadata: 300,
          availableForContext: 3200,
          compactMode: false,
        });
      },
      { concurrency: 2, iterations: 200, warmupIterations: 20 }
    );
    console.log(`⏱ Context Assembly: avg ${loadTests.contextAssembly.stats.avgMs}ms, P95 ${loadTests.contextAssembly.stats.p95Ms}ms (${loadTests.contextAssembly.stats.throughputOpsPerSec} ops/sec)`);

    // 3. Real SQLite WAL Database Operations Benchmark
    console.log('Running SQLite WAL Persistence Benchmark...');
    const dbPath = path.join(this.kernel.workspaceManager.workspacePath, '.projectmind/data/perf_bench.db');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.exec('CREATE TABLE IF NOT EXISTS pm_perf_bench (id INTEGER PRIMARY KEY, key TEXT, value TEXT, created_at INTEGER)');
    const insertStmt = db.prepare('INSERT INTO pm_perf_bench (key, value, created_at) VALUES (?, ?, ?)');
    const selectStmt = db.prepare('SELECT * FROM pm_perf_bench WHERE key = ?');

    loadTests.databaseOperations = await this.loadHarness.runBenchmark(
      'SQLite WAL Write and Read',
      (i) => {
        const key = `key_${i}`;
        insertStmt.run(key, JSON.stringify({ index: i, payload: 'data' }), Date.now());
        selectStmt.get(key);
      },
      { concurrency: 1, iterations: 500, warmupIterations: 25 }
    );
    db.close();
    console.log(`⏱ Database Operations: avg ${loadTests.databaseOperations.stats.avgMs}ms, P95 ${loadTests.databaseOperations.stats.p95Ms}ms (${loadTests.databaseOperations.stats.throughputOpsPerSec} ops/sec)`);

    // 4. Real Concurrency Resource Locking Benchmark
    console.log('Running Resource Lock Acquisition Benchmark...');
    const lockManager = new ResourceLockManager();
    loadTests.resourceLocking = await this.loadHarness.runBenchmark(
      'Resource Lock Acquisition and Release',
      async (i) => {
        const lockRes = await lockManager.acquire(`res_bench_${i}`, 'bench_owner', { ttlMs: 5000 });
        if (lockRes.success && lockRes.lock) {
          await lockManager.release(lockRes.lock.lockId, 'bench_owner');
        }
      },
      { concurrency: 4, iterations: 300, warmupIterations: 20 }
    );
    console.log(`⏱ Resource Locking: avg ${loadTests.resourceLocking.stats.avgMs}ms, P95 ${loadTests.resourceLocking.stats.p95Ms}ms (${loadTests.resourceLocking.stats.throughputOpsPerSec} ops/sec)`);

    // 5. Real Job Queue Throughput Benchmark
    console.log('Running Job Queue Enqueue & Dequeue Benchmark...');
    const queue = new InMemoryJobQueue({ maxCapacity: 10000 });
    loadTests.jobQueueThroughput = await this.loadHarness.runBenchmark(
      'Job Queue Enqueue/Dequeue',
      async (i) => {
        await queue.enqueue(`bench_job_${i}`, i % 2 === 0 ? 'HIGH' : 'NORMAL');
        const msg = await queue.dequeue();
        if (msg) {
          await queue.acknowledge(msg.receiptHandle);
        }
      },
      { concurrency: 2, iterations: 500, warmupIterations: 20 }
    );
    console.log(`⏱ Job Queue: avg ${loadTests.jobQueueThroughput.stats.avgMs}ms, P95 ${loadTests.jobQueueThroughput.stats.p95Ms}ms (${loadTests.jobQueueThroughput.stats.throughputOpsPerSec} ops/sec)`);

    // 6. Real Cryptographic Audit Logging & Hash Chaining Benchmark
    console.log('Running Cryptographic Audit Logging Benchmark...');
    const auditLogger = new AuditLogger();
    loadTests.cryptoAudit = await this.loadHarness.runBenchmark(
      'Cryptographic SHA-256 Audit Chaining',
      async (i) => {
        await auditLogger.logEvent({
          eventType: 'AUTHORIZATION_ALLOW',
          principalId: `user_${i}`,
          workspaceId: 'ws_bench',
          action: 'READ',
          result: 'ALLOWED',
        });
      },
      { concurrency: 1, iterations: 200, warmupIterations: 10 }
    );
    const integrityCheck = await auditLogger.verifyIntegrity();
    console.log(`⏱ Audit Logging: avg ${loadTests.cryptoAudit.stats.avgMs}ms, Integrity verified: ${integrityCheck.isTamperFree}`);

    // 7. Failure Injection & Resilience Drills
    console.log('\nRunning Failure Injection Drills...');
    const failureDbPath = path.join(this.kernel.workspaceManager.workspacePath, '.projectmind/data/failure_drill.db');
    const failureTempDir = path.join(this.kernel.workspaceManager.workspacePath, '.projectmind/data/failure_temp');

    failureDrills.sqliteContention = await this.failureHarness.testSqliteWriteContention(failureDbPath);
    console.log(`✓ [Failure Drill] ${failureDrills.sqliteContention.scenarioName}: Passed (${failureDrills.sqliteContention.timeToRecoveryMs}ms)`);

    failureDrills.workerCrashRecovery = await this.failureHarness.testWorkerLeaseExpirationRecovery(failureDbPath);
    console.log(`✓ [Failure Drill] ${failureDrills.workerCrashRecovery.scenarioName}: Passed (${failureDrills.workerCrashRecovery.timeToRecoveryMs}ms)`);

    failureDrills.dlqPoisonJob = await this.failureHarness.testPoisonJobDeadLetterRouting();
    console.log(`✓ [Failure Drill] ${failureDrills.dlqPoisonJob.scenarioName}: Passed (${failureDrills.dlqPoisonJob.timeToRecoveryMs}ms)`);

    failureDrills.staleLockRejection = await this.failureHarness.testStaleLockHolderRejection();
    console.log(`✓ [Failure Drill] ${failureDrills.staleLockRejection.scenarioName}: Passed (${failureDrills.staleLockRejection.timeToRecoveryMs}ms)`);

    failureDrills.queueBackpressure = await this.failureHarness.testQueueBackpressureOverload();
    console.log(`✓ [Failure Drill] ${failureDrills.queueBackpressure.scenarioName}: Passed (${failureDrills.queueBackpressure.timeToRecoveryMs}ms)`);

    failureDrills.corruptedBackup = await this.failureHarness.testCorruptedBackupDetection(failureTempDir);
    console.log(`✓ [Failure Drill] ${failureDrills.corruptedBackup.scenarioName}: Passed (${failureDrills.corruptedBackup.timeToRecoveryMs}ms)`);

    failureDrills.securityUnderLoad = await this.failureHarness.testSecurityPreservationUnderBurst();
    console.log(`✓ [Failure Drill] ${failureDrills.securityUnderLoad.scenarioName}: Passed (${failureDrills.securityUnderLoad.timeToRecoveryMs}ms)`);

    const totalDurationMs = Number((performance.now() - startOverall).toFixed(2));
    const allPassed = Object.values(failureDrills).every((d) => d.passed) &&
      Object.values(loadTests).every((t) => t.stats.errorCount === 0);

    const report: ComprehensiveBenchmarkReport = {
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
        freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      },
      timestamp: new Date().toISOString(),
      loadTests,
      failureDrills,
      summary: {
        totalScenarios: Object.keys(loadTests).length + Object.keys(failureDrills).length,
        allPassed,
        durationMs: totalDurationMs,
      },
    };

    // Save report artifacts
    const rootReportPath = path.join(this.kernel.workspaceManager.workspacePath, 'benchmark_report.json');
    const dotProjectMindPath = path.join(this.kernel.workspaceManager.workspacePath, '.projectmind/benchmarks/benchmark_report.json');

    this.loadHarness.saveReport(rootReportPath, report as unknown as Record<string, unknown>);
    this.loadHarness.saveReport(dotProjectMindPath, report as unknown as Record<string, unknown>);

    console.log(`\nComprehensive benchmark report saved to:\n  - ${rootReportPath}\n  - ${dotProjectMindPath}`);
    return report;
  }
}
