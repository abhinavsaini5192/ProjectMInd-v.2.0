export class AnalyticsError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code: string = 'ANALYTICS_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MetricNotFoundError extends AnalyticsError {
  constructor(metricId: string) {
    super(`Metric not found: '${metricId}'`, 'METRIC_NOT_FOUND', { metricId });
  }
}

export class InvalidMetricDefinitionError extends AnalyticsError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_METRIC_DEFINITION', details);
  }
}

export class InvalidTimeWindowError extends AnalyticsError {
  constructor(message: string, details?: unknown) {
    super(message, 'INVALID_TIME_WINDOW', details);
  }
}

export class AnalyticsScopeUnauthorizedError extends AnalyticsError {
  constructor(message: string, details?: unknown) {
    super(message, 'SCOPE_UNAUTHORIZED', details);
  }
}

export class ReportNotFoundError extends AnalyticsError {
  constructor(reportId: string) {
    super(`Report not found: '${reportId}'`, 'REPORT_NOT_FOUND', { reportId });
  }
}

export class SnapshotNotFoundError extends AnalyticsError {
  constructor(snapshotId: string) {
    super(`Snapshot not found: '${snapshotId}'`, 'SNAPSHOT_NOT_FOUND', { snapshotId });
  }
}

export class QueryTimeoutError extends AnalyticsError {
  constructor(message: string, timeoutMs: number) {
    super(message, 'QUERY_TIMEOUT', { timeoutMs });
  }
}

export class IncompatibleMetricVersionError extends AnalyticsError {
  constructor(metricId: string, currentVersion: string, requestedVersion: string) {
    super(
      `Incompatible definition version for metric '${metricId}'. Registered: '${currentVersion}', Requested: '${requestedVersion}'`,
      'INCOMPATIBLE_METRIC_VERSION',
      { metricId, currentVersion, requestedVersion }
    );
  }
}
