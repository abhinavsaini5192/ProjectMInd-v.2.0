import { describe, it, expect } from 'vitest';
import {
  isValidKnowledgeUpdateTransition,
  type KnowledgeUpdateStatus,
} from '../../../src/knowledge/update/models/KnowledgeUpdateStatus.js';

describe('KnowledgeUpdate Models & State Machine', () => {
  it('validates canonical lifecycle transitions from RECEIVED to APPLIED', () => {
    expect(isValidKnowledgeUpdateTransition('RECEIVED', 'VALIDATED')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('VALIDATED', 'PLANNED')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PLANNED', 'PROCESSING')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PROCESSING', 'APPLIED')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PROCESSING', 'PARTIALLY_APPLIED')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PROCESSING', 'CONFLICTED')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PROCESSING', 'FAILED')).toBe(true);
  });

  it('rejects invalid or backwards state transitions', () => {
    expect(isValidKnowledgeUpdateTransition('APPLIED', 'RECEIVED')).toBe(false);
    expect(isValidKnowledgeUpdateTransition('APPLIED', 'PROCESSING')).toBe(false);
    expect(isValidKnowledgeUpdateTransition('RECEIVED', 'APPLIED')).toBe(false);
    expect(isValidKnowledgeUpdateTransition('SUPERSEDED', 'PROCESSING')).toBe(false);
    expect(isValidKnowledgeUpdateTransition('REJECTED', 'APPLIED')).toBe(false);
  });

  it('allows retry and reprocessing transitions', () => {
    expect(isValidKnowledgeUpdateTransition('FAILED', 'RETRY_PENDING')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('PARTIALLY_APPLIED', 'RETRY_PENDING')).toBe(true);
    expect(isValidKnowledgeUpdateTransition('RETRY_PENDING', 'PROCESSING')).toBe(true);
  });

  it('allows reflexive same-state transitions', () => {
    const statuses: KnowledgeUpdateStatus[] = [
      'RECEIVED',
      'VALIDATED',
      'PLANNED',
      'PROCESSING',
      'APPLIED',
      'PARTIALLY_APPLIED',
      'CONFLICTED',
      'FAILED',
      'RETRY_PENDING',
      'SUPERSEDED',
      'REJECTED',
    ];
    for (const status of statuses) {
      expect(isValidKnowledgeUpdateTransition(status, status)).toBe(true);
    }
  });
});
