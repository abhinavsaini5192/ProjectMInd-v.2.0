import type { IModelContextAdapter } from '../interfaces/IModelContextAdapter.js';
import type { ContextFormat } from '../models/ContextFormat.js';
import { UnsupportedContextFormatError } from '../errors/UnsupportedContextFormatError.js';
import { GenericModelAdapter } from './GenericModelAdapter.js';
import { AnthropicContextAdapter } from './AnthropicContextAdapter.js';
import { OpenAIContextAdapter } from './OpenAIContextAdapter.js';
import { GeminiContextAdapter } from './GeminiContextAdapter.js';
import { CursorContextAdapter } from './CursorContextAdapter.js';
import { CodexContextAdapter } from './CodexContextAdapter.js';
import { JsonContextAdapter } from './JsonContextAdapter.js';

export class AdapterRegistry {
  private readonly adapters = new Map<ContextFormat, IModelContextAdapter>();

  constructor() {
    this.register(new GenericModelAdapter());
    this.register(new AnthropicContextAdapter());
    this.register(new OpenAIContextAdapter());
    this.register(new GeminiContextAdapter());
    this.register(new CursorContextAdapter());
    this.register(new CodexContextAdapter());
    this.register(new JsonContextAdapter());
  }

  public register(adapter: IModelContextAdapter): void {
    this.adapters.set(adapter.format, adapter);
  }

  public getAdapter(format: ContextFormat = 'generic-markdown'): IModelContextAdapter {
    const adapter = this.adapters.get(format);
    if (!adapter) {
      throw new UnsupportedContextFormatError(format);
    }
    return adapter;
  }

  public hasAdapter(format: ContextFormat): boolean {
    return this.adapters.has(format);
  }
}
