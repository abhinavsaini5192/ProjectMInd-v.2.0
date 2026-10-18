import type { BehaviorContext, IFeatureBehaviorSource } from '../interfaces/IFeatureBehaviorSource';
import type { FeatureBehaviorCandidate } from '../models/FeatureBehaviorCandidate';
import { BehaviorSourceHelper } from './BehaviorSourceHelper';

export class EntryPointSource implements IFeatureBehaviorSource {
  public readonly sourceId = 'ENTRY_POINT_SOURCE';
  public readonly sourceType = 'ARCHITECTURAL';
  public readonly priority = 100;

  public async extractBehavior(context: BehaviorContext): Promise<FeatureBehaviorCandidate[]> {
    const candidates: FeatureBehaviorCandidate[] = [];
    const featureId = context.feature.id;

    // 1. Mapped ENDPOINT resources
    const endpointMappings = BehaviorSourceHelper.getMappedResourcesByType(context.mappings, 'ENDPOINT');
    for (const m of endpointMappings) {
      const evidence = BehaviorSourceHelper.createEvidence(
        this.sourceType,
        this.sourceId,
        'MAPPED_ENDPOINT',
        `Endpoint mapping ${m.resourceId} for feature ${context.feature.name}`,
        m.score ?? 0.9,
        { mappingId: m.mappingId, resourceId: m.resourceId }
      );

      const method = m.metadata?.method || 'POST';
      const route = m.metadata?.path || m.resourceId;

      const node = BehaviorSourceHelper.createNode(
        m.resourceId,
        'ENDPOINT',
        'ENTRY_POINT',
        `${method} ${route}`,
        {
          entryPointType: 'API',
          method,
          route,
          operation: `${method} ${route}`,
        },
        m.score ?? 0.9
      );

      candidates.push(
        BehaviorSourceHelper.createCandidate(
          featureId,
          `API Entry: ${method} ${route}`,
          'API',
          [node],
          [],
          [evidence],
          this.sourceId,
          node.confidence,
          { entryPointType: 'API', route, method }
        )
      );
    }

    // 2. Extraction endpoints if available
    if (context.extraction?.endpoints) {
      for (const ep of context.extraction.endpoints) {
        // Match by resourceId or path
        const isMapped = endpointMappings.some(
          m => m.resourceId === ep.id || m.resourceId === ep.path || ep.path?.includes(m.resourceId)
        );
        const nameMatches = ep.path?.toLowerCase().includes(context.feature.name.toLowerCase());

        if (isMapped || nameMatches) {
          // Avoid duplicate if already added
          const alreadyAdded = candidates.some(c => c.nodes.some(n => n.resourceId === (ep.id || ep.path)));
          if (!alreadyAdded) {
            const ev = BehaviorSourceHelper.createEvidence(
              this.sourceType,
              this.sourceId,
              'EXTRACTION_ENDPOINT',
              `Extracted endpoint ${ep.method || 'POST'} ${ep.path}`,
              0.85,
              { endpoint: ep }
            );

            const node = BehaviorSourceHelper.createNode(
              ep.id || ep.path,
              'ENDPOINT',
              'ENTRY_POINT',
              `${ep.method || 'POST'} ${ep.path}`,
              {
                entryPointType: 'API',
                method: ep.method || 'POST',
                route: ep.path,
                operation: `${ep.method || 'POST'} ${ep.path}`,
              },
              0.85
            );

            candidates.push(
              BehaviorSourceHelper.createCandidate(
                featureId,
                `API Entry: ${ep.method || 'POST'} ${ep.path}`,
                'API',
                [node],
                [],
                [ev],
                this.sourceId,
                0.85,
                { entryPointType: 'API', route: ep.path, method: ep.method }
              )
            );
          }
        }
      }
    }

    // 3. Mapped COMMAND resources (CLI entry points)
    const commandMappings = BehaviorSourceHelper.getMappedResourcesByType(context.mappings, 'COMMAND');
    for (const m of commandMappings) {
      const ev = BehaviorSourceHelper.createEvidence(
        this.sourceType,
        this.sourceId,
        'MAPPED_COMMAND',
        `Command mapping ${m.resourceId}`,
        0.85
      );
      const node = BehaviorSourceHelper.createNode(
        m.resourceId,
        'COMMAND',
        'ENTRY_POINT',
        `Command: ${m.resourceId}`,
        { entryPointType: 'CLI', command: m.resourceId },
        0.85
      );
      candidates.push(
        BehaviorSourceHelper.createCandidate(
          featureId,
          `CLI Entry: ${m.resourceId}`,
          'PRIMARY',
          [node],
          [],
          [ev],
          this.sourceId,
          0.85
        )
      );
    }

    // 4. Mapped UI_COMPONENT resources (UI actions)
    const uiMappings = BehaviorSourceHelper.getMappedResourcesByType(context.mappings, 'UI_COMPONENT');
    for (const m of uiMappings) {
      const ev = BehaviorSourceHelper.createEvidence(
        this.sourceType,
        this.sourceId,
        'MAPPED_UI_COMPONENT',
        `UI Component ${m.resourceId}`,
        0.8
      );
      const node = BehaviorSourceHelper.createNode(
        m.resourceId,
        'UI_COMPONENT',
        'ENTRY_POINT',
        `UI Component: ${m.resourceId}`,
        { entryPointType: 'UI' },
        0.8
      );
      candidates.push(
        BehaviorSourceHelper.createCandidate(
          featureId,
          `UI Entry: ${m.resourceId}`,
          'PRIMARY',
          [node],
          [],
          [ev],
          this.sourceId,
          0.8
        )
      );
    }

    return candidates;
  }
}
