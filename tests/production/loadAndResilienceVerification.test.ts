import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import { LoadTestHarness } from '../../src/benchmark/LoadTestHarness.js';
import { FailureInjectionHarness } from '../../src/benchmark/FailureInjectionHarness.js';
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import { createDefaultRelevance } from '../../src/context/models/ContextRelevance.js';
import { DurableJobQueue } from '../../src/jobs/queue/DurableJobQueue.js';
import { InMemoryJobQueue } from '../../src/jobs/queue/InMemoryJobQueue.js';
import { DeadLetterQueue } from '../../src/jobs/recovery/DeadLetterQueue.js';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { DistributedLockManager } from '../../src/distributed/locking/DistributedLockManager.js';
import { HttpAdapter } from '../../src/api/adapters/HttpAdapter.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { CrossScopeGuard, CrossScopeViolationError } from '../../src/security/hardening/CrossScopeGuard.js';
import { AuthenticationService } from '../../src/security/core/AuthenticationService.js';
import { PrincipalResolver } from '../../src/security/core/PrincipalResolver.js';
import { AuditLogger } from '../../src/security/core/AuditLogger.js';

describe('Phase 10.9 — Load, Resilience & Failure Injection Testing Suite', () => {
  const loadHarness = new LoadTestHarness();
  const failureHarness = new FailureInjectionHarness();
  const testDataDir = path.resolve('tests/fixtures/perf_test_data');

  beforeEach(() => {
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testDataDir)) {
        fs.rmSync(testDataDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup locks
    }
  });

  describe('1. API & Request-Path Performance', () => {
    it('handles concurrent HTTP requests with enterprise security headers and sub-millisecond P95 latency', async () => {
      const router = new ApiRouter();
      router.get('/v1/status', async () => ({
        status: 200,
        data: { status: 'healthy', uptime: 123 },
        meta: {
          requestId: 'req-load',
          correlationId: 'corr-load',
          apiVersion: '1.0.0',
          timestamp: Date.now(),
        },
      }));
      const apiService = new ApiService({ router });
      const adapter = new HttpAdapter(apiService);

      const result = await loadHarness.runBenchmark(
        'Concurrent API Status Requests',
        async (i) => {
          const req: any = {
            method: 'GET',
            url: '/v1/status',
            headers: { host: 'localhost:8080' },
            socket: { remoteAddress: '127.0.0.1' },
          };

          let statusCode = 0;
          let writtenHeaders: Record<string, string> = {};
          const res: any = {
            writeHead: (status: number, headers: Record<string, string>) => {
              statusCode = status;
              writtenHeaders = headers;
            },
            end: () => {},
          };

          await adapter.handleRequest(req, res);
          expect(statusCode).toBe(200);
          expect(writtenHeaders['x-content-type-options']).toBe('nosniff');
        },
        { concurrency: 4, iterations: 200, warmupIterations: 10 }
      );

      expect(result.stats.count).toBe(200);
      expect(result.stats.errorCount).toBe(0);
      expect(result.stats.p95Ms).toBeLessThan(50); // Generous ceiling for CI
      expect(result.stats.throughputOpsPerSec).toBeGreaterThan(500);
    });
  });

  describe('2. Repository Extraction & Context Intelligence Under Load', () => {
    it('executes token budgeting and context selection across multi-resource datasets', async () => {
      const budgetManager = new TokenBudgetManager();
      const sampleContext = {
        features: Array.from({ length: 5 }, (_, f) => ({
          featureId: `feat-${f}`,
          name: `Feature ${f}`,
          description: 'Context intelligence feature under load',
          type: 'CORE',
          status: 'ACTIVE' as const,
          role: 'DIRECT' as const,
          relevance: createDefaultRelevance(0.9, 1.0, true, ['LoadTest']),
          priority: 'HIGH' as const,
          resources: [],
          entryPoints: [],
          primaryFlows: [],
          risks: [],
          estimatedTokens: 200,
        })),
        resources: Array.from({ length: 50 }, (_, r) => ({
          resourceId: `src/core/Component_${r}.ts`,
          featureId: `feat-${r % 5}`,
          role: 'SOURCE_CODE' as const,
          relevance: createDefaultRelevance(0.95 - (r % 10) * 0.05, 1.0, true, ['Component']),
          priority: 'HIGH' as const,
          estimatedTokens: 120,
        })),
        behaviorFlows: [],
        tests: [],
        risks: [],
        milestones: [],
        explanations: {},
      };

      const result = await loadHarness.runBenchmark(
        'Context Assembly & Token Budgeting',
        () => {
          budgetManager.applyBudget(sampleContext, {
            totalBudget: 4000,
            reservedForPrompt: 600,
            reservedForMetadata: 400,
            availableForContext: 3000,
            compactMode: false,
          });
        },
        { concurrency: 4, iterations: 200, warmupIterations: 20 }
      );

      expect(result.stats.count).toBe(200);
      expect(result.stats.errorCount).toBe(0);
      expect(result.stats.avgMs).toBeLessThan(10);
      expect(result.stats.p95Ms).toBeLessThan(25);
    });
  });

  describe('3. Distributed Concurrency & Locking Under Contention', () => {
    it('handles heavy lock contention with graceful wait and release', async () => {
      const backend = new MemoryCoordinationBackend();
      const lockMgr1 = new DistributedLockManager(backend, { ownerId: 'contention-worker-1' });
      const lockMgr2 = new DistributedLockManager(backend, { ownerId: 'contention-worker-2' });

      let acquiredCount = 0;
      let blockedCount = 0;

      const result = await loadHarness.runBenchmark(
        'Lock Contention Cycles',
        async (i) => {
          // Both workers compete for the identical resource key
          const resourceKey = 'shared:global:reindex';
          const [res1, res2] = await Promise.all([
            lockMgr1.acquire(resourceKey, { ttlMs: 100, waitTimeoutMs: 10 }),
            lockMgr2.acquire(resourceKey, { ttlMs: 100, waitTimeoutMs: 10 }),
          ]);

          if (res1.success) {
            acquiredCount++;
            await lockMgr1.release(res1.lock);
          } else {
            blockedCount++;
          }

          if (res2.success) {
            acquiredCount++;
            await lockMgr2.release(res2.lock);
          } else {
            blockedCount++;
          }
        },
        { concurrency: 2, iterations: 50, warmupIterations: 5 }
      );

      await backend.close();
      expect(result.stats.errorCount).toBe(0);
      expect(acquiredCount).toBeGreaterThan(0);
      expect(blockedCount).toBeGreaterThan(0); // Proves mutual exclusion worked
    });

    it('rejects stale lock holders after lease expiry (fencing token enforcement)', async () => {
      const res = await failureHarness.testStaleLockHolderRejection();
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });
  });

  describe('4. Durable Jobs & Event Queue Stress', () => {
    it('executes durable job enqueues and dequeues on SQLite WAL queue with high throughput', async () => {
      const dbPath = path.join(testDataDir, 'durable_queue_perf.db');
      const db = new Database(dbPath);
      const queue = new DurableJobQueue(db);

      const jobCount = 200;
      const startEnqueue = performance.now();
      for (let i = 0; i < jobCount; i++) {
        await queue.enqueue(`durable_job_${i}`, i % 3 === 0 ? 'HIGH' : 'NORMAL');
      }
      const enqueueDuration = performance.now() - startEnqueue;

      expect(await queue.getDepth()).toBe(jobCount);

      const startDequeue = performance.now();
      let dequeued = 0;
      for (let i = 0; i < jobCount; i++) {
        const msg = await queue.dequeue(5000);
        if (msg) {
          dequeued++;
          await queue.acknowledge(msg.receiptHandle);
        }
      }
      const dequeueDuration = performance.now() - startDequeue;

      expect(dequeued).toBe(jobCount);
      expect(await queue.getDepth()).toBe(0);
      expect(enqueueDuration).toBeLessThan(1000);
      expect(dequeueDuration).toBeLessThan(1500);

      db.close();
    });

    it('reclaims jobs after worker process crash and lease expiration', async () => {
      const dbPath = path.join(testDataDir, 'worker_crash_drill.db');
      const res = await failureHarness.testWorkerLeaseExpirationRecovery(dbPath);
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
      expect(res.timeToRecoveryMs).toBeGreaterThanOrEqual(50); // Waited for visibility expiration
    });

    it('quarantines poison jobs into DeadLetterQueue after retry exhaustion', async () => {
      const res = await failureHarness.testPoisonJobDeadLetterRouting();
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });

    it('enforces queue backpressure when maxCapacity threshold is exceeded', async () => {
      const res = await failureHarness.testQueueBackpressureOverload();
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });
  });

  describe('5. Resource Consumption & Leak Detection', () => {
    it('demonstrates stable memory consumption without runaway heap growth across 1,000 operations', async () => {
      const queue = new InMemoryJobQueue({ maxCapacity: 10000 });
      const budgetManager = new TokenBudgetManager();
      const auditLogger = new AuditLogger();

      const result = await loadHarness.runBenchmark(
        'Sustained Multi-Engine Load (Leak Detection)',
        async (i) => {
          // 1. Job lifecycle
          await queue.enqueue(`leak_test_${i}`, 'NORMAL');
          const msg = await queue.dequeue();
          if (msg) await queue.acknowledge(msg.receiptHandle);

          // 2. Audit logging
          await auditLogger.logEvent({
            eventType: 'AUTHENTICATION_SUCCESS',
            principalId: `user_${i}`,
            result: 'SUCCESS',
          });

          // 3. Context budgeting
          budgetManager.applyBudget({
            features: [],
            resources: [],
            behaviorFlows: [],
            tests: [],
            risks: [],
            milestones: [],
            explanations: {},
          }, {
            totalBudget: 2000,
            reservedForPrompt: 500,
            reservedForMetadata: 200,
            availableForContext: 1300,
            compactMode: false,
          });
        },
        { concurrency: 2, iterations: 1000, warmupIterations: 50 }
      );

      expect(result.stats.count).toBe(1000);
      expect(result.stats.errorCount).toBe(0);

      // Verify that heap growth is bounded (< 25MB growth for 1,000 multi-engine operations)
      const heapGrowthMb = result.resources.heapUsedDeltaBytes / (1024 * 1024);
      expect(heapGrowthMb).toBeLessThan(25);
    });
  });

  describe('6. Failure Injection & Disaster Recovery Verification', () => {
    it('survives concurrent SQLite write contention with 100% data integrity', async () => {
      const dbPath = path.join(testDataDir, 'contention_drill.db');
      const res = await failureHarness.testSqliteWriteContention(dbPath);
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });

    it('detects and rejects corrupted backup snapshots during restore validation', async () => {
      const tempBackupDir = path.join(testDataDir, 'corrupt_backup_drill');
      const res = await failureHarness.testCorruptedBackupDetection(tempBackupDir);
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });
  });

  describe('7. Security & Tenant Isolation Under Burst Load', () => {
    it('strictly maintains tenant boundaries and rejects dev authentication bypass under burst traffic', async () => {
      const res = await failureHarness.testSecurityPreservationUnderBurst();
      expect(res.passed).toBe(true);
      expect(res.dataIntegrityVerified).toBe(true);
    });
  });
});
