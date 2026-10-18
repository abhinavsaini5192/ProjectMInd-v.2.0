import { FileSharedCoordinationBackend } from '../../../dist/distributed/coordination/FileSharedCoordinationBackend.js';
import { DistributedLockManager } from '../../../dist/distributed/locking/DistributedLockManager.js';
import { DistributedServiceDiscovery } from '../../../dist/distributed/discovery/DistributedServiceDiscovery.js';

const [action, storageDir, instanceId, ...args] = process.argv.slice(2);

const backend = new FileSharedCoordinationBackend(storageDir);

async function main() {
  if (action === 'lock') {
    const [lockKey, ttlStr, holdStr, waitTimeoutStr] = args;
    const ttlMs = parseInt(ttlStr || '3000', 10);
    const holdMs = parseInt(holdStr || '1000', 10);
    const waitTimeoutMs = parseInt(waitTimeoutStr || '500', 10);

    const lockManager = new DistributedLockManager(backend, instanceId);

    const result = await lockManager.acquire(lockKey, {
      ttlMs,
      waitTimeoutMs,
      retryIntervalMs: 50,
    });

    if (!result.success || !result.lock) {
      process.stdout.write(`FAILED\n`);
      await lockManager.close();
      await backend.close();
      process.exit(1);
    }

    const lock = result.lock;
    process.stdout.write(`ACQUIRED:${lock.fencingToken}\n`);

    if (holdMs > 0) {
      await new Promise((r) => setTimeout(r, holdMs));
    }

    const released = await lockManager.release(lock);
    process.stdout.write(`RELEASED:${released}\n`);
    await lockManager.close();
    await backend.close();
    process.exit(0);
  } else if (action === 'register') {
    const [role, holdMsStr] = args;
    const holdMs = parseInt(holdMsStr || '1000', 10);

    const serviceRole = role ? role.toUpperCase() : 'WORKER';
    const discovery = new DistributedServiceDiscovery(backend, {
      instanceId,
      role: serviceRole,
      heartbeatIntervalMs: 200,
      staleThresholdMs: 2500,
    });

    await discovery.register();
    process.stdout.write(`REGISTERED:${instanceId}\n`);

    if (holdMs > 0) {
      await new Promise((r) => setTimeout(r, holdMs));
    }

    await discovery.deregister();
    process.stdout.write(`STOPPED:${instanceId}\n`);
    await discovery.close();
    await backend.close();
    process.exit(0);
  } else {
    process.stderr.write(`Unknown action: ${action}\n`);
    await backend.close();
    process.exit(2);
  }
}

main().catch(async (err) => {
  process.stderr.write(`ERROR:${err?.message}\n`);
  try {
    await backend.close();
  } catch {}
  process.exit(1);
});
