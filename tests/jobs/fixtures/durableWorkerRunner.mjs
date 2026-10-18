import Database from 'better-sqlite3';
import { DurableJobQueue } from '../../../dist/jobs/queue/DurableJobQueue.js';
import { SqliteJobRepository } from '../../../dist/jobs/persistence/SqliteJobRepository.js';
import { SqliteTransactionalOutbox } from '../../../dist/jobs/events/outbox/SqliteTransactionalOutbox.js';

const [action, dbPath, ...args] = process.argv.slice(2);
const db = new Database(dbPath, { timeout: 10000 });
db.pragma('journal_mode = WAL');

async function main() {
  if (action === 'claim-and-run') {
    const [workerId, holdMsStr, crashStr] = args;
    const holdMs = parseInt(holdMsStr || '200', 10);
    const shouldCrash = crashStr === 'crash';

    const queue = new DurableJobQueue(db);
    const repo = new SqliteJobRepository(db);

    const msg = await queue.dequeue(1000); // 1000ms visibility timeout
    if (!msg) {
      process.stdout.write(`EMPTY\n`);
      db.close();
      process.exit(0);
    }

    process.stdout.write(`CLAIMED:${msg.jobId}:${workerId}\n`);

    // Transition job to RUNNING
    await repo.update(msg.jobId, {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      workerId,
    });

    if (shouldCrash) {
      // Abruptly exit without acknowledging queue or releasing job
      process.stderr.write(`SIMULATED_CRASH:${workerId}\n`);
      db.close();
      process.exit(99);
    }

    if (holdMs > 0) {
      await new Promise((r) => setTimeout(r, holdMs));
    }

    // Complete job
    await repo.update(msg.jobId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
      result: { success: true, processedBy: workerId },
    });

    await queue.acknowledge(msg.receiptHandle);
    process.stdout.write(`COMPLETED:${msg.jobId}:${workerId}\n`);
    db.close();
    process.exit(0);
  } else if (action === 'outbox-dispatch') {
    const outbox = new SqliteTransactionalOutbox(db);
    const events = await outbox.fetchPendingEvents(10);
    let count = 0;

    for (const ev of events) {
      await outbox.markDispatched(ev.eventId);
      count++;
    }

    process.stdout.write(`DISPATCHED:${count}\n`);
    db.close();
    process.exit(0);
  } else {
    process.stderr.write(`Unknown action: ${action}\n`);
    db.close();
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`ERROR:${err?.message}\n`);
  try { db.close(); } catch {}
  process.exit(1);
});
