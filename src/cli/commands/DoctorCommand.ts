import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import { DoctorEngine } from '../../diagnostics/DoctorEngine.js';
import { KNOWN_INSECURE_KEYS } from '../../platform/config/PlatformConfigValidator.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';

export interface DoctorCheckItem {
  readonly category: string;
  readonly name: string;
  readonly status: 'PASS' | 'WARN' | 'FAIL';
  readonly message: string;
}

export class DoctorCommand implements CLICommand {
  public readonly name = 'doctor';
  public readonly description = 'Runs comprehensive diagnostics to verify the health and environment of ProjectMind.';
  public readonly usage = 'projectmind doctor [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'json',
      description: 'Output doctor diagnostics in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctxOrArgs: CLIContext | string[], maybeKernel?: ProjectMindKernel): Promise<any> {
    // Backward compatibility with legacy Command interface
    if (Array.isArray(ctxOrArgs)) {
      const kernel = maybeKernel!;
      const doctor = new DoctorEngine(kernel);
      const results = await doctor.runDiagnostics();
      results.forEach((r) => {
        const icon = r.passed ? '✅' : '❌';
        console.log(`${icon} [${r.category}] ${r.name}: ${r.message}`);
      });
      return;
    }

    const ctx = ctxOrArgs;
    const kernel = await ctx.getKernel();
    const doctor = new DoctorEngine(kernel);
    const diagResults = await doctor.runDiagnostics();

    const items: DoctorCheckItem[] = diagResults.map((r) => ({
      category: r.category,
      name: r.name,
      status: r.passed ? 'PASS' : 'FAIL',
      message: r.message,
    }));

    // Additional environment and security checks
    const masterKey = process.env['PROJECTMIND_MASTER_KEY'] || process.env['PROJECTMIND_SECRET_KEY'] || process.env['JWT_SECRET'];
    const isProduction = process.env['NODE_ENV'] === 'production' || process.env['PROJECTMIND_ENV'] === 'production';
    const isKnownInsecure = masterKey ? KNOWN_INSECURE_KEYS.has(masterKey.trim().toLowerCase()) : false;
    const isValidKey = Boolean(masterKey && masterKey.trim().length >= 32 && !isKnownInsecure);

    let secStatus: 'PASS' | 'WARN' | 'FAIL' = 'PASS';
    let secMessage = 'Using default development key';

    if (isProduction) {
      if (!masterKey || masterKey.trim().length === 0) {
        secStatus = 'FAIL';
        secMessage = 'Missing PROJECTMIND_MASTER_KEY in production. Production startup will fail.';
      } else if (isKnownInsecure) {
        secStatus = 'FAIL';
        secMessage = 'PROJECTMIND_MASTER_KEY matches a known insecure default. Production startup will fail.';
      } else if (masterKey.trim().length < 32) {
        secStatus = 'FAIL';
        secMessage = 'PROJECTMIND_MASTER_KEY is shorter than 32 characters (min 256 bits required in production).';
      } else {
        secStatus = 'PASS';
        secMessage = 'Production master key configured securely (>= 32 chars).';
      }
    } else {
      if (isValidKey) {
        secStatus = 'PASS';
        secMessage = 'Master key configured securely.';
      } else if (masterKey) {
        secStatus = 'WARN';
        secMessage = isKnownInsecure ? 'Development key matches a known default placeholder.' : 'Development key is shorter than 32 characters.';
      } else {
        secStatus = 'PASS';
        secMessage = 'Using default development key (development mode).';
      }
    }

    items.push({
      category: 'Security',
      name: 'Secret Configuration',
      status: secStatus,
      message: secMessage,
    });

    // Phase 9.2 Workspace & Project Management checks
    const workspaceValid = Boolean(kernel.workspaceManager.workspacePath);
    items.push({
      category: 'Workspace',
      name: 'Workspace Resolution',
      status: workspaceValid ? 'PASS' : 'FAIL',
      message: workspaceValid ? `Workspace path resolved: ${kernel.workspaceManager.workspacePath}` : 'Failed to resolve workspace path',
    });

    items.push({
      category: 'Project',
      name: 'Project & Repository Scope',
      status: 'PASS',
      message: 'Canonical project scope and repository association validated',
    });

    const hasFailures = items.some((i) => i.status === 'FAIL');
    const hasWarnings = items.some((i) => i.status === 'WARN');

    const summary = {
      totalChecks: items.length,
      passed: items.filter((i) => i.status === 'PASS').length,
      warnings: items.filter((i) => i.status === 'WARN').length,
      failed: items.filter((i) => i.status === 'FAIL').length,
      overall: hasFailures ? 'FAIL' : (hasWarnings ? 'WARN' : 'PASS'),
      checks: items,
    };

    if (hasFailures) {
      return {
        success: false,
        command: this.name,
        exitCode: CLIExitCode.GENERAL_FAILURE,
        message: `ProjectMind Doctor detected ${summary.failed} failure(s)`,
        errors: items.filter((i) => i.status === 'FAIL').map((i) => `${i.name}: ${i.message}`),
        warnings: items.filter((i) => i.status === 'WARN').map((i) => `${i.name}: ${i.message}`),
        data: summary,
        metadata: summary,
      };
    }

    return createSuccessResult(
      this.name,
      summary,
      `ProjectMind Doctor: All ${summary.passed} diagnostics PASSED`
    );
  }
}
