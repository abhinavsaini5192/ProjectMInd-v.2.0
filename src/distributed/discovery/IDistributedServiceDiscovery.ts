import type { InstanceRecord } from '../models/InstanceRecord.js';

export interface IDistributedServiceDiscovery {
  /**
   * Registers the local instance with the cluster.
   */
  register(capabilities?: readonly string[], metadata?: Record<string, unknown>): Promise<InstanceRecord>;

  /**
   * Sends a heartbeat updating the instance's last seen timestamp.
   */
  heartbeat(): Promise<boolean>;

  /**
   * Deregisters the local instance during graceful shutdown.
   */
  deregister(): Promise<boolean>;

  /**
   * Retrieves all currently active and non-stale instances in the cluster.
   */
  getActiveInstances(): Promise<readonly InstanceRecord[]>;

  /**
   * Retrieves an instance record by its instance ID.
   */
  getInstance(instanceId: string): Promise<InstanceRecord | null>;

  /**
   * Checks whether the local instance is the elected cluster leader.
   */
  isLeader(): Promise<boolean>;

  /**
   * Returns the instance ID of the current cluster leader, or null if unassigned.
   */
  getLeader(): Promise<string | null>;

  /**
   * Cleans up background heartbeat timers and connections.
   */
  close(): Promise<void>;
}

export const IDistributedServiceDiscoveryToken = Symbol.for('IDistributedServiceDiscovery');
