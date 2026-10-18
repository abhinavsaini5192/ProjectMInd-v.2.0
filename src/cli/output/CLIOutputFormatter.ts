import type { CLIResult } from '../core/CLIResult.js';
import type { OutputFormat } from '../core/CLIContext.js';
import { LogRedactor } from '../../platform/logging/LogRedactor.js';

export class CLIOutputFormatter {
  public static format(result: CLIResult, format: OutputFormat): string {
    if (format === 'json') {
      return this.formatJson(result);
    }
    return this.formatText(result);
  }

  public static formatJson(result: CLIResult): string {
    // Redact sensitive patterns from JSON object before serialization
    const sanitized = LogRedactor.redactObject(result);
    return JSON.stringify(sanitized, null, 2);
  }

  public static formatText(rawResult: CLIResult): string {
    const result = LogRedactor.redactObject(rawResult);
    if (result.command === 'help' || result.command === 'completion') {
      const output = result.message ?? (result.data ? this.renderData(result.data) : '');
      return LogRedactor.redactString(output);
    }

    const lines: string[] = [];

    // Header banner
    if (result.success) {
      if (result.message) {
        lines.push(`\x1b[32m✓\x1b[0m ${result.message}`);
      }
    } else {
      lines.push(`\x1b[31m✗\x1b[0m ${result.message ?? 'Command failed'}`);
    }

    // Warnings
    if (result.warnings && result.warnings.length > 0) {
      lines.push('');
      for (const w of result.warnings) {
        lines.push(`\x1b[33m⚠\x1b[0m Warning: ${w}`);
      }
    }

    // Errors
    if (result.errors && result.errors.length > 0 && !result.success) {
      lines.push('');
      for (const e of result.errors) {
        lines.push(`\x1b[31m✗\x1b[0m Error: ${e}`);
      }
    }

    // Render Data payload if present
    if (result.data !== undefined && result.data !== null) {
      lines.push('');
      lines.push(this.renderData(result.data));
    }

    // Metadata in debug/verbose
    if (result.metadata && Object.keys(result.metadata).length > 0) {
      lines.push('');
      lines.push('\x1b[90mMetadata:\x1b[0m');
      for (const [k, v] of Object.entries(result.metadata)) {
        lines.push(`  \x1b[90m${k}:\x1b[0m ${String(v)}`);
      }
    }

    const output = lines.join('\n');
    return LogRedactor.redactString(output);
  }

  private static renderData(data: unknown, indent = 0): string {
    const prefix = ' '.repeat(indent);

    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
      return `${prefix}${data}`;
    }

    if (Array.isArray(data)) {
      if (data.length === 0) return `${prefix}(empty)`;
      return data
        .map((item) => {
          if (typeof item === 'object' && item !== null) {
            return `${prefix}- \n${this.renderData(item, indent + 2)}`;
          }
          return `${prefix}- ${String(item)}`;
        })
        .join('\n');
    }

    if (typeof data === 'object' && data !== null) {
      const entries = Object.entries(data as Record<string, unknown>);
      if (entries.length === 0) return `${prefix}(empty)`;

      return entries
        .map(([k, v]) => {
          const keyLabel = `\x1b[1m${this.humanizeKey(k)}:\x1b[0m`;
          if (typeof v === 'object' && v !== null) {
            return `${prefix}${keyLabel}\n${this.renderData(v, indent + 2)}`;
          }
          return `${prefix}${keyLabel} ${String(v)}`;
        })
        .join('\n');
    }

    return `${prefix}${String(data)}`;
  }

  private static humanizeKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, ' ')
      .trim();
  }
}
