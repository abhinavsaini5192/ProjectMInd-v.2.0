import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiMiddlewarePipeline } from '../middleware/ApiMiddleware.js';

export interface IApiService {
  handle(request: ApiRequest): Promise<ApiResponse>;
  getRouter(): IApiRouter;
  getMiddlewarePipeline(): ApiMiddlewarePipeline;
}
