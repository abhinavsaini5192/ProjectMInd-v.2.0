import type { SDKClientOptions, PaginationParams, PaginatedResult } from './models/SDKClientOptions.js';
import type {
  SDKContextRequest,
  SDKContextResponse,
  SDKFeatureInfo,
  SDKTaskPlan,
  SDKFeedbackSubmission,
  SDKPluginRegistration,
} from './models/SDKModels.js';
import { SDKHttpClient } from './http/SDKHttpClient.js';

export class ProjectMindClient {
  private readonly http: SDKHttpClient;

  public readonly context: {
    get: (req: SDKContextRequest, signal?: AbortSignal) => Promise<SDKContextResponse>;
  };

  public readonly features: {
    list: (params?: PaginationParams) => Promise<PaginatedResult<SDKFeatureInfo>>;
    get: (featureId: string) => Promise<SDKFeatureInfo>;
  };

  public readonly plans: {
    get: (planId: string) => Promise<SDKTaskPlan>;
    list: (params?: PaginationParams) => Promise<PaginatedResult<SDKTaskPlan>>;
  };

  public readonly feedback: {
    submit: (submission: SDKFeedbackSubmission) => Promise<{ feedbackId: string }>;
  };

  public readonly plugins: {
    list: (filter?: { pluginType?: string }) => Promise<SDKPluginRegistration[]>;
    get: (pluginId: string) => Promise<SDKPluginRegistration>;
    register: (manifest: Record<string, unknown>) => Promise<SDKPluginRegistration>;
    enable: (pluginId: string) => Promise<{ status: string }>;
    disable: (pluginId: string) => Promise<{ status: string }>;
    health: (pluginId: string) => Promise<{ status: string; message?: string }>;
  };

  constructor(options: SDKClientOptions) {
    this.http = new SDKHttpClient(options);

    this.context = {
      get: async (req, signal) => {
        return this.http.request<SDKContextResponse>({
          method: 'POST',
          path: '/api/v1/context/request',
          body: req,
          signal,
          isIdempotent: true,
        });
      },
    };

    this.features = {
      list: async (params) => {
        return this.http.request<PaginatedResult<SDKFeatureInfo>>({
          method: 'GET',
          path: '/api/v1/features',
          query: params as any,
        });
      },
      get: async (featureId) => {
        return this.http.request<SDKFeatureInfo>({
          method: 'GET',
          path: `/api/v1/features/${featureId}`,
        });
      },
    };

    this.plans = {
      get: async (planId) => {
        return this.http.request<SDKTaskPlan>({
          method: 'GET',
          path: `/api/v1/plans/${planId}`,
        });
      },
      list: async (params) => {
        return this.http.request<PaginatedResult<SDKTaskPlan>>({
          method: 'GET',
          path: '/api/v1/plans',
          query: params as any,
        });
      },
    };

    this.feedback = {
      submit: async (submission) => {
        return this.http.request<{ feedbackId: string }>({
          method: 'POST',
          path: '/api/v1/learning/feedback',
          body: submission,
          isIdempotent: false,
        });
      },
    };

    this.plugins = {
      list: async (filter) => {
        return this.http.request<SDKPluginRegistration[]>({
          method: 'GET',
          path: '/api/v1/plugins',
          query: filter as any,
        });
      },
      get: async (pluginId) => {
        return this.http.request<SDKPluginRegistration>({
          method: 'GET',
          path: `/api/v1/plugins/${pluginId}`,
        });
      },
      register: async (manifest) => {
        return this.http.request<SDKPluginRegistration>({
          method: 'POST',
          path: '/api/v1/plugins/register',
          body: { manifest },
          isIdempotent: false,
        });
      },
      enable: async (pluginId) => {
        return this.http.request<{ status: string }>({
          method: 'POST',
          path: `/api/v1/plugins/${pluginId}/enable`,
          isIdempotent: true,
        });
      },
      disable: async (pluginId) => {
        return this.http.request<{ status: string }>({
          method: 'POST',
          path: `/api/v1/plugins/${pluginId}/disable`,
          isIdempotent: true,
        });
      },
      health: async (pluginId) => {
        return this.http.request<{ status: string; message?: string }>({
          method: 'GET',
          path: `/api/v1/plugins/${pluginId}/health`,
        });
      },
    };
  }
}
