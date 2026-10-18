export const TaskDependencyType = {
  DEPENDS_ON: 'DEPENDS_ON',
  BLOCKS: 'BLOCKS',
  REQUIRES: 'REQUIRES',
  FOLLOWS: 'FOLLOWS',
  PARALLEL_WITH: 'PARALLEL_WITH',
  VERIFIES: 'VERIFIES',
  VALIDATES: 'VALIDATES',
  PRODUCES: 'PRODUCES',
  CONSUMES: 'CONSUMES',
} as const;

export type TaskDependencyType = (typeof TaskDependencyType)[keyof typeof TaskDependencyType];

export const TaskDependencyTypes = Object.values(TaskDependencyType);
