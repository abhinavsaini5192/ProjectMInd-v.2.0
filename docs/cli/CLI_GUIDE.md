# ProjectMind CLI Developer Guide

This guide details how to install, configure, and use the ProjectMind command-line interface in local development and automated CI/CD workflows.

## 1. Installation & Binary Setup

The ProjectMind CLI is available as an executable command inside the project repository.

### Local Package Linking
```bash
# Link the CLI binary globally
npm link

# Verify installation
projectmind --version
```

### Running Directly via Node
```bash
# Run launcher binary
node bin/projectmind.js status

# Run via npm script
npm run cli
```

## 2. Core Developer Workflows

### Initializing a Workspace
Before ProjectMind can track code, symbols, and features, the repository must be initialized:

```bash
# Initialize current directory
projectmind init

# Initialize with custom project name
projectmind init --name "PaymentGateway"

# Force re-initialization
projectmind init --force
```

Initialization creates `.projectmind/config.json` and prepares the SQLite metadata state without mutating Git history.

### Querying Agent Context
When assigning a task to an AI coding agent or planning refactoring, use `projectmind context`:

```bash
# Get context for a free-form coding task
projectmind context "add oauth2 refresh token rotation"

# Target a specific feature
projectmind context --feature feat-auth

# Set a custom token budget
projectmind context "optimize database queries" --budget 8000 --json
```

The output contains relevant features, prioritized file paths, dependency relations, and token-budget metrics.

### Evaluating Change Impact
Before modifying or deleting code, inspect the blast radius:

```bash
# Check impact of editing a specific service file
projectmind impact src/auth/TokenService.ts

# Traverse dependencies up to depth 3
projectmind impact src/storage/DatabaseAdapter.ts --depth 3 --json
```

### System Health and Verification
```bash
# High-level platform health check
projectmind health

# Detailed doctor diagnostics
projectmind doctor
```

## 3. Automation and CI/CD Pipelines

All ProjectMind commands support non-interactive execution with machine-readable JSON output:

```bash
# In CI build script
projectmind doctor --json > doctor-report.json

# Check exit code
if [ $? -ne 0 ]; then
  echo "ProjectMind health checks failed!"
  exit 1
fi
```

### Non-Interactive Guarantee
Commands will never prompt for terminal input unless explicitly designed for interactive scaffolding. Running commands in automated containers or GitHub Actions is fully supported.

## 4. Shell Completion

Enable autocompletion for commands and options in your favorite shell:

### Bash
```bash
projectmind completion bash > /etc/bash_completion.d/projectmind
```

### Zsh
```zsh
projectmind completion zsh > "${fpath[1]}/_projectmind"
```

### Fish
```fish
projectmind completion fish > ~/.config/fish/completions/projectmind.fish
```

### PowerShell
```powershell
projectmind completion powershell | Out-String | Invoke-Expression
```
