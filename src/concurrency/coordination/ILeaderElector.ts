export interface ILeaderElector {
  readonly scope: string;
  readonly instanceId: string;

  /**
   * Attempts to acquire leadership for this instance.
   */
  tryAcquireLeadership(): Promise<boolean>;

  /**
   * Renews leadership heartbeat lease.
   */
  renewLeadership(): Promise<boolean>;

  /**
   * Voluntarily relinquishes leadership.
   */
  stepDown(): Promise<void>;

  /**
   * Returns true if this instance currently holds valid leadership.
   */
  isLeader(): boolean;

  /**
   * Gets current leader instance ID if active.
   */
  getLeader(): Promise<string | null>;

  /**
   * Starts background heartbeat / renewal loop.
   */
  start(): void;

  /**
   * Stops heartbeat loop and steps down.
   */
  stop(): Promise<void>;
}
