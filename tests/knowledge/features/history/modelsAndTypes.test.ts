import { describe, it, expect } from 'vitest';
import {
  isFeatureEvolutionType,
  FEATURE_EVOLUTION_TYPES,
  isFeatureHistoryEventType,
  FEATURE_HISTORY_EVENT_TYPES,
  isFeatureTrendType,
  FEATURE_TREND_TYPES,
  createHistoryConfidence,
  FeatureHistoryError,
  FeatureEvolutionError,
  FeatureHistoryValidationError,
  FeatureHistoryConflictError,
  InvalidHistoryReferenceError,
} from '../../../../src/knowledge/features/history/index.js';

describe('Feature History Models and Types', () => {
  it('validates all feature evolution types', () => {
    expect(isFeatureEvolutionType('CREATION')).toBe(true);
    expect(isFeatureEvolutionType('DISCOVERY')).toBe(true);
    expect(isFeatureEvolutionType('STRUCTURAL')).toBe(true);
    expect(isFeatureEvolutionType('BEHAVIORAL')).toBe(true);
    expect(isFeatureEvolutionType('DEPENDENCY')).toBe(true);
    expect(isFeatureEvolutionType('HEALTH')).toBe(true);
    expect(isFeatureEvolutionType('RISK')).toBe(true);
    expect(isFeatureEvolutionType('STABILIZATION')).toBe(true);
    expect(isFeatureEvolutionType('REGRESSION')).toBe(true);
    expect(isFeatureEvolutionType('NON_EXISTENT')).toBe(false);
    expect(FEATURE_EVOLUTION_TYPES.length).toBeGreaterThanOrEqual(18);
  });

  it('validates all feature history event types', () => {
    expect(isFeatureHistoryEventType('FEATURE_CREATED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_DISCOVERED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_EXPANDED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_HEALTH_CHANGED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_RISK_CHANGED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_CRITICALITY_CHANGED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_DEPRECATED')).toBe(true);
    expect(isFeatureHistoryEventType('FEATURE_STABILIZED')).toBe(true);
    expect(isFeatureHistoryEventType('TECHNICAL_CHANGE')).toBe(true);
    expect(isFeatureHistoryEventType('INVALID_EVENT_TYPE')).toBe(false);
    expect(FEATURE_HISTORY_EVENT_TYPES.length).toBeGreaterThanOrEqual(28);
  });

  it('validates all trend types', () => {
    expect(isFeatureTrendType('GROWING')).toBe(true);
    expect(isFeatureTrendType('SHRINKING')).toBe(true);
    expect(isFeatureTrendType('STABLE')).toBe(true);
    expect(isFeatureTrendType('IMPROVING_HEALTH')).toBe(true);
    expect(isFeatureTrendType('DECLINING_HEALTH')).toBe(true);
    expect(isFeatureTrendType('INCREASING_RISK')).toBe(true);
    expect(isFeatureTrendType('DECLINING_RISK')).toBe(true);
    expect(isFeatureTrendType('INCREASING_CRITICALITY')).toBe(true);
    expect(isFeatureTrendType('UNKNOWN')).toBe(true);
    expect(isFeatureTrendType('INVALID_TREND')).toBe(false);
    expect(FEATURE_TREND_TYPES.length).toBeGreaterThanOrEqual(14);
  });

  it('constructs confidence levels and clamps score', () => {
    const conf1 = createHistoryConfidence('VERY_HIGH', 0.95, ['Reason 1']);
    expect(conf1.level).toBe('VERY_HIGH');
    expect(conf1.score).toBe(0.95);
    expect(conf1.reasons).toEqual(['Reason 1']);

    const conf2 = createHistoryConfidence('LOW', 1.5);
    expect(conf2.score).toBe(1.0);

    const conf3 = createHistoryConfidence('LOW', -0.5);
    expect(conf3.score).toBe(0.0);
  });

  it('instantiates all custom error types with correct names', () => {
    const err1 = new FeatureHistoryError('base error');
    expect(err1.name).toBe('FeatureHistoryError');
    expect(err1 instanceof Error).toBe(true);

    const err2 = new FeatureEvolutionError('evolution error');
    expect(err2.name).toBe('FeatureEvolutionError');
    expect(err2 instanceof FeatureHistoryError).toBe(true);

    const err3 = new FeatureHistoryValidationError('validation error');
    expect(err3.name).toBe('FeatureHistoryValidationError');

    const err4 = new FeatureHistoryConflictError('conflict error');
    expect(err4.name).toBe('FeatureHistoryConflictError');

    const err5 = new InvalidHistoryReferenceError('invalid ref error');
    expect(err5.name).toBe('InvalidHistoryReferenceError');
  });
});
