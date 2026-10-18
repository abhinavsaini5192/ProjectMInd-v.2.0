import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Phase 10.5 Deployment - Static Manifest & Container Validation', () => {
  const rootDir = process.cwd();

  it('validates production Dockerfile structure and security best practices', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const content = fs.readFileSync(dockerfilePath, 'utf-8');

    // 1. Multi-stage build
    expect(content).toMatch(/FROM\s+node:20(\.[0-9]+)*-bookworm-slim\s+AS\s+builder/i);
    expect(content).toMatch(/FROM\s+node:20(\.[0-9]+)*-bookworm-slim\s+AS\s+runner/i);

    // 2. Reproducible dependencies & compilation
    expect(content).toContain('npm ci');
    expect(content).toContain('npm run build');

    // 3. Security: non-root user
    expect(content).toContain('USER node');

    // 4. Signal handling: dumb-init
    expect(content).toContain('dumb-init');
    expect(content).toMatch(/ENTRYPOINT\s+\[.*dumb-init.*dist\/platform\/main\.js.*\]/);

    // 5. Healthcheck probe
    expect(content).toContain('HEALTHCHECK');
    expect(content).toContain('/health/live');

    // 6. Security: no hard-coded secrets
    expect(content).not.toMatch(/api[_-]?key\s*=\s*['"][a-zA-Z0-9_-]+['"]/i);
    expect(content).not.toMatch(/password\s*=\s*['"][a-zA-Z0-9_-]+['"]/i);
  });

  it('validates .dockerignore completeness and sensitive file exclusion', () => {
    const dockerignorePath = path.join(rootDir, '.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);

    const content = fs.readFileSync(dockerignorePath, 'utf-8');
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));

    expect(lines).toContain('node_modules');
    expect(lines).toContain('.git');
    expect(lines).toContain('tests');
    expect(lines).toContain('.env*');
    expect(lines).toContain('coverage');
  });

  it('validates docker-compose.yml multi-service topology and networking', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const content = fs.readFileSync(composePath, 'utf-8');

    // Verify services
    expect(content).toContain('migration:');
    expect(content).toContain('api:');
    expect(content).toContain('worker:');
    expect(content).toContain('redis:');

    // Verify health checks and dependencies
    expect(content).toContain('healthcheck:');
    expect(content).toContain('service_completed_successfully');
    expect(content).toContain('service_healthy');

    // Verify persistent volumes and networks
    expect(content).toContain('projectmind-data:');
    expect(content).toContain('redis-data:');
    expect(content).toContain('projectmind-net:');

    // Verify roles
    expect(content).toContain('--role=migration');
    expect(content).toContain('--role=api');
    expect(content).toContain('--role=worker');

    // Verify secret enforcement: PROJECTMIND_MASTER_KEY must be passed to containers
    expect(content).toContain('PROJECTMIND_MASTER_KEY=${PROJECTMIND_MASTER_KEY:-}');
  });

  it('validates Kubernetes deployment manifests in deploy/kubernetes/', () => {
    const k8sDir = path.join(rootDir, 'deploy', 'kubernetes');
    expect(fs.existsSync(k8sDir)).toBe(true);

    const files = [
      'namespace.yaml',
      'configmap.yaml',
      'secret.example.yaml',
      'pvc.yaml',
      'migration-job.yaml',
      'api-deployment.yaml',
      'api-service.yaml',
      'worker-deployment.yaml',
    ];

    for (const file of files) {
      const filePath = path.join(k8sDir, file);
      expect(fs.existsSync(filePath), `Missing Kubernetes manifest: ${file}`).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('apiVersion:');
      expect(content).toContain('metadata:');

      // Check securityContext on workloads
      if (file.includes('deployment') || file.includes('job')) {
        expect(content).toContain('runAsNonRoot: true');
        expect(content).toContain('resources:');
        expect(content).toContain('limits:');
        expect(content).toContain('requests:');
      }

      // Check probes on deployments
      if (file.includes('deployment')) {
        expect(content).toContain('readinessProbe:');
        expect(content).toContain('livenessProbe:');
      }

      // Check master key definition in secret template
      if (file === 'secret.example.yaml') {
        expect(content).toContain('PROJECTMIND_MASTER_KEY:');
      }
    }
  });
});
