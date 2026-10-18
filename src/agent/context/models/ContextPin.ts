export type ContextPinType = 'FEATURE' | 'RESOURCE' | 'SECTION';

export interface ContextPin {
  readonly pinId: string;
  readonly contextSessionId: string;
  readonly type: ContextPinType;
  readonly targetId: string;
  readonly pinnedAt: Date;
  readonly pinnedBy: string;
  readonly reason?: string | undefined;
}

export interface CreatePinParams {
  readonly contextSessionId: string;
  readonly type: ContextPinType;
  readonly targetId: string;
  readonly pinnedBy?: string | undefined;
  readonly reason?: string | undefined;
}
