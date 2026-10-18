export interface JobProgress {
  readonly completed: number;
  readonly total: number;
  readonly percentage: number;
  readonly message?: string | undefined;
  readonly updatedAt: string;
}

export function createJobProgress(completed: number, total: number, message?: string): JobProgress {
  const boundedTotal = Math.max(1, total);
  const boundedCompleted = Math.min(boundedTotal, Math.max(0, completed));
  const percentage = Math.round((boundedCompleted / boundedTotal) * 100);

  return {
    completed: boundedCompleted,
    total: boundedTotal,
    percentage,
    message,
    updatedAt: new Date().toISOString(),
  };
}
