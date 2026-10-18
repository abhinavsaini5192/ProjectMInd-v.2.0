import { describe, it, expect } from 'vitest';
import { PersistentAuditStore } from '../../src/storage/repositories/PersistentAuditStore';
import { PersistentKnowledgeUpdateRepository } from '../../src/storage/repositories/PersistentKnowledgeUpdateRepository';
import { PersistentVerificationStore } from '../../src/storage/repositories/PersistentVerificationStore';
import { PersistentObservationStore } from '../../src/storage/repositories/PersistentObservationStore';
import { StorageCoreError } from '../../src/storage/types/StorageErrors';
import { AuditEvent } from '../../src/security/models/AuditEvent';
import { KnowledgeUpdate } from '../../src/knowledge/update/models/KnowledgeUpdate';
import { VerificationRecord } from '../../src/verification/models/VerificationRecord';

describe('Phase 8.4 - Persistent Domain Repositories', () => {
  describe('PersistentAuditStore', () => {
    it('should save audit events with cryptographic SHA-256 chaining', async () => {
      const auditStore = new PersistentAuditStore();

      const event1: AuditEvent = {
        eventId: 'aud-1',
        timestamp: new Date().toISOString(),
        eventType: 'AUTHORIZATION_ALLOW',
        principalId: 'user-1',
        resourceId: 'res-1',
        action: 'READ',
        result: 'SUCCESS',
        workspaceId: 'ws-1',
      };

      const event2: AuditEvent = {
        eventId: 'aud-2',
        timestamp: new Date().toISOString(),
        eventType: 'AUTHORIZATION_DENIAL',
        principalId: 'user-2',
        resourceId: 'res-1',
        action: 'WRITE',
        result: 'FAILURE',
        workspaceId: 'ws-1',
      };

      const r1 = await auditStore.saveEvent(event1);
      const r2 = await auditStore.saveEvent(event2);

      expect(r1.checksum).toHaveLength(64);
      expect(r2.previousChecksum).toBe(r1.checksum);

      const verification = await auditStore.verifyIntegrity();
      expect(verification.isTamperFree).toBe(true);
      expect(verification.recordsChecked).toBe(2);
    });

    it('should refuse deletion of audit records by policy', () => {
      const auditStore = new PersistentAuditStore();
      expect(() => auditStore.deleteEvent()).toThrow(StorageCoreError);
    });

    it('should scrub credentials and secrets from persisted audit events', async () => {
      const auditStore = new PersistentAuditStore();

      const sensitiveEvent: AuditEvent = {
        eventId: 'aud-sensitive',
        timestamp: new Date().toISOString(),
        eventType: 'CONFIG_CHANGED',
        principalId: 'admin',
        action: 'UPDATE',
        result: 'SUCCESS',
        details: {
          apiKey: 'AIzaSySecretApiKey1234567890',
          password: 'SuperSecretPassword',
          normalConfig: 'safe_value',
        },
      };

      const saved = await auditStore.saveEvent(sensitiveEvent);
      expect(saved.event.details?.apiKey).toBe('[REDACTED]');
      expect(saved.event.details?.password).toBe('[REDACTED]');
      expect(saved.event.details?.normalConfig).toBe('safe_value');
    });
  });

  describe('PersistentKnowledgeUpdateRepository', () => {
    it('should persist and query knowledge updates with idempotency support', async () => {
      const repo = new PersistentKnowledgeUpdateRepository();

      const update: KnowledgeUpdate = {
        updateId: 'upd-1',
        repositoryId: 'repo-mind',
        idempotencyKey: 'idemp-token-123',
        source: 'EXECUTION_OBSERVATION',
        provenance: 'SYSTEM_OBSERVED',
        updateType: 'RESOURCE_CREATED',
        status: 'RECEIVED',
        affectedResources: [],
        affectedFeatures: [],
        affectedKnowledgeAreas: [],
        evidenceReferences: [],
        requestedAt: Date.now(),
        confidence: 1,
        retryCount: 0,
        metadata: {},
      };

      await repo.saveUpdate(update);

      const fetched = await repo.getUpdate('upd-1');
      expect(fetched?.updateId).toBe('upd-1');

      const byIdemp = await repo.getUpdateByIdempotencyKey('idemp-token-123');
      expect(byIdemp?.updateId).toBe('upd-1');

      const pending = await repo.getPendingUpdates('repo-mind');
      expect(pending).toHaveLength(1);
    });

    it('should persist knowledge versions preserving history and provenance', async () => {
      const repo = new PersistentKnowledgeUpdateRepository();

      await repo.saveVersion({
        versionId: 'v1',
        repositoryId: 'repo-mind',
        versionNumber: 1,
        sourceUpdateIds: [],
        affectedKnowledgeAreas: [],
        affectedResources: [],
        affectedFeatures: [],
        status: 'ACTIVE',
        completeness: 'COMPLETE',
        confidence: 1,
        metadata: {},
        createdAt: Date.now(),
      });

      await repo.saveVersion({
        versionId: 'v2',
        repositoryId: 'repo-mind',
        versionNumber: 2,
        sourceUpdateIds: [],
        affectedKnowledgeAreas: [],
        affectedResources: [],
        affectedFeatures: [],
        status: 'ACTIVE',
        completeness: 'COMPLETE',
        confidence: 1,
        metadata: {},
        createdAt: Date.now(),
      });

      const latest = await repo.getLatestVersion('repo-mind');
      expect(latest?.versionNumber).toBe(2);
      expect(latest?.versionId).toBe('v2');
    });
  });

  describe('PersistentVerificationStore', () => {
    it('should persist and query verification records by scope and status', async () => {
      const store = new PersistentVerificationStore();

      const record: VerificationRecord = {
        verificationId: 'ver-100',
        taskId: 'task-1',
        workspaceId: 'ws-1',
        repositoryId: 'repo-mind',
        status: 'PASSED',
        verificationType: 'TEST',
        source: 'TEST_RUNNER',
        provenance: {
          source: 'TEST_RUNNER',
          reportedBy: 'vitest',
          receivedAt: new Date().toISOString(),
          verificationLevel: 'SYSTEM_VERIFIED',
          trustLevel: 'TRUSTED',
        },
        confidence: 'CONFIRMED',
        repositoryState: {
          status: 'BOUND',
          commitId: 'c8c5eaa',
          branch: 'main',
        },
        scope: {
          scopeType: 'TASK',
          targetIds: ['file-1'],
          featureIds: ['feat-auth'],
        },
        summary: 'All unit tests passed',
        diagnostics: [],
        evidence: {
          summary: 'Unit test execution completed successfully',
        },
        receivedAt: new Date().toISOString(),
        metadata: {},
      };

      await store.saveVerification(record);

      const fetched = await store.getVerification('ver-100');
      expect(fetched?.verificationId).toBe('ver-100');

      const listByFeature = await store.listVerifications({ featureId: 'feat-auth' });
      expect(listByFeature).toHaveLength(1);

      const latest = await store.getLatestVerification('task-1');
      expect(latest?.verificationId).toBe('ver-100');
    });

    it('should record processed operation idempotency and timeline entries', async () => {
      const store = new PersistentVerificationStore();

      await store.recordProcessedOperation('op-555', 'ver-100');
      expect(await store.hasProcessedOperation('op-555')).toBe(true);
      expect(await store.hasProcessedOperation('op-other')).toBe(false);

      await store.recordTimelineEntry('task-1', {
        entryId: 'tl-1',
        verificationId: 'ver-100',
        timestamp: new Date().toISOString(),
        verificationType: 'TEST',
        status: 'PASSED',
        source: 'TEST_RUNNER',
        provenance: {
          source: 'TEST_RUNNER',
          reportedBy: 'vitest',
          receivedAt: new Date().toISOString(),
          verificationLevel: 'SYSTEM_VERIFIED',
          trustLevel: 'TRUSTED',
        },
        summary: 'Started verification',
        repositoryState: {
          status: 'BOUND',
          commitId: 'c8c5eaa',
          branch: 'main',
        },
        causality: 'SEQUENTIAL',
      });

      const timeline = await store.getTimelineEntries('task-1');
      expect(timeline).toHaveLength(1);
      expect(timeline[0].verificationType).toBe('TEST');
    });
  });

  describe('PersistentObservationStore', () => {
    it('should save and list agent observations bounded by session and query', async () => {
      const store = new PersistentObservationStore();

      const obs: any = {
        observationId: 'obs-1',
        agentSessionId: 'sess-alpha',
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        timestamp: new Date().toISOString(),
        type: 'COMMAND_EXECUTION',
        status: 'RECEIVED',
        source: 'TOOL',
        payload: { command: 'git status' },
        confidence: 'VERIFIED',
        provenance: 'OBSERVED',
        orderingStatus: 'IN_ORDER',
        retention: 'HOT',
        metadata: {},
      };

      await store.saveObservation(obs);

      const retrieved = await store.getObservation('obs-1');
      expect(retrieved?.observationId).toBe('obs-1');

      const sessionObs = await store.listObservations({
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        agentSessionId: 'sess-alpha',
      });
      expect(sessionObs).toHaveLength(1);
      expect((sessionObs[0].payload as any).command).toBe('git status');
    });
  });
});
