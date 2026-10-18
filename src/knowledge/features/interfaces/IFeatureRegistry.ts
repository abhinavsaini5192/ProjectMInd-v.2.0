import { Feature } from '../models/Feature.js';
import { IFeature } from '../models/IFeature.js';
import { FeatureId } from '../models/FeatureId.js';
import { FeatureType } from '../models/FeatureType.js';
import { FeatureStatus } from '../models/FeatureStatus.js';

export interface IFeatureRegistry {
  register(feature: Feature | IFeature): Promise<void>;
  get(id: FeatureId): Promise<Feature | null>;
  has(id: FeatureId): Promise<boolean>;
  update(feature: Feature): Promise<void>;
  remove(id: FeatureId): Promise<boolean>;
  list(repositoryId?: string): Promise<Feature[]>;
  findByName(name: string, repositoryId?: string): Promise<Feature[]>;
  findByRepository(repositoryId: string): Promise<Feature[]>;
  findByReference(resourceId: string): Promise<Feature[]>;
  findByType(type: FeatureType, repositoryId?: string): Promise<Feature[]>;
  findByStatus(status: FeatureStatus, repositoryId?: string): Promise<Feature[]>;
}
