import type { ServiceRole } from './DistributedConfig.js';

export type InstanceState =
  | 'STARTING'
  | 'INITIALIZING'
  | 'READY'
  | 'DRAINING'
  | 'STOPPED'
  | 'FAILED';

export interface InstanceRecord {
  /** Unique ID of the service instance */
  readonly instanceId: string;
  /** Service role (API, WORKER, COORDINATOR, HYBRID) */
  readonly role: ServiceRole;
  /** Hostname or IP of the running machine/container */
  readonly hostname: string;
  /** Process ID of the instance */
  readonly pid: number;
  /** Network address or endpoint URL if applicable */
  readonly endpoint?: string | undefined;
  /** Current lifecycle status */
  readonly state: InstanceState;
  /** Subsystem capabilities provided by this instance */
  readonly capabilities: readonly string[];
  /** Monotonically increasing fencing/generation counter */
  readonly fencingToken: number;
  /** Timestamp when the instance registered */
  readonly registeredAt: number;
  /** Timestamp of the most recent heartbeat */
  readonly lastHeartbeatAt: number;
  /** Software version */
  readonly version: string;
  /** Custom instance metadata */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
