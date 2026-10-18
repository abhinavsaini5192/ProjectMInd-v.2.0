import { z } from 'zod';
import { PluginType, ALL_PLUGIN_TYPES } from './PluginType.js';
import { PluginCapability, ALL_PLUGIN_CAPABILITIES } from './PluginCapability.js';

export const SemverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-zA-Z0-9-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-zA-Z0-9-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
export const PluginIdRegex = /^[a-z0-9][a-z0-9-_.]+[a-z0-9]$/i;

export const PluginManifestSchema = z.object({
  pluginId: z.string().regex(PluginIdRegex, 'Plugin ID must be alphanumeric and may contain hyphens, dots, or underscores.').optional(),
  id: z.string().optional(), // backward compatibility alias
  name: z.string().min(1, 'Plugin name cannot be empty.'),
  version: z.string().regex(SemverRegex, 'Invalid semantic version format.'),
  description: z.string().default(''),
  publisher: z.string().min(1).default('community'),
  author: z.string().optional(), // backward compatibility alias for publisher
  manifestVersion: z.string().default('1.0'),
  minimumProjectMindVersion: z.string().default('0.9.0'),
  projectMindVersion: z.string().optional(), // backward compatibility alias
  maximumCompatibleProjectMindVersion: z.string().optional(),
  pluginType: z.enum(ALL_PLUGIN_TYPES as [PluginType, ...PluginType[]]).default('GENERIC_INTEGRATION'),
  entrypoint: z.string().optional(),
  entryPoint: z.string().optional(), // backward compatibility alias
  declaredCapabilities: z.array(z.string()).default([]),
  capabilities: z.array(z.string()).optional(), // backward compatibility alias
  requestedPermissions: z.array(z.string()).default([]),
  permissions: z.array(z.string()).optional(), // backward compatibility alias
  configurationSchema: z.record(z.string(), z.any()).optional(),
  dependencies: z.record(z.string(), z.string()).optional().default({}),
  optionalDependencies: z.record(z.string(), z.string()).optional().default({}),
  supportedInterfaces: z.array(z.string()).optional().default([]),
  integrity: z.object({
    algorithm: z.enum(['sha256']),
    checksum: z.string().min(1),
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional().default({}),
  license: z.string().optional(),
  repository: z.string().optional(),
  documentation: z.string().optional(),
});

export type RawPluginManifest = z.infer<typeof PluginManifestSchema>;

export interface PluginManifest {
  readonly pluginId: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly publisher: string;
  readonly manifestVersion: string;
  readonly minimumProjectMindVersion: string;
  readonly maximumCompatibleProjectMindVersion?: string | undefined;
  readonly pluginType: PluginType;
  readonly entrypoint: string;
  readonly declaredCapabilities: readonly PluginCapability[];
  readonly requestedPermissions: readonly string[];
  readonly configurationSchema?: Record<string, unknown> | undefined;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly optionalDependencies: Readonly<Record<string, string>>;
  readonly supportedInterfaces: readonly string[];
  readonly integrity?: { readonly algorithm: 'sha256'; readonly checksum: string } | undefined;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly license?: string | undefined;
  readonly repository?: string | undefined;
  readonly documentation?: string | undefined;
}

export function normalizePluginManifest(raw: unknown): PluginManifest {
  const parsed = PluginManifestSchema.parse(raw);

  const resolvedPluginId = parsed.pluginId || parsed.id;
  if (!resolvedPluginId) {
    throw new Error('Manifest missing required field: pluginId (or id)');
  }

  const resolvedEntrypoint = parsed.entrypoint || parsed.entryPoint || 'index.js';
  const resolvedMinVersion = parsed.minimumProjectMindVersion || parsed.projectMindVersion || '0.9.0';
  const resolvedPublisher = parsed.publisher || parsed.author || 'community';

  const capabilities = (parsed.declaredCapabilities.length > 0 ? parsed.declaredCapabilities : parsed.capabilities ?? []) as PluginCapability[];
  const permissions = parsed.requestedPermissions.length > 0 ? parsed.requestedPermissions : parsed.permissions ?? [];

  return Object.freeze({
    pluginId: resolvedPluginId,
    name: parsed.name,
    version: parsed.version,
    description: parsed.description,
    publisher: resolvedPublisher,
    manifestVersion: parsed.manifestVersion,
    minimumProjectMindVersion: resolvedMinVersion,
    maximumCompatibleProjectMindVersion: parsed.maximumCompatibleProjectMindVersion,
    pluginType: parsed.pluginType,
    entrypoint: resolvedEntrypoint,
    declaredCapabilities: Object.freeze([...capabilities]),
    requestedPermissions: Object.freeze([...permissions]),
    configurationSchema: parsed.configurationSchema ? Object.freeze({ ...parsed.configurationSchema }) : undefined,
    dependencies: Object.freeze({ ...parsed.dependencies }),
    optionalDependencies: Object.freeze({ ...parsed.optionalDependencies }),
    supportedInterfaces: Object.freeze([...parsed.supportedInterfaces]),
    integrity: parsed.integrity ? Object.freeze({ ...parsed.integrity }) : undefined,
    metadata: Object.freeze({ ...parsed.metadata }),
    license: parsed.license,
    repository: parsed.repository,
    documentation: parsed.documentation,
  });
}
