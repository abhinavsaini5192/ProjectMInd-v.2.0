import { IFeatureRegistry } from '../interfaces/IFeatureRegistry.js';
import { IFeatureRepository } from '../interfaces/IFeatureRepository.js';
import { Feature } from '../models/Feature.js';
import { IFeature } from '../models/IFeature.js';
import { FeatureId } from '../models/FeatureId.js';
import { FeatureType } from '../models/FeatureType.js';
import { FeatureStatus } from '../models/FeatureStatus.js';
import { DuplicateFeatureError } from '../errors/DuplicateFeatureError.js';
import { FeatureNotFoundError } from '../errors/FeatureNotFoundError.js';

export class FeatureRegistry implements IFeatureRegistry {
  private inMemoryFeatures = new Map<FeatureId, any>();
  private nameIndex = new Map<string, string>();
  private symbolIndex = new Map<string, string[]>();

  constructor(private repository?: IFeatureRepository) {}

  public registerSync(feature: any): void {
    if (this.inMemoryFeatures.has(feature.id)) {
      throw new DuplicateFeatureError(feature.id);
    }
    this.inMemoryFeatures.set(feature.id, feature);
    if (feature.name) {
      this.nameIndex.set(feature.name.toLowerCase(), feature.id);
    }
    const symbolIds = feature.symbolIds || feature.references?.filter((r: any) => r.resourceType === 'SYMBOL').map((r: any) => r.resourceId) || [];
    for (const symId of symbolIds) {
      if (!this.symbolIndex.has(symId)) {
        this.symbolIndex.set(symId, []);
      }
      const feats = this.symbolIndex.get(symId)!;
      if (!feats.includes(feature.id)) feats.push(feature.id);
    }
  }

  public async register(feature: Feature | IFeature): Promise<void> {
    this.registerSync(feature);
    if (this.repository) {
      await this.repository.create(feature as Feature);
    }
  }

  public getSync(id: FeatureId): any | undefined {
    return this.inMemoryFeatures.get(id);
  }

  public getByName(name: string): any | undefined {
    const id = this.nameIndex.get(name.toLowerCase());
    return id ? this.inMemoryFeatures.get(id) : undefined;
  }

  public getFeaturesForSymbol(symbolId: string): any[] {
    const ids = this.symbolIndex.get(symbolId) || [];
    return ids.map(id => this.inMemoryFeatures.get(id)!).filter(Boolean);
  }

  public getAll(): any[] {
    return Array.from(this.inMemoryFeatures.values());
  }

  public async get(id: FeatureId): Promise<Feature | null> {
    if (this.inMemoryFeatures.has(id)) {
      return this.inMemoryFeatures.get(id)!;
    }
    if (this.repository) {
      const feat = await this.repository.get(id);
      if (feat) {
        this.registerSync(feat);
      }
      return feat;
    }
    return null;
  }

  public async has(id: FeatureId): Promise<boolean> {
    if (this.inMemoryFeatures.has(id)) return true;
    if (this.repository) return this.repository.exists(id);
    return false;
  }

  public async update(feature: Feature): Promise<void> {
    if (!this.inMemoryFeatures.has(feature.id)) {
      throw new FeatureNotFoundError(feature.id);
    }
    this.inMemoryFeatures.set(feature.id, feature);
    if (feature.name) {
      this.nameIndex.set(feature.name.toLowerCase(), feature.id);
    }
    if (this.repository) {
      await this.repository.update(feature);
    }
  }

  public async remove(id: FeatureId): Promise<boolean> {
    const existed = this.inMemoryFeatures.delete(id);
    let repoExisted = false;
    if (this.repository) {
      repoExisted = await this.repository.delete(id);
    }
    return existed || repoExisted;
  }

  public async list(repositoryId?: string): Promise<Feature[]> {
    if (this.repository) {
      return this.repository.list(repositoryId);
    }
    const all = Array.from(this.inMemoryFeatures.values());
    if (repositoryId) {
      return all.filter(f => f.scope?.repositoryId === repositoryId);
    }
    return all;
  }

  public async findByName(name: string, repositoryId?: string): Promise<Feature[]> {
    const norm = name.toLowerCase().trim();
    const all = await this.list(repositoryId);
    return all.filter(f => f.name.toLowerCase().trim() === norm);
  }

  public async findByRepository(repositoryId: string): Promise<Feature[]> {
    return this.list(repositoryId);
  }

  public async findByReference(resourceId: string): Promise<Feature[]> {
    const all = await this.list();
    return all.filter(f => f.references?.some((r: any) => r.resourceId === resourceId) || f.symbolIds?.includes(resourceId));
  }

  public async findByType(type: FeatureType, repositoryId?: string): Promise<Feature[]> {
    const all = await this.list(repositoryId);
    return all.filter(f => f.type === type);
  }

  public async findByStatus(status: FeatureStatus, repositoryId?: string): Promise<Feature[]> {
    const all = await this.list(repositoryId);
    return all.filter(f => f.status === status);
  }
}
