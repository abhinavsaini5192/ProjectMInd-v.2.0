import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';
import type { ProjectMindPlatform } from '../../platform/core/ProjectMindPlatform.js';
import { ProductionBootstrap } from '../../platform/bootstrap/ProductionBootstrap.js';
import { PlatformConfigLoader } from '../../platform/config/PlatformConfigLoader.js';
import type { PlatformConfig } from '../../platform/config/PlatformConfig.js';

export type OutputFormat = 'text' | 'json' | 'table';

export interface CLIContextOptions {
  readonly workspacePath?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly args?: readonly string[] | undefined;
  readonly options?: Readonly<Record<string, string | boolean | number>> | undefined;
  readonly format?: OutputFormat | undefined;
  readonly isInteractive?: boolean | undefined;
  readonly isVerbose?: boolean | undefined;
  readonly isDebug?: boolean | undefined;
  readonly stdout?: ((msg: string) => unknown) | undefined;
  readonly stderr?: ((msg: string) => unknown) | undefined;
  readonly kernelInstance?: ProjectMindKernel | undefined;
  readonly platformInstance?: ProjectMindPlatform | undefined;
}

export class CLIContext {
  public readonly workspacePath: string;
  public readonly workspaceId?: string | undefined;
  public readonly args: readonly string[];
  public readonly options: Readonly<Record<string, string | boolean | number>>;
  public readonly format: OutputFormat;
  public readonly isInteractive: boolean;
  public readonly isVerbose: boolean;
  public readonly isDebug: boolean;

  private readonly stdoutWriter: (msg: string) => void;
  private readonly stderrWriter: (msg: string) => void;

  private kernelInstance?: ProjectMindKernel | undefined;
  private platformInstance?: ProjectMindPlatform | undefined;
  private configInstance?: PlatformConfig | undefined;

  constructor(opts: CLIContextOptions = {}) {
    this.workspacePath = opts.workspacePath ?? process.cwd();
    this.workspaceId = opts.workspaceId ?? (opts.options?.['workspace'] ? String(opts.options['workspace']) : undefined);
    this.args = opts.args ?? [];
    this.options = opts.options ?? {};
    this.format = opts.format ?? (opts.options?.['json'] ? 'json' : 'text');
    this.isInteractive = opts.isInteractive ?? (process.stdout.isTTY ?? false);
    this.isVerbose = opts.isVerbose ?? Boolean(opts.options?.['verbose']);
    this.isDebug = opts.isDebug ?? Boolean(opts.options?.['debug']);

    this.stdoutWriter = opts.stdout ?? ((msg: string) => process.stdout.write(msg + '\n'));
    this.stderrWriter = opts.stderr ?? ((msg: string) => process.stderr.write(msg + '\n'));

    if (opts.kernelInstance) {
      this.kernelInstance = opts.kernelInstance;
    }
    if (opts.platformInstance) {
      this.platformInstance = opts.platformInstance;
    }
  }

  public out(msg: string): void {
    this.stdoutWriter(msg);
  }

  public err(msg: string): void {
    this.stderrWriter(msg);
  }

  public getOption<T = string | boolean | number>(name: string): T | undefined {
    return this.options[name] as T | undefined;
  }

  /**
   * Lazily loads platform configuration without booting the kernel.
   */
  public getConfig(): PlatformConfig {
    if (!this.configInstance) {
      this.configInstance = PlatformConfigLoader.load();
    }
    return this.configInstance;
  }

  /**
   * Lazily initializes and returns the core kernel.
   */
  public async getKernel(): Promise<ProjectMindKernel> {
    if (this.platformInstance) {
      return this.platformInstance.kernel;
    }

    if (!this.kernelInstance) {
      const { ProjectMindKernel } = await import('../../kernel/ProjectMindKernel.js');
      this.kernelInstance = new ProjectMindKernel(this.workspacePath, {
        debug: this.isDebug,
      });
      await this.kernelInstance.initialize();
    }

    return this.kernelInstance;
  }

  /**
   * Lazily bootstraps and returns the full production platform.
   */
  public async getPlatform(): Promise<ProjectMindPlatform> {
    if (!this.platformInstance) {
      this.platformInstance = await ProductionBootstrap.bootstrap({
        workspacePath: this.workspacePath,
        disableSignalHandlers: true,
      });
    }
    return this.platformInstance;
  }

  /**
   * Closes any open platform or kernel instances cleanly.
   */
  public async dispose(): Promise<void> {
    if (this.platformInstance) {
      await this.platformInstance.shutdown('CLI Command Complete');
      this.platformInstance = undefined;
    } else if (this.kernelInstance) {
      await this.kernelInstance.shutdown();
      this.kernelInstance = undefined;
    }
  }
}
