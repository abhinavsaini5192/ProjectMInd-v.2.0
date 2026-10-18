import { SLMRequest } from '../models/SLMRequest';
import { SLMResponse } from '../models/SLMResponse';
import { SLMCapabilities } from '../models/SLMCapabilities';
import { ModelMetadata } from '../models/ModelMetadata';
import { ModelRecord } from '../registry/ModelRecord';

export interface ISLMProvider {
  generate(request: SLMRequest): Promise<SLMResponse>;
  healthCheck(): Promise<boolean>;
  getCapabilities(): Promise<SLMCapabilities> | SLMCapabilities;
  getMetadata(): Promise<ModelMetadata>;
  listModels(): Promise<ModelRecord[]>;
}
