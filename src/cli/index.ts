// CLI Core Framework
export * from './core/CLIExitCode.js';
export * from './core/CLIResult.js';
export * from './core/CLICommand.js';
export * from './core/CLIContext.js';
export * from './core/CommandRegistry.js';
export * from './core/CLIApplication.js';

// Output and Errors
export * from './output/CLIOutputFormatter.js';
export * from './errors/CLIError.js';
export * from './errors/CLIErrorHandler.js';

// Completion
export * from './completion/ShellCompletionGenerator.js';

// Commands
export * from './commands/InitCommand.js';
export * from './commands/StatusCommand.js';
export * from './commands/AnalyzeCommand.js';
export * from './commands/ContextCommand.js';
export * from './commands/FeatureCommand.js';
export * from './commands/ImpactCommand.js';
export * from './commands/HistoryCommand.js';
export * from './commands/HealthCommand.js';
export * from './commands/UpdateCommand.js';
export * from './commands/InspectCommand.js';
export * from './commands/DoctorCommand.js';
export * from './commands/VersionCommand.js';
export * from './commands/HelpCommand.js';
export * from './commands/CompletionCommand.js';
export * from './commands/WorkspaceCommand.js';
export * from './commands/ProjectCommand.js';
export * from './commands/SearchCommand.js';
export * from './commands/MemoryCommand.js';
export * from './commands/CollaborationCommand.js';
export * from './commands/PlanCommand.js';
export * from './commands/FeedbackCommand.js';
export * from './commands/LearningCommand.js';
export * from './commands/PluginCommand.js';
export * from './commands/AnalyticsCommand.js';
export * from './commands/BenchmarkCommand.js';
export * from './commands/CompatibilityCommand.js';
export * from './commands/BackupCommand.js';

// Legacy compatibility
export * from './CommandRouter.js';
export * from './cli.js';
