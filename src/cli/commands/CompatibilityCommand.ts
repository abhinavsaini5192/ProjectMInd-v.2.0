import * as fs from 'fs';
import * as path from 'path';
import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult } from '../core/CLIResult.js';
import type { ProjectMindKernel } from '../../kernel/ProjectMindKernel.js';

export class CompatibilityCommand implements CLICommand {
  public readonly name = 'compatibility';
  public readonly description = 'Generates a compatibility report for the current ProjectMind installation.';
  public readonly usage = 'projectmind compatibility [--output <path>] [--json]';
  public readonly options: readonly CLICommandOption[] = [
    {
      name: 'output',
      description: 'Custom path to write the compatibility report file',
      hasValue: true,
    },
    {
      name: 'json',
      description: 'Output compatibility report in JSON format directly',
      hasValue: false,
    },
  ];

  public async execute(ctxOrArgs: CLIContext | string[], maybeKernel?: ProjectMindKernel): Promise<any> {
    const report = {
      projectmindVersion: '1.0.0',
      pluginApiVersion: '1.x',
      datasetSchemaVersion: 'training_sample.v1',
      knowledgeSchemaVersion: '1.0',
      eventContractVersion: '1.0',
      slmCompatibilityVersion: '1.0',
      timestamp: new Date().toISOString(),
    };

    if (Array.isArray(ctxOrArgs)) {
      const kernel = maybeKernel!;
      console.log('Generating Compatibility Report...');
      const outPath = path.join(kernel.workspaceManager.workspacePath, 'compatibility_report.json');
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`Report generated at: ${outPath}`);
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const ctx = ctxOrArgs;
    const customOut = ctx.options['output'] as string | undefined;
    const outPath = customOut ?? path.join(ctx.workspacePath, 'compatibility_report.json');

    try {
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    } catch {
      // Ignore write errors if running in read-only environment
    }

    return createSuccessResult(
      this.name,
      {
        report,
        reportPath: outPath,
      },
      `Compatibility report generated: ProjectMind v${report.projectmindVersion} (Schema v${report.knowledgeSchemaVersion})`
    );
  }
}
