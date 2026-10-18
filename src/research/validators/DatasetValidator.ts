import { TrainingSample, TrainingSampleSchemaV1 } from '../schemas/DatasetSchemas';
import { ProjectMindError } from '../../errors';

export class DatasetValidator {
  
  public validate(sample: TrainingSample): { valid: boolean, errors: string[] } {
    const result = TrainingSampleSchemaV1.safeParse(sample);
    if (!result.success) {
      return { valid: false, errors: result.error.issues.map((e) => e.message) };
    }

    const errors: string[] = [];
    
    // Custom validation: reject low quality samples
    if (sample.metadata.qualityScore < 0.4) {
      errors.push('Sample rejected due to low quality score.');
    }

    return { valid: errors.length === 0, errors };
  }
}
