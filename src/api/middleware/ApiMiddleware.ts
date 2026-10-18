import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';

export type NextFunction = () => Promise<ApiResponse>;

export type ApiMiddleware = (request: ApiRequest, next: NextFunction) => Promise<ApiResponse>;

export class ApiMiddlewarePipeline {
  private readonly middlewares: ApiMiddleware[] = [];

  public use(middleware: ApiMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public async execute(
    request: ApiRequest,
    handler: (req: ApiRequest) => Promise<ApiResponse>
  ): Promise<ApiResponse> {
    let index = -1;

    const dispatch = async (i: number): Promise<ApiResponse> => {
      if (i <= index) {
        throw new Error('next() called multiple times within middleware pipeline');
      }
      index = i;

      if (i < this.middlewares.length) {
        const middleware = this.middlewares[i]!;
        return middleware(request, () => dispatch(i + 1));
      }

      return handler(request);
    };

    return dispatch(0);
  }
}

export function composeMiddleware(middlewares: readonly ApiMiddleware[]): (
  request: ApiRequest,
  handler: (req: ApiRequest) => Promise<ApiResponse>
) => Promise<ApiResponse> {
  const pipeline = new ApiMiddlewarePipeline();
  for (const mw of middlewares) {
    pipeline.use(mw);
  }
  return (req, handler) => pipeline.execute(req, handler);
}
