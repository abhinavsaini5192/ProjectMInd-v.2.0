import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';
import { BenchmarkSuite } from '../../benchmark/BenchmarkSuite.js';

export class BenchmarkCommand implements CLICommand {
  public readonly name = 'benchmark';
  public readonly description = 'Runs performance benchmarks on core ProjectMind engines.';
  public readonly usage = 'projectmind benchmark [--suite <name>] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'suite',
      description: 'Specific benchmark suite to execute',
      hasValue: true,
    },
    {
      name: 'json',
      description: 'Output benchmark results in JSON format',
      hasValue: false,
    },
  ];

  public async execute(ctxOrArgs: CLIContext | string[], maybeKernel?: ProjectMindKernel): Promise<any> {
    if (Array.isArray(ctxOrArgs)) {
      const kernel = maybeKernel!;
      console.log('Starting Benchmark Suite...\n');
      const suite = new BenchmarkSuite(kernel);
      await suite.runAll();
      return;
    }

    const ctx = ctxOrArgs;
    const kernel = await ctx.getKernel();

    try {
      const suite = new BenchmarkSuite(kernel);
      const report = await suite.runAll();

      const data = {
        status: 'COMPLETED',
        executedAt: new Date().toISOString(),
        summary: report.summary,
        environment: report.environment,
        report,
      };

      return createSuccessResult(
        this.name,
        data,
        'Benchmark suite executed successfully.'
      );
    } catch (err: unknown) {
      return createErrorResult(
        this.name,
        CLIExitCode.GENERAL_FAILURE,
        `Benchmark execution failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}
