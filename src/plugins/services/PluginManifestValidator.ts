import crypto from 'crypto';
import { PluginManifest, normalizePluginManifest } from '../models/PluginManifest.js';
import { ManifestValidationError } from '../errors/PluginError.js';
import { ALL_PLUGIN_CAPABILITIES } from '../models/PluginCapability.js';

export class PluginManifestValidator {
  public static readonly SUPPORTED_MANIFEST_VERSIONS = ['1.0'];

  /**
   * Validates and normalizes a raw plugin manifest.
   */
  public validate(raw: unknown): PluginManifest {
    if (!raw || typeof raw !== 'object') {
      throw new ManifestValidationError('Plugin manifest must be a non-null object.');
    }

    let manifest: PluginManifest;
    try {
      manifest = normalizePluginManifest(raw);
    } catch (err: any) {
      throw new ManifestValidationError(
        `Manifest schema validation failed: ${err.message}`,
        [err.message]
      );
    }

    const errors: string[] = [];

    // Manifest version check
    if (!PluginManifestValidator.SUPPORTED_MANIFEST_VERSIONS.includes(manifest.manifestVersion)) {
      errors.push(
        `Unsupported manifest version '${manifest.manifestVersion}'. Supported versions: ${PluginManifestValidator.SUPPORTED_MANIFEST_VERSIONS.join(
          ', '
        )}`
      );
    }

    // Capability check
    for (const cap of manifest.declaredCapabilities) {
      if (!ALL_PLUGIN_CAPABILITIES.includes(cap as any)) {
        errors.push(`Unrecognized declared capability: '${cap}'`);
      }
    }

    // Dependencies check
    for (const [depId, range] of Object.entries(manifest.dependencies)) {
      if (!depId.trim() || !range.trim()) {
        errors.push(`Invalid dependency entry: '${depId}': '${range}'`);
      }
    }

    if (errors.length > 0) {
      throw new ManifestValidationError(
        `Manifest validation failed with ${errors.length} error(s): ${errors.join('; ')}`,
        errors
      );
    }

    return manifest;
  }

  /**
   * Verifies package SHA-256 checksum against manifest integrity declaration.
   */
  public verifyIntegrity(packageBuffer: Buffer | string, expectedChecksum: string): boolean {
    const hash = crypto.createHash('sha256').update(packageBuffer).digest('hex');
    return hash.toLowerCase() === expectedChecksum.toLowerCase();
  }
}
