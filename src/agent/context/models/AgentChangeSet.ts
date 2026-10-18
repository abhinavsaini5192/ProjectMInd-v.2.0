export interface AgentChangeSet {
  readonly addedResources: readonly string[];
  readonly modifiedResources: readonly string[];
  readonly deletedResources: readonly string[];
  readonly renamedResources: readonly { readonly oldPath: string; readonly newPath: string }[];
  readonly movedResources: readonly { readonly oldPath: string; readonly newPath: string }[];
  readonly changedSymbols: readonly string[];
  readonly changedApis: readonly string[];
  readonly changedConfiguration: readonly string[];
}

export function createEmptyChangeSet(): AgentChangeSet {
  return {
    addedResources: [],
    modifiedResources: [],
    deletedResources: [],
    renamedResources: [],
    movedResources: [],
    changedSymbols: [],
    changedApis: [],
    changedConfiguration: [],
  };
}
