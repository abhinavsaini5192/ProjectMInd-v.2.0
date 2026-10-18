import type { IAgentAdapter } from '../interfaces/IAgentAdapter.js';

export interface IdeEditorState {
  readonly activeFilePath?: string | undefined;
  readonly cursorLine?: number | undefined;
  readonly cursorColumn?: number | undefined;
  readonly selectionText?: string | undefined;
  readonly openFiles?: readonly string[] | undefined;
  readonly dirtyFiles?: readonly string[] | undefined;
}

export interface IIdeAgentAdapter extends IAgentAdapter {
  getActiveEditorState?(): IdeEditorState | undefined;
  setActiveEditorState?(state: IdeEditorState): void;
}
