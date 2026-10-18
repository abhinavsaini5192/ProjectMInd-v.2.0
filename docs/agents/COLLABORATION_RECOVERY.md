# Collaboration Recovery & Disconnect Management

Distributed agent environments are subject to transient network failures, agent crashes, and expired leases. The collaboration layer guarantees resilient state preservation and recovery.

---

## 1. Agent Disconnect Lifecycle

When an agent becomes unresponsive or closes its communication channel:
1. `handleAgentDisconnect(sessionId, agentId)` is invoked.
2. Participant status is updated to `DISCONNECTED` with a timestamp.
3. Tasks owned by the disconnected agent are transitioned to `BLOCKED`.
4. Work is **never** falsely declared completed.
5. All observations, intermediate artifacts, and partial notes are preserved in the collaboration store.

```typescript
// Participant status transitions:
ONLINE ──► IDLE ──► BUSY ──► DISCONNECTED ──► RECONNECTING ──► REMOVED
```

---

## 2. Stale Reservation Cleanup

Reservations maintain a TTL (Time To Live). When an agent disconnects or stops sending heartbeats:
- The reservation is not silently deleted; it transitions to `STALE`.
- Stale status preserves the audit trail that Agent A was touching that file.
- `ResourceReservationService.cleanupStaleReservations` marks expired reservations `STALE`.
- Other agents attempting to reserve the resource can petition the coordinator to release or reassign the reservation.

---

## 3. Collaboration Checkpoints & Replay

To guard against catastrophic failure or unresolvable multi-agent conflicts, ProjectMind creates atomic `CollaborationCheckpoint` records.

A checkpoint captures:
- Session status and version token.
- Active participants, presence states, and roles.
- Task assignments and ownership mappings.
- Active and pending resource reservations.
- Open conflicts and resolution states.
- Project memory version token.

### Recovery Workflow
1. Coordinator requests recovery: `recoverFromCheckpoint(sessionId, checkpointId)`.
2. The collaboration state is restored to the snapshot point.
3. Expired reservations are marked `STALE`.
4. Disconnected agents are set to `DISCONNECTED`.
5. Event `collaboration:recovered` is emitted.
6. The team resumes coordinated execution safely.
