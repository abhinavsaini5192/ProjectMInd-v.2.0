import type { ContextFormat } from '../models/ContextFormat.js';
import type { ContextAdapterRequest } from '../models/ContextAdapterRequest.js';
import type { ContextAdapterResponse } from '../models/ContextAdapterResponse.js';
import { ModelContextAdapter } from './ModelContextAdapter.js';

export class AnthropicContextAdapter extends ModelContextAdapter {
  public readonly format: ContextFormat = 'claude-xml';

  public formatContext(request: ContextAdapterRequest): ContextAdapterResponse {
    const pkg = request.package;
    const lines: string[] = [];
    const sectionsFormatted: string[] = [];

    lines.push('<project_mind_context>');

    if (pkg.task.text) {
      lines.push(`  <task_context>${pkg.task.text}</task_context>`);
    }

    if (pkg.features.length > 0) {
      sectionsFormatted.push('IDENTITY');
      lines.push('  <target_features>');
      for (const feat of pkg.features) {
        lines.push(`    <feature id="${feat.featureId}" name="${feat.name}" role="${feat.role}">`);
        if (feat.description) lines.push(`      <description>${feat.description}</description>`);
        if (feat.entryPoints.length > 0) {
          lines.push(`      <entry_points>${feat.entryPoints.join(', ')}</entry_points>`);
        }
        if (feat.primaryFlows.length > 0) {
          lines.push(`      <primary_flows>${feat.primaryFlows.join(', ')}</primary_flows>`);
        }
        lines.push('    </feature>');
      }
      lines.push('  </target_features>');
    }

    if (pkg.resources.length > 0) {
      sectionsFormatted.push('RESOURCES');
      lines.push('  <relevant_resources>');
      for (const res of pkg.resources) {
        const path = res.filePath ?? res.resourceId;
        const symAttr = res.symbolName ? ` symbol="${res.symbolName}"` : '';
        lines.push(`    <resource path="${path}" role="${res.role}" feature="${res.featureId}"${symAttr}>`);
        if (res.snippet) {
          lines.push(`      <![CDATA[\n${res.snippet}\n      ]]>`);
        }
        lines.push('    </resource>');
      }
      lines.push('  </relevant_resources>');
    }

    if (pkg.behavior.length > 0) {
      sectionsFormatted.push('BEHAVIOR');
      lines.push('  <behavior_flows>');
      for (const flow of pkg.behavior) {
        const name = typeof flow === 'string' ? flow : flow.name ?? flow.flowId;
        lines.push(`    <flow name="${name}" />`);
      }
      lines.push('  </behavior_flows>');
    }

    if (pkg.dependencies.length > 0) {
      sectionsFormatted.push('DEPENDENCIES');
      lines.push('  <dependencies>');
      for (const dep of pkg.dependencies) {
        lines.push(`    <dependency source="${dep.sourceFeatureId}" target="${dep.targetFeatureId}" type="${dep.relationshipType}" />`);
      }
      lines.push('  </dependencies>');
    }

    if (pkg.health?.activeRisks && pkg.health.activeRisks.length > 0) {
      sectionsFormatted.push('HEALTH');
      lines.push('  <risks>');
      for (const risk of pkg.health.activeRisks) {
        const rDesc = typeof risk === 'string' ? risk : `${risk.severity}: ${risk.description}`;
        lines.push(`    <risk>${rDesc}</risk>`);
      }
      lines.push('  </risks>');
    }

    if (pkg.warnings.length > 0) {
      sectionsFormatted.push('WARNINGS');
      lines.push('  <warnings>');
      for (const w of pkg.warnings) {
        lines.push(`    <warning type="${w.type}">${w.message}</warning>`);
      }
      lines.push('  </warnings>');
    }

    lines.push('</project_mind_context>');

    const formattedContent = lines.join('\n');
    const estimatedTokens = this.estimateTokens(formattedContent);

    return {
      formattedContent,
      format: this.format,
      estimatedTokens,
      sectionsFormatted,
      metadata: {
        packageId: pkg.packageId,
        generatedAt: pkg.generatedAt,
      },
    };
  }
}
