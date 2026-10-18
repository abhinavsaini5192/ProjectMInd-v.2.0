import http from 'node:http';
import type { Socket } from 'node:net';
import type { ProjectMindPlatform } from '../core/ProjectMindPlatform.js';
import { ApiRouter } from '../../api/routing/ApiRouter.js';
import { ApiService } from '../../api/services/ApiService.js';
import { HttpAdapter } from '../../api/adapters/HttpAdapter.js';
import { HealthController } from '../../api/controllers/HealthController.js';
import { CapabilitiesController } from '../../api/controllers/CapabilitiesController.js';
import type { ApiRequest } from '../../api/contracts/ApiRequest.js';
import type { ApiResponse } from '../../api/contracts/ApiResponse.js';

export interface PlatformServerOptions {
  readonly port?: number | undefined;
  readonly host?: string | undefined;
  readonly drainTimeoutMs?: number | undefined;
}

/**
 * PlatformServer provides an HTTP interface for ProjectMind API, health probes,
 * readiness probes, metrics scraping, and graceful connection draining.
 */
export class PlatformServer {
  private readonly platform: ProjectMindPlatform;
  private readonly port: number;
  private readonly host: string;
  private readonly drainTimeoutMs: number;
  private server?: http.Server | undefined;
  private readonly sockets = new Set<Socket>();
  private activeRequestsCount: number = 0;
  private isDraining: boolean = false;

  constructor(platform: ProjectMindPlatform, options: PlatformServerOptions = {}) {
    this.platform = platform;
    this.port = options.port ?? platform.config.server.port;
    this.host = options.host ?? platform.config.server.host;
    this.drainTimeoutMs = options.drainTimeoutMs ?? platform.config.server.drainTimeoutMs;
  }

  public getPort(): number {
    return this.port;
  }

  public getHost(): string {
    return this.host;
  }

  public getActiveConnectionsCount(): number {
    return this.sockets.size;
  }

  public getActiveRequestsCount(): number {
    return this.activeRequestsCount;
  }

  public isRunning(): boolean {
    return this.server?.listening ?? false;
  }

  /**
   * Builds the API router and registers core controllers and endpoints.
   */
  public buildRouter(): ApiRouter {
    const router = new ApiRouter();

    // Register SERVER_DRAIN readiness check: during draining, readiness drops to 503
    this.platform.healthService.registerComponent(
      'SERVER_DRAIN',
      async () => {
        if (this.isDraining) {
          return { status: 'UNHEALTHY', message: 'Platform server is draining in-flight connections.' };
        }
        return { status: 'HEALTHY', message: 'Platform server is actively accepting requests.' };
      },
      true
    );

    // 1. Health Controller endpoints (/health, /health/live, /health/ready, /v1/health, ...)
    const healthController = new HealthController(this.platform.healthService);
    healthController.registerRoutes(router);

    // 2. Capabilities endpoint
    const capabilitiesController = new CapabilitiesController();
    capabilitiesController.registerRoutes(router);

    // 3. Metrics endpoints (/metrics and /v1/metrics)
    const metricsHandler = async (req: ApiRequest): Promise<ApiResponse> => {
      const snapshot = this.platform.getMetrics();
      const acceptHeader = req.headers['accept'] ?? '';
      const mem = process.memoryUsage();

      if (acceptHeader.includes('text/plain') || req.query?.['format'] === 'prometheus') {
        // Render Prometheus exposition text format
        const lines: string[] = [
          '# HELP projectmind_requests_total Total HTTP requests handled',
          '# TYPE projectmind_requests_total counter',
          `projectmind_requests_total ${snapshot.counters['requests_total'] ?? 0}`,
          '# HELP projectmind_active_connections Current active open sockets',
          '# TYPE projectmind_active_connections gauge',
          `projectmind_active_connections ${this.sockets.size}`,
          '# HELP projectmind_active_requests In-flight HTTP requests',
          '# TYPE projectmind_active_requests gauge',
          `projectmind_active_requests ${this.activeRequestsCount}`,
          '# HELP projectmind_uptime_ms Platform process uptime in milliseconds',
          '# TYPE projectmind_uptime_ms gauge',
          `projectmind_uptime_ms ${this.platform.getLiveness().uptimeMs}`,
          '# HELP projectmind_process_memory_rss_bytes Process RSS memory in bytes',
          '# TYPE projectmind_process_memory_rss_bytes gauge',
          `projectmind_process_memory_rss_bytes ${mem.rss}`,
          '# HELP projectmind_process_memory_heap_used_bytes Process heap memory used in bytes',
          '# TYPE projectmind_process_memory_heap_used_bytes gauge',
          `projectmind_process_memory_heap_used_bytes ${mem.heapUsed}`,
        ];

        for (const [k, v] of Object.entries(snapshot.counters)) {
          if (k !== 'requests_total') {
            lines.push(`projectmind_counter_${k.replace(/[^a-zA-Z0-9_]/g, '_')} ${v}`);
          }
        }

        for (const [k, v] of Object.entries(snapshot.gauges)) {
          lines.push(`projectmind_gauge_${k.replace(/[^a-zA-Z0-9_]/g, '_')} ${v}`);
        }

        for (const [k, timer] of Object.entries(snapshot.timers)) {
          const safeKey = k.replace(/[^a-zA-Z0-9_]/g, '_');
          lines.push(`projectmind_timer_${safeKey}_count ${timer.count}`);
          lines.push(`projectmind_timer_${safeKey}_avg_ms ${timer.avgMs}`);
          lines.push(`projectmind_timer_${safeKey}_max_ms ${timer.maxMs}`);
        }

        return {
          status: 200,
          headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8' },
          data: lines.join('\n') + '\n',
          meta: {
            requestId: req.context?.requestId ?? `req_${Date.now()}`,
            correlationId: req.context?.correlationId ?? `corr_${Date.now()}`,
            apiVersion: 'v1',
            timestamp: Date.now(),
          },
        };
      }

      // JSON format by default
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: {
          metrics: snapshot,
          process: {
            rssBytes: mem.rss,
            heapUsedBytes: mem.heapUsed,
            heapTotalBytes: mem.heapTotal,
            uptimeSeconds: Math.round(process.uptime()),
          },
          server: {
            activeConnections: this.sockets.size,
            activeRequests: this.activeRequestsCount,
            draining: this.isDraining,
          },
        },
        meta: {
          requestId: req.context?.requestId ?? `req_${Date.now()}`,
          correlationId: req.context?.correlationId ?? `corr_${Date.now()}`,
          apiVersion: 'v1',
          timestamp: Date.now(),
        },
      };
    };

    router.get('/metrics', metricsHandler);
    router.get('/v1/metrics', metricsHandler);


    return router;
  }

  /**
   * Starts the HTTP server on configured host and port.
   */
  public async start(): Promise<{ port: number; host: string }> {
    if (this.server) {
      return { port: this.port, host: this.host };
    }

    const router = this.buildRouter();
    const apiService = new ApiService({ router });
    const httpAdapter = new HttpAdapter(apiService, {
      maxBodySizeBytes: this.platform.config.storage.maxPayloadSizeBytes,
    });

    const server = http.createServer(async (req, res) => {
      this.activeRequestsCount++;
      if (this.isDraining) {
        res.setHeader('Connection', 'close');
      }

      try {
        await httpAdapter.handleRequest(req, res);
      } finally {
        this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
      }
    });

    // Socket lifecycle tracking for graceful draining
    server.on('connection', (socket: Socket) => {
      this.sockets.add(socket);
      socket.on('close', () => {
        this.sockets.delete(socket);
      });
    });

    this.server = server;

    return new Promise((resolve, reject) => {
      server.once('error', (err) => {
        reject(err);
      });

      server.listen(this.port, this.host, () => {
        const address = server.address();
        const effectivePort = typeof address === 'object' && address ? address.port : this.port;
        this.platform.logger.info({
          component: 'PlatformServer',
          operation: 'listen',
          message: `ProjectMind API server listening on http://${this.host}:${effectivePort}`,
        });
        resolve({ port: effectivePort, host: this.host });
      });
    });
  }

  /**
   * Gracefully drains in-flight requests and closes the HTTP server.
   */
  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    this.isDraining = true;
    const server = this.server;

    this.platform.logger.info({
      component: 'PlatformServer',
      operation: 'stop',
      message: `Stopping API server. Draining ${this.activeRequestsCount} active requests across ${this.sockets.size} open connections (timeout: ${this.drainTimeoutMs}ms)...`,
    });

    // Stop accepting new connections
    await new Promise<void>((resolve) => {
      server.close(() => resolve());

      // If active requests finish before timeout, resolve immediately
      const checkInterval = setInterval(() => {
        if (this.activeRequestsCount === 0) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      // Force socket destroy if drain timeout expires
      setTimeout(() => {
        clearInterval(checkInterval);
        for (const socket of this.sockets) {
          socket.destroy();
        }
        resolve();
      }, this.drainTimeoutMs);
    });

    this.server = undefined;
    this.isDraining = false;
  }
}
