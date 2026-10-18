import { CLIApplication } from './core/CLIApplication.js';

/**
 * Executes the ProjectMind CLI platform with the supplied arguments.
 */
export async function runCLI(argv: readonly string[] = process.argv.slice(2)): Promise<number> {
  const app = CLIApplication.createDefault();
  return app.run(argv);
}

/**
 * Main application entry point for command-line execution.
 */
export async function main(): Promise<void> {
  try {
    const exitCode = await runCLI();
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  } catch (err: unknown) {
    console.error(`Fatal CLI Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// Detect direct command-line execution (e.g. node dist/cli/cli.js)
const entryScript = process.argv[1];
if (
  entryScript &&
  (entryScript.endsWith('cli.ts') || entryScript.endsWith('cli.js'))
) {
  main();
}
