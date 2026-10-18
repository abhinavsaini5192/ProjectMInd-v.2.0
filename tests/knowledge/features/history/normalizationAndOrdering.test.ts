import { describe, it, expect } from 'vitest';
import {
  FeatureHistoryNormalizer,
  FeatureEvolutionBuilder,
} from '../../../../src/knowledge/features/history/index.js';
import { HistoryTestHelper } from './HistoryTestHelper.js';

describe('Event Normalization, Ordering, and Evolution Episodes', () => {
  it('deterministically sorts events by knowledge version, timestamp, priority, and ID', () => {
    const t0 = 1000;
    const ev1 = HistoryTestHelper.createEvent('auth', {
      eventId: 'b_ev',
      eventType: 'FEATURE_MAPPING_ADDED',
      timestamp: t0,
      confidenceScore: 0.9,
    });
    const ev2 = HistoryTestHelper.createEvent('auth', {
      eventId: 'a_ev',
      eventType: 'FEATURE_CREATED', // Higher priority (10 vs 50)
      timestamp: t0,
      confidenceScore: 0.9,
    });
    const ev3 = HistoryTestHelper.createEvent('auth', {
      eventId: 'c_ev',
      eventType: 'FEATURE_CREATED',
      timestamp: t0 + 100,
    });

    const sorted = FeatureHistoryNormalizer.sortEvents([ev3, ev1, ev2]);
    expect(sorted[0]?.eventId).toBe('a_ev');
    expect(sorted[1]?.eventId).toBe('b_ev');
    expect(sorted[2]?.eventId).toBe('c_ev');
  });

  it('detects conflicting statuses at the same version', () => {
    const evDeprecated = HistoryTestHelper.createEvent('auth', {
      eventId: 'ev_dep',
      eventType: 'FEATURE_DEPRECATED',
      timestamp: 1000,
    });
    const evActive = HistoryTestHelper.createEvent('auth', {
      eventId: 'ev_act',
      eventType: 'FEATURE_REACTIVATED',
      timestamp: 1000,
    });

    const result = FeatureHistoryNormalizer.normalize('auth', [evDeprecated, evActive]);
    expect(result.events.length).toBe(2);
    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0]?.conflictType).toBe('CONTRADICTORY_STATUS');
    expect(result.conflicts[0]?.competingEvents).toContain('ev_dep');
    expect(result.conflicts[0]?.competingEvents).toContain('ev_act');
  });

  it('groups multiple correlated events into an evolution episode', () => {
    const t0 = 10000;
    const ev1 = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_MAPPING_ADDED',
      evolutionType: 'STRUCTURAL',
      timestamp: t0,
      dimensions: ['mapping'],
    });
    const ev2 = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_BEHAVIOR_ADDED',
      evolutionType: 'BEHAVIORAL',
      timestamp: t0 + 1000,
      dimensions: ['behavior'],
    });
    const ev3 = HistoryTestHelper.createEvent('auth', {
      eventType: 'FEATURE_HEALTH_CHANGED',
      evolutionType: 'HEALTH',
      timestamp: t0 + 2000,
      dimensions: ['health'],
    });

    const builder = new FeatureEvolutionBuilder();
    const episodes = builder.buildEvolutionEvents('auth', [ev1, ev2, ev3], {
      episodeWindowMs: 5000,
    });

    expect(episodes.length).toBe(1);
    expect(episodes[0]?.sourceEvents.length).toBe(3);
    expect(episodes[0]?.changedDimensions).toEqual(
      expect.arrayContaining(['mapping', 'behavior', 'health'])
    );
    expect(episodes[0]?.isSemantic).toBe(true);
  });

  it('distinguishes technical formatting changes from semantic evolution episodes', () => {
    const evFormatting = HistoryTestHelper.createEvent('auth', {
      eventId: 'ev_fmt',
      eventType: 'TECHNICAL_CHANGE',
      evolutionType: 'TECHNICAL',
      timestamp: 5000,
      dimensions: ['formatting'],
    });

    const builder = new FeatureEvolutionBuilder();
    const episodes = builder.buildEvolutionEvents('auth', [evFormatting]);

    expect(episodes.length).toBe(1);
    expect(episodes[0]?.isSemantic).toBe(false);
    expect(episodes[0]?.title).toContain('Technical update');
  });
});
