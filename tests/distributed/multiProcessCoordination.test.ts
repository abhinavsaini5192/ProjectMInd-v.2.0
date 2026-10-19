import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { FileSharedCoordinationBackend } from '../../src/distributed/coordination/FileSharedCoordinationBackend.js';
import { DistributedServiceDiscovery } from '../../src/distributed/discovery/DistributedServiceDiscovery.js';

const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/coordinationWorker.mjs');

interface ProcessRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function spawnWorker(args: string[]): {
  child: ReturnType<typeof spawn>;
  waitForOutput: (pattern: string, timeoutMs?: number) => Promise<string>;
  resultPromise: Promise<ProcessRunResult>;
} {
  const child = spawn(process.execPath, [FIXTURE_PATH, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const resultPromise = new Promise<ProcessRunResult>((resolve) => {
    child.on('error', (err) => {
      resolve({ code: 1, stdout, stderr: err?.message || String(err) });
    });
    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });

  const waitForOutput = (pattern: string, timeoutMs = 6000): Promise<string> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(checker);
        reject(new Error(`Timeout waiting for "${pattern}". Stdout: ${stdout}, Stderr: ${stderr}`));
      }, timeoutMs);

      const checker = setInterval(() => {
        if (stdout.includes(pattern)) {
          clearTimeout(timer);
          clearInterval(checker);
          resolve(stdout);
        }
      }, 50);
    });
  };

  return { child, waitForOutput, resultPromise };
}

describe('Multi-Process Coordination & Discovery Integration', { timeout: 20000 }, () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `pm-coord-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    await fs.promises.mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    } catch {}
  });

  it('enforces mutual exclusion across two separate OS processes', async () => {
    const lockKey = 'workspace:sync:repo-xyz';

    // Process A: acquires lock for 600ms with TTL 4000ms
    const procA = spawnWorker(['lock', tmpDir, 'proc-worker-A', lockKey, '4000', '600', '500']);
    await procA.waitForOutput('ACQUIRED:');

    // While Process A holds the lock, Process B attempts acquisition with short timeout (150ms)
    const procB = spawnWorker(['lock', tmpDir, 'proc-worker-B', lockKey, '4000', '100', '150']);
    const resB = await procB.resultPromise;

    // Process B must have failed to acquire due to contention
    expect(resB.code).toBe(1);
    expect(resB.stdout).toContain('FAILED');

    // Process A completes gracefully and releases
    const resA = await procA.resultPromise;
    expect(resA.code).toBe(0);
    expect(resA.stdout).toContain('RELEASED:true');
  });

  it('ensures monotonic fencing tokens across sequential lock owners in separate processes', async () => {
    const lockKey = 'migration:schema:users';

    // Process A acquires and quickly releases (hold 50ms)
    const procA = spawnWorker(['lock', tmpDir, 'proc-worker-A', lockKey, '3000', '50', '1000']);
    const resA = await procA.resultPromise;
    expect(resA.code).toBe(0);
    const tokenAMatch = resA.stdout.match(/ACQUIRED:(\d+)/);
    expect(tokenAMatch).not.toBeNull();
    const tokenA = parseInt(tokenAMatch![1], 10);

    // Process B acquires next (hold 50ms)
    const procB = spawnWorker(['lock', tmpDir, 'proc-worker-B', lockKey, '3000', '50', '1000']);
    const resB = await procB.resultPromise;
    expect(resB.code).toBe(0);
    const tokenBMatch = resB.stdout.match(/ACQUIRED:(\d+)/);
    expect(tokenBMatch).not.toBeNull();
    const tokenB = parseInt(tokenBMatch![1], 10);

    // Token B must be strictly monotonically greater than Token A
    expect(tokenB).toBeGreaterThan(tokenA);
  });

  it('recovers safely when a lock holder crashes without releasing (lease expiration)', async () => {
    const lockKey = 'critical:export:job';

    // Process A acquires lock with very short TTL (500ms) and is set to hold for 5000ms
    const procA = spawnWorker(['lock', tmpDir, 'proc-worker-A', lockKey, '500', '5000', '500']);
    await procA.waitForOutput('ACQUIRED:');

    // Abruptly kill Process A to simulate sudden crash / SIGKILL
    procA.child.kill();
    await procA.resultPromise;

    // Wait for the 500ms TTL lease to elapse
    await new Promise((r) => setTimeout(r, 600));

    // Process B should now be able to reclaim the expired lock
    const procB = spawnWorker(['lock', tmpDir, 'proc-worker-B', lockKey, '3000', '50', '1000']);
    const resB = await procB.resultPromise;

    expect(resB.code).toBe(0);
    expect(resB.stdout).toContain('ACQUIRED:');
    expect(resB.stdout).toContain('RELEASED:true');
  });

  it('discovers and observes peer instances across separate processes', async () => {
    const backend = new FileSharedCoordinationBackend(tmpDir);
    const discoveryInTest = new DistributedServiceDiscovery(backend, {
      instanceId: 'test-runner-node',
      role: 'API',
      heartbeatIntervalMs: 150,
      staleThresholdMs: 1500,
    });
    await discoveryInTest.register();

    // Spawn Worker Process as role 'worker' holding for 800ms
    const procWorker = spawnWorker(['register', tmpDir, 'worker-instance-99', 'worker', '800']);
    await procWorker.waitForOutput('REGISTERED:worker-instance-99');

    // Query active instances from test runner process
    const activeInstances = await discoveryInTest.getActiveInstances();
    const foundWorker = activeInstances.find((i) => i.instanceId === 'worker-instance-99');

    expect(foundWorker).toBeDefined();
    expect(foundWorker?.role).toBe('WORKER');
    expect(foundWorker?.state).toBe('READY');

    // Wait for worker process to cleanly shut down
    const resWorker = await procWorker.resultPromise;
    expect(resWorker.code).toBe(0);
    expect(resWorker.stdout).toContain('STOPPED:worker-instance-99');

    // After shutdown, worker instance is marked STOPPED or removed
    const updatedInstances = await discoveryInTest.getActiveInstances();
    const stoppedWorker = updatedInstances.find((i) => i.instanceId === 'worker-instance-99');
    expect(stoppedWorker === undefined || stoppedWorker.state === 'STOPPED').toBe(true);

    await discoveryInTest.deregister();
    await discoveryInTest.close();
    await backend.close();
  });
});
