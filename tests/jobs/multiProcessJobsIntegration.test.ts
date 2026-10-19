import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';
import { SqliteJobRepository } from '../../src/jobs/persistence/SqliteJobRepository.js';
import { DurableJobQueue } from '../../src/jobs/queue/DurableJobQueue.js';
import { SqliteTransactionalOutbox } from '../../src/jobs/events/outbox/SqliteTransactionalOutbox.js';
import { initializeJobDatabaseSchema } from '../../src/jobs/persistence/JobDatabaseSchema.js';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/durableWorkerRunner.mjs');

interface ProcessRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function spawnRunner(args: string[]): Promise<ProcessRunResult> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env['VITEST'];
    delete env['VITEST_WORKER_ID'];
    delete env['VITEST_POOL_ID'];

    const child = spawn(process.execPath, [FIXTURE_PATH, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (d) => {
      stdout += d.toString();
    });

    child.stderr?.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err?.message || String(err) });
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

describe('Multi-Process Jobs & Outbox Integration', { timeout: 25000 }, () => {
  let tmpDir: string;
  let dbPath: string;
  let db: Database.Database;
  let repo: SqliteJobRepository;
  let queue: DurableJobQueue;
  let outbox: SqliteTransactionalOutbox;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `pm-jobs-proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    dbPath = path.join(tmpDir, 'jobs-test.sqlite');

    db = new Database(dbPath);
    try {
      db.pragma('journal_mode = WAL');
      db.pragma('busy_timeout = 10000');
    } catch {}
    initializeJobDatabaseSchema(db);
    repo = new SqliteJobRepository(db);
    queue = new DurableJobQueue(db);
    outbox = new SqliteTransactionalOutbox(db);
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('safely serializes concurrent job claims across separate OS worker processes', async () => {
    const jobId = 'job-compete-1';
    await repo.save({
      jobId,
      type: 'SEMANTIC_INDEX_UPDATE',
      status: 'QUEUED',
      priority: 'HIGH',
      workspaceId: 'ws-proc-test',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      payload: { repo: 'ProjectMind' },
      version: 1,
    });

    await queue.enqueue(jobId, 'HIGH');

    // Concurrently launch Worker-A and Worker-B competing for the same single job
    const [resA, resB] = await Promise.all([
      spawnRunner(['claim-and-run', dbPath, 'worker-proc-A', '200', 'normal']),
      spawnRunner(['claim-and-run', dbPath, 'worker-proc-B', '200', 'normal']),
    ]);

    // One worker must have claimed and completed the job, and the other got EMPTY
    const outputs = [resA.stdout, resB.stdout];
    const completedCount = outputs.filter((o) => o.includes('COMPLETED:job-compete-1')).length;
    const emptyCount = outputs.filter((o) => o.includes('EMPTY')).length;

    expect(completedCount).toBe(1);
    expect(emptyCount).toBe(1);

    // Verify job in database is COMPLETED
    const finalJob = await repo.getById(jobId);
    expect(finalJob?.status).toBe('COMPLETED');
    expect(((finalJob?.result as unknown) as Record<string, unknown>)?.['success']).toBe(true);
    expect(await queue.getDepth()).toBe(0);
  });

  it('recovers an in-flight job when a worker process crashes abruptly', async () => {
    const jobId = 'job-crash-recovery';
    await repo.save({
      jobId,
      type: 'FEATURE_BEHAVIOR_ANALYSIS',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'ws-proc-test',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      payload: {},
      version: 1,
    });

    await queue.enqueue(jobId, 'NORMAL');

    // Worker A claims the job and crashes (exit code 99)
    const resA = await spawnRunner(['claim-and-run', dbPath, 'worker-crashing', '100', 'crash']);
    expect(resA.code).toBe(99);
    expect(resA.stdout).toContain('CLAIMED:job-crash-recovery:worker-crashing');

    // Wait for the 1000ms visibility timeout to elapse
    await new Promise((r) => setTimeout(r, 1200));

    // Worker B runs next: should successfully reclaim and complete the job
    const resB = await spawnRunner(['claim-and-run', dbPath, 'worker-recovery', '100', 'normal']);
    expect(resB.code).toBe(0);
    expect(resB.stdout).toContain('CLAIMED:job-crash-recovery:worker-recovery');
    expect(resB.stdout).toContain('COMPLETED:job-crash-recovery:worker-recovery');

    const recoveredJob = await repo.getById(jobId);
    expect(recoveredJob?.status).toBe('COMPLETED');
    expect(recoveredJob?.workerId).toBe('worker-recovery');
  });

  it('dispatches committed outbox events from disk via a separate background process', async () => {
    // Insert 2 events in the main process
    await outbox.insertEvent({
      eventType: 'repo.indexed',
      workspaceId: 'ws-proc-test',
      aggregateType: 'repo',
      aggregateId: 'r-1',
      payload: { files: 120 },
    });
    await outbox.insertEvent({
      eventType: 'repo.indexed',
      workspaceId: 'ws-proc-test',
      aggregateType: 'repo',
      aggregateId: 'r-1',
      payload: { files: 121 },
    });

    expect(await outbox.getDepth()).toBe(2);

    // Launch background outbox dispatch process
    const res = await spawnRunner(['outbox-dispatch', dbPath]);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('DISPATCHED:2');

    // Outbox is now drained
    expect(await outbox.getDepth()).toBe(0);
  });
});
