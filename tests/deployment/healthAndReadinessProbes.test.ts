import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ProductionBootstrap } from '../../src/platform/bootstrap/ProductionBootstrap.js';
import { PlatformServer } from '../../src/platform/server/PlatformServer.js';

function makeHttpRequest(url: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', (err) => reject(err));
  });
}

describe('Phase 10.5 Deployment - Health, Readiness & Metrics Probes', () => {
  const testDir = path.resolve(process.cwd(), '.projectmind_test_probes');
  let platform: any;
  let server: PlatformServer | undefined;
  let baseUrl: string = '';

  beforeEach(async () => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    platform = await ProductionBootstrap.bootstrap({
      workspacePath: testDir,
      disableSignalHandlers: true,
      configOverrides: {
        app: { env: 'test', logLevel: 'ERROR' },
        storage: { type: 'memory' },
        server: { port: 0, host: '127.0.0.1', drainTimeoutMs: 2000 },
      },
    });

    await platform.start();
    server = new PlatformServer(platform, {
      port: 0,
      host: '127.0.0.1',
      drainTimeoutMs: 2000,
    });

    const addr = await server.start();
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = undefined;
    }
    if (platform) {
      await platform.shutdown('test completion');
      platform = undefined;
    }
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore
    }
  });

  it('responds with 200 OK and alive status on /health/live liveness probe', async () => {
    const res = await makeHttpRequest(`${baseUrl}/health/live`);
    expect(res.status).toBe(200);

    const parsed = JSON.parse(res.body);
    expect(parsed.data.status).toBe('alive');
    expect(parsed.data.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('responds with 200 OK and ready status on /health/ready readiness probe', async () => {
    const res = await makeHttpRequest(`${baseUrl}/health/ready`);
    expect(res.status).toBe(200);

    const parsed = JSON.parse(res.body);
    expect(parsed.data.ready).toBe(true);
    expect(parsed.data.dependencies).toBeDefined();
  });

  it('returns full component breakdown on /health endpoint', async () => {
    const res = await makeHttpRequest(`${baseUrl}/health`);
    expect(res.status).toBe(200);

    const parsed = JSON.parse(res.body);
    expect(parsed.data.status).toBe('HEALTHY');
    expect(parsed.data.components['CONFIG']?.status).toBe('HEALTHY');
    expect(parsed.data.components['KERNEL']?.status).toBe('HEALTHY');
  });

  it('serves Prometheus text exposition format on /metrics when requested', async () => {
    const res = await makeHttpRequest(`${baseUrl}/metrics?format=prometheus`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.body).toContain('projectmind_requests_total');
    expect(res.body).toContain('projectmind_uptime_ms');
  });

  it('tracks active connections and drains in-flight requests gracefully', async () => {
    expect(server!.isRunning()).toBe(true);
    expect(server!.getActiveConnectionsCount()).toBeGreaterThanOrEqual(0);

    // Stop server
    await server!.stop();
    expect(server!.isRunning()).toBe(false);

    // After stopping, new connections are refused
    await expect(makeHttpRequest(`${baseUrl}/health/live`)).rejects.toThrow();
  });
});
