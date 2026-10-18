import type { ContextFeature } from './ContextFeature.js';
import type { ContextResource } from './ContextResource.js';
import type { ContextWarning } from './ContextWarning.js';
import type { ContextCompleteness } from './ContextCompleteness.js';
import type { ContextFreshness } from './ContextFreshness.js';
import type { ContextVersion } from './ContextVersion.js';
import type { ContextAllocation } from './ContextAllocation.js';
import type { TaskUnderstanding } from './TaskUnderstanding.js';
import type { ContextQuality } from './ContextQuality.js';
import type { ContextExclusion } from './ContextCandidate.js';

export interface SourceFragment {
  readonly path: string;
  readonly symbol?: string | undefined;
  readonly fragment: string;
  readonly startLine?: number | undefined;
  readonly endLine?: number | undefined;
}

export interface ContextPackage {
  packageId: string;
  workspaceId?: string | undefined;
  projectId?: string | undefined;
  repositoryId?: string | undefined;
  generatedAt: number;
  task: {
    text: string;
    intent?: Record<string, any> | undefined;
  };
  taskUnderstanding?: TaskUnderstanding | undefined;
  features: ContextFeature[];
  resources: ContextResource[];
  architecture?: Record<string, any> | undefined;
  behavior: any[];
  dependencies: any[];
  tests: any[];
  health?: Record<string, any> | undefined;
  impact?: Record<string, any> | undefined;
  history: any[];
  verificationContext?: any[] | undefined;
  sourceFragments?: SourceFragment[] | undefined;
  warnings: ContextWarning[];
  selectionReasons: Record<string, string>;
  exclusions?: ContextExclusion[] | undefined;
  quality?: ContextQuality | undefined;
  completeness: ContextCompleteness;
  freshness: ContextFreshness;
  estimatedTokens: number;
  version: ContextVersion;
  allocation?: ContextAllocation | undefined;
  compiledPromptText?: string | undefined;
}
