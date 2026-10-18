import process from 'node:process';

export type ShutdownHandler = (signal: string) => Promise<void>;

export class ProcessSignalHandler {
  private isShuttingDown: boolean = false;
  private attached: boolean = false;
  private readonly listeners: Map<string, (...args: any[]) => void> = new Map();

  constructor(private readonly onShutdown: ShutdownHandler) {}

  public attach(): void {
    if (this.attached) {
      return;
    }

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      const listener = () => {
        if (this.isShuttingDown) {
          // Second signal forces immediate termination
          console.warn(`[ProcessSignalHandler] Forceful exit triggered by second ${signal}`);
          process.exit(1);
        }

        this.isShuttingDown = true;
        this.onShutdown(signal).catch((err) => {
          console.error(`[ProcessSignalHandler] Error during graceful shutdown on ${signal}:`, err);
          process.exit(1);
        });
      };

      try {
        process.on(signal, listener);
        this.listeners.set(signal, listener);
      } catch {
        // Fallback for environments without POSIX signal support (e.g. browser or sandbox)
      }
    }

    this.attached = true;
  }

  public detach(): void {
    for (const [signal, listener] of this.listeners.entries()) {
      try {
        process.removeListener(signal, listener);
      } catch {
        // Ignore
      }
    }
    this.listeners.clear();
    this.attached = false;
  }
}
