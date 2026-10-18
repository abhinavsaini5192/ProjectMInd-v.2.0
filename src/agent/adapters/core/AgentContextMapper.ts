import type { IAgentContextMapper, ContextMappingOptions } from '../interfaces/IAgentContextMapper.js';
import type { ContextPackage } from '../../../context/models/ContextPackage.js';
import type { AdapterContext, AdapterContextFormat } from '../models/AdapterContext.js';

export class AgentContextMapper implements IAgentContextMapper {
  public mapContext(
    context: ContextPackage,
    options: ContextMappingOptions = {}
  ): AdapterContext {
    const requestedFormat = (options.format ?? 'markdown').toLowerCase();
    let format: AdapterContextFormat = 'MARKDOWN';
    let content: unknown;

    switch (requestedFormat) {
      case 'json':
      case 'structured_json':
        format = 'STRUCTURED_JSON';
        content = this.formatJson(context, options);
        break;
      case 'xml':
      case 'xml_tagged':
        format = 'XML_TAGGED';
        content = this.formatXml(context, options);
        break;
      case 'raw':
        format = 'RAW';
        content = context;
        break;
      case 'yaml':
      case 'markdown':
      default:
        format = 'MARKDOWN';
        content = this.formatMarkdown(context, options);
        break;
    }

    const warnings = (context.warnings ?? []).map((w) =>
      typeof w === 'string' ? w : (w as any).message ?? JSON.stringify(w)
    );

    const confidence = context.completeness?.score ?? 1.0;
    const completeness = context.completeness?.level ?? 'FULL';
    const freshness = context.freshness?.status ?? 'CURRENT';

    const featureIds = (context.features ?? []).map((f: any) => f.id ?? f.name ?? '');
    const resourcePaths = (context.resources ?? []).map((r: any) => r.path ?? r.uri ?? '');

    return {
      format,
      content,
      knowledgeVersion: context.version?.knowledgeVersion,
      freshness,
      confidence,
      completeness,
      warnings,
      featureIds,
      resourcePaths,
      metadata: {
        packageId: context.packageId,
        estimatedTokens: context.estimatedTokens ?? (typeof content === 'string' ? Math.ceil(content.length / 4) : 0),
      },
    };
  }

  private formatMarkdown(context: ContextPackage, options: ContextMappingOptions): string {
    if (context.compiledPromptText && !options.includeArchitecture && !options.includeHealth) {
      return context.compiledPromptText;
    }

    const sections: string[] = [];

    sections.push(`# Repository Context [Package: ${context.packageId}]`);
    if (context.task?.text) {
      sections.push(`## Task\n${context.task.text}`);
    }

    if (context.features && context.features.length > 0) {
      sections.push(`## Active Features\n${context.features.map((f: any) => `- **${f.name ?? f.id}**: ${f.description ?? ''}`).join('\n')}`);
    }

    if (context.resources && context.resources.length > 0) {
      sections.push(`## Relevant Files & Resources\n${context.resources.map((r: any) => `- \`${r.path ?? r.uri}\` (${r.type ?? 'file'})`).join('\n')}`);
    }

    if (options.includeArchitecture && context.architecture) {
      sections.push(`## Architectural Context\n\`\`\`json\n${JSON.stringify(context.architecture, null, 2)}\n\`\`\``);
    }

    if (options.includeHealth && context.health) {
      sections.push(`## Repository Health & Risks\n\`\`\`json\n${JSON.stringify(context.health, null, 2)}\n\`\`\``);
    }

    if (options.includeImpact && context.impact) {
      sections.push(`## Predicted Impact\n\`\`\`json\n${JSON.stringify(context.impact, null, 2)}\n\`\`\``);
    }

    if (options.includeHistory && context.history && context.history.length > 0) {
      sections.push(`## Execution History\n${context.history.map((h: any) => `- [${h.timestamp ?? ''}] ${h.summary ?? JSON.stringify(h)}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  private formatJson(context: ContextPackage, _options: ContextMappingOptions): Record<string, unknown> {
    return {
      packageId: context.packageId,
      task: context.task,
      features: context.features,
      resources: context.resources,
      architecture: context.architecture,
      health: context.health,
      impact: context.impact,
      warnings: context.warnings,
      freshness: context.freshness,
      completeness: context.completeness,
    };
  }

  private formatXml(context: ContextPackage, options: ContextMappingOptions): string {
    const parts: string[] = [];
    parts.push(`<repository_context package_id="${context.packageId}">`);
    if (context.task?.text) {
      parts.push(`  <task><![CDATA[${context.task.text}]]></task>`);
    }

    if (context.features && context.features.length > 0) {
      parts.push('  <features>');
      for (const f of context.features as any[]) {
        parts.push(`    <feature id="${f.id ?? ''}" name="${f.name ?? ''}">${f.description ?? ''}</feature>`);
      }
      parts.push('  </features>');
    }

    if (context.resources && context.resources.length > 0) {
      parts.push('  <resources>');
      for (const r of context.resources as any[]) {
        parts.push(`    <resource path="${r.path ?? r.uri ?? ''}" type="${r.type ?? 'file'}" />`);
      }
      parts.push('  </resources>');
    }

    if (options.includeArchitecture && context.architecture) {
      parts.push(`  <architecture><![CDATA[${JSON.stringify(context.architecture)}]]></architecture>`);
    }

    parts.push('</repository_context>');
    return parts.join('\n');
  }
}
