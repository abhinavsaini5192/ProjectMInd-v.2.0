import { WorkspaceService } from '../services/WorkspaceService.js';
import { RegistryService } from '../services/RegistryService.js';
import { HealthService } from '../services/HealthService.js';
import { ConfigurationService } from '../services/ConfigurationService.js';
import { LifecycleService } from '../services/LifecycleService.js';

/**
 * The WorkspaceAPI is the ONLY public interface for ProjectMind runtime modules.
 * No runtime component should instantiate or import Workspace Core classes directly.
 */
export class WorkspaceAPI {
  constructor(
    public readonly workspace: WorkspaceService,
    public readonly registry: RegistryService,
    public readonly health: HealthService,
    public readonly config: ConfigurationService,
    public readonly lifecycle: LifecycleService
  ) {}
}

export const IWorkspaceAPIToken = Symbol('WorkspaceAPI');
