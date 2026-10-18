import type { ApiRequestContext } from './ApiRequestContext.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface ApiRequest<
  TBody = unknown,
  TQuery extends Record<string, string | undefined> = Record<string, string | undefined>,
  TParams extends Record<string, string> = Record<string, string>
> {
  readonly path: string;
  readonly method: HttpMethod;
  readonly params: TParams;
  readonly query: TQuery;
  readonly headers: Record<string, string | undefined>;
  readonly body: TBody;
  readonly rawBody?: string | undefined;
  readonly context: ApiRequestContext;
}
