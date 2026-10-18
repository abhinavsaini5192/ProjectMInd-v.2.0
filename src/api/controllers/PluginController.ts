import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IPluginService } from '../../plugins/interfaces/IPluginService.js';
import { ApiError } from '../errors/ApiError.js';
import {
  PluginError,
  ManifestValidationError,
  PluginNotFoundError,
  PluginSecurityError,
  PluginLifecycleError,
  PluginDependencyError,
} from '../../plugins/errors/PluginError.js';

export class PluginController extends BaseApiController {
  constructor(private readonly pluginService: IPluginService) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.post('/plugins/validate', this.handleValidateManifest.bind(this));
    router.post('/plugins/register', this.handleRegisterPlugin.bind(this));
    router.get('/plugins', this.handleListPlugins.bind(this));
    router.get('/plugins/:id', this.handleGetPlugin.bind(this));
    router.delete('/plugins/:id', this.handleUnregisterPlugin.bind(this));

    router.post('/plugins/:id/compatibility', this.handleCheckCompatibility.bind(this));
    router.post('/plugins/:id/install', this.handleInstallPlugin.bind(this));
    router.post('/plugins/:id/enable', this.handleEnablePlugin.bind(this));
    router.post('/plugins/:id/disable', this.handleDisablePlugin.bind(this));
    router.get('/plugins/:id/health', this.handleCheckHealth.bind(this));

    router.post('/plugins/:id/permissions/approve', this.handleApprovePermissions.bind(this));
    router.post('/plugins/:id/invoke', this.handleInvokePlugin.bind(this));
    router.post('/plugins/:id/configure', this.handleConfigurePlugin.bind(this));
    router.get('/plugins/:id/configure', this.handleGetConfiguration.bind(this));
    router.get('/plugins/:id/history', this.handleGetExecutionHistory.bind(this));
  }

  private async handleValidateManifest(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const manifest = this.pluginService.validateManifest(body.manifest ?? body);
      return this.ok(request, manifest);
    } catch (err: any) {
      if (err instanceof ManifestValidationError) {
        throw ApiError.badRequest(err.message, err.validationErrors as any);
      }
      throw err;
    }
  }

  private async handleRegisterPlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const rawManifest = body.manifest ?? body;
      const registration = await this.pluginService.registerPlugin(rawManifest, {
        registeredBy: request.context.userId,
        source: body.source ?? 'LOCAL',
      });
      return this.created(request, registration);
    } catch (err: any) {
      if (err instanceof ManifestValidationError) {
        throw ApiError.badRequest(err.message, err.validationErrors as any);
      }
      if (err instanceof PluginError && err.code === 'DUPLICATE_PLUGIN_REGISTRATION') {
        throw ApiError.conflict(err.message);
      }
      throw err;
    }
  }

  private async handleListPlugins(request: ApiRequest): Promise<ApiResponse<any>> {
    const query = request.query ?? {};
    const plugins = await this.pluginService.listPlugins({
      pluginType: query['type'] as any,
      publisher: query['publisher'],
      search: query['search'],
    });
    return this.ok(request, plugins);
  }

  private async handleGetPlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const plugin = await this.pluginService.getPlugin(pluginId);
    if (!plugin) {
      throw ApiError.notFound(`Plugin '${pluginId}' not found.`);
    }
    return this.ok(request, plugin);
  }

  private async handleUnregisterPlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const removed = await this.pluginService.unregisterPlugin(pluginId);
    if (!removed) {
      throw ApiError.notFound(`Plugin '${pluginId}' not found.`);
    }
    return this.ok(request, { uninstalled: true, pluginId });
  }

  private async handleCheckCompatibility(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const body = (request.body as Record<string, any>) ?? {};
    const result = await this.pluginService.checkCompatibility(pluginId, body.targetVersion);
    return this.ok(request, result);
  }

  private async handleInstallPlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const workspaceId = request.context.workspaceId ?? 'default';
    const projectId = (request.context as any).projectId;
    const installation = await this.pluginService.installPlugin(
      pluginId,
      workspaceId,
      projectId,
      request.context.userId ?? 'system'
    );
    return this.ok(request, installation);
  }

  private async handleEnablePlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    try {
      const workspaceId = request.context.workspaceId ?? 'default';
      const projectId = (request.context as any).projectId;
      const installation = await this.pluginService.enablePlugin(
        pluginId,
        workspaceId,
        projectId,
        request.context.userId ?? 'system'
      );
      return this.ok(request, installation);
    } catch (err: any) {
      if (err instanceof PluginSecurityError) {
        throw ApiError.forbidden(err.message);
      }
      if (err instanceof PluginDependencyError) {
        throw ApiError.badRequest(err.message);
      }
      if (err instanceof PluginNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleDisablePlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const workspaceId = request.context.workspaceId ?? 'default';
      const projectId = (request.context as any).projectId;
      const installation = await this.pluginService.disablePlugin(
        pluginId,
        workspaceId,
        projectId,
        body.reason
      );
      return this.ok(request, installation);
    } catch (err: any) {
      if (err instanceof PluginDependencyError) {
        throw ApiError.badRequest(err.message);
      }
      if (err instanceof PluginNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      throw err;
    }
  }

  private async handleCheckHealth(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const report = await this.pluginService.checkHealth(pluginId);
    return this.ok(request, report);
  }

  private async handleApprovePermissions(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const body = (request.body as Record<string, any>) ?? {};
    const workspaceId = request.context.workspaceId ?? 'default';
    const projectId = (request.context as any).projectId;

    await this.pluginService.grantPermissions({
      grantId: `grant-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pluginId,
      workspaceId,
      projectId,
      grantedCapabilities: body.capabilities ?? [],
      grantedPermissions: body.permissions ?? [],
      approvedBy: request.context.userId ?? 'system',
      approvedAt: new Date().toISOString(),
      status: 'ACTIVE',
    });

    return this.ok(request, { approved: true, pluginId });
  }

  private async handleInvokePlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const body = (request.body as Record<string, any>) ?? {};
    try {
      const result = await this.pluginService.invokePlugin({
        pluginId,
        operation: body.operation ?? 'default',
        payload: body.payload,
        workspaceId: request.context.workspaceId ?? 'default',
        projectId: (request.context as any).projectId,
        correlationId: request.context.correlationId ?? `req-${Date.now()}`,
        requestVersion: '1.0',
        timeoutMs: body.timeoutMs,
      });
      return this.ok(request, result);
    } catch (err: any) {
      if (err instanceof PluginSecurityError) {
        throw ApiError.forbidden(err.message);
      }
      if (err instanceof PluginNotFoundError) {
        throw ApiError.notFound(err.message);
      }
      if (err instanceof PluginError && err.code === 'PLUGIN_NOT_ENABLED') {
        throw ApiError.badRequest(err.message);
      }
      throw err;
    }
  }

  private async handleConfigurePlugin(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const body = (request.body as Record<string, any>) ?? {};
    await this.pluginService.configurePlugin(
      pluginId,
      request.context.workspaceId ?? 'default',
      body.config ?? {},
      (request.context as any).projectId
    );
    return this.ok(request, { configured: true, pluginId });
  }

  private async handleGetConfiguration(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const config = await this.pluginService.getConfiguration(
      pluginId,
      request.context.workspaceId ?? 'default',
      (request.context as any).projectId
    );
    return this.ok(request, config ?? {});
  }

  private async handleGetExecutionHistory(request: ApiRequest): Promise<ApiResponse<any>> {
    const pluginId = request.params?.id;
    if (!pluginId) {
      throw ApiError.badRequest('Missing plugin ID parameter.');
    }
    const history = await this.pluginService.getExecutionHistory(pluginId);
    return this.ok(request, history);
  }
}
