# ProjectMind CLI Platform (Phase 9.1)

The **ProjectMind CLI** is a first-class, lightweight developer-experience interface to the ProjectMind platform. It provides engineers, automated CI/CD pipelines, and coding agents with local command-line access to repository intelligence, feature tracking, change impact analysis, context orchestration, and system diagnostics.

## Core Architectural Principle

The CLI is strictly an **interface and presentation layer**. It does **NOT** duplicate or reimplement domain intelligence, graph analysis, persistence, or background jobs.

```
Developer / CI / Agent
        │
        ▼
   ProjectMind CLI
        │
        ▼
Canonical Application & Service Layer
 (ProjectMindKernel, ProductionBootstrap, AgentRuntime)
        │
        ▼
Platform Domain, Graph, Security, Persistence, Observability
```

### Architectural Boundaries

- **CLI Decides:**
  - Command requested and argument parsing
  - Text, JSON, and table presentation formatting
  - Interactive vs non-interactive execution mode
  - Sanitization and secret redaction on all emitted outputs
  - Stable exit code mapping

- **Underlying Services Decide:**
  - What features exist and how code symbols map to them
  - How context packages are composed and budgeted
  - What downstream files are affected by code changes
  - What updates are committed to the knowledge graph
  - Who is authenticated and authorized to access workspaces

## Directory Structure

```
src/cli/
├── commands/            # Standard and extension command implementations
│   ├── AnalyzeCommand.ts
│   ├── BenchmarkCommand.ts
│   ├── CompatibilityCommand.ts
│   ├── CompletionCommand.ts
│   ├── ContextCommand.ts
│   ├── DoctorCommand.ts
│   ├── FeatureCommand.ts
│   ├── HealthCommand.ts
│   ├── HelpCommand.ts
│   ├── HistoryCommand.ts
│   ├── ImpactCommand.ts
│   ├── InitCommand.ts
│   ├── InspectCommand.ts
│   ├── PluginCommand.ts
│   ├── StatusCommand.ts
│   ├── UpdateCommand.ts
│   └── VersionCommand.ts
├── core/                # CLI core abstractions
│   ├── CLIApplication.ts
│   ├── CLICommand.ts
│   ├── CLIContext.ts
│   ├── CLIExitCode.ts
│   ├── CLIResult.ts
│   └── CommandRegistry.ts
├── errors/              # Domain-to-CLI error translation
│   ├── CLIError.ts
│   └── CLIErrorHandler.ts
├── output/              # Formatting and secret redaction
│   └── CLIOutputFormatter.ts
├── completion/          # Shell completion generator
│   └── ShellCompletionGenerator.ts
├── cli.ts               # Programmatic CLI entry point
├── CommandRouter.ts     # Backward-compatible command router
└── index.ts             # Public barrel exports
```

## Quick Start

```bash
# Initialize current workspace
projectmind init

# Check repository and platform status
projectmind status

# Generate explainable context for a task
projectmind context "fix token timeout in auth"

# Inspect feature mappings
projectmind feature show feat-auth

# Check downstream change impact
projectmind impact src/auth/TokenService.ts

# Verify platform health and diagnostics
projectmind doctor
```

## Documentation Roadmap

- [CLI Guide](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/cli/CLI_GUIDE.md)
- [CLI Command Reference](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/cli/CLI_COMMAND_REFERENCE.md)
- [CLI Configuration](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/cli/CLI_CONFIGURATION.md)
- [CLI Troubleshooting](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/cli/CLI_TROUBLESHOOTING.md)
- [CLI Output Format](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/docs/cli/CLI_OUTPUT_FORMAT.md)
