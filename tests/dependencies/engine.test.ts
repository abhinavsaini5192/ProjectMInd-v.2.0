import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyEngine } from '../../src/knowledge/dependencies/core/DependencyEngine';
import { DependencyRegistry } from '../../src/knowledge/dependencies/core/DependencyRegistry';
import { DependencyExtractor } from '../../src/knowledge/dependencies/core/DependencyExtractor';
import { DependencyResolver } from '../../src/knowledge/dependencies/core/DependencyResolver';
import { DependencyGraphBuilder } from '../../src/knowledge/dependencies/core/DependencyGraphBuilder';
import { ArchitectureRuleEngine, ArchitectureRule } from '../../src/knowledge/dependencies/core/ArchitectureRuleEngine';
import { ArchitectureAnalyzer } from '../../src/knowledge/dependencies/core/ArchitectureAnalyzer';
import { LayerAnalyzer } from '../../src/knowledge/dependencies/core/LayerAnalyzer';
import { DependencyValidator } from '../../src/knowledge/dependencies/validation/DependencyValidator';
import { CouplingAnalyzer } from '../../src/knowledge/dependencies/core/CouplingAnalyzer';
import { KernelEventDispatcher } from '../../src/kernel/core/KernelEventDispatcher';
import { Relationship } from '../../src/knowledge/relationships/models/Relationship';
import { RelationshipType } from '../../src/knowledge/relationships/models/RelationshipType';
import { ViolationSeverity } from '../../src/knowledge/dependencies/models/ArchitectureViolation';

describe('Dependency Intelligence Engine', () => {
  let engine: DependencyEngine;
  let registry: DependencyRegistry;
  let dispatcher: KernelEventDispatcher;
  let ruleEngine: ArchitectureRuleEngine;
  let resolver: DependencyResolver;
  let builder: DependencyGraphBuilder;

  beforeEach(() => {
    registry = new DependencyRegistry();
    const extractor = new DependencyExtractor();
    resolver = new DependencyResolver(registry);
    builder = new DependencyGraphBuilder();
    ruleEngine = new ArchitectureRuleEngine();
    const layerAnalyzer = new LayerAnalyzer();
    const archAnalyzer = new ArchitectureAnalyzer(ruleEngine, layerAnalyzer);
    const validator = new DependencyValidator();
    dispatcher = new KernelEventDispatcher();

    engine = new DependencyEngine(registry, extractor, resolver, builder, archAnalyzer, validator, dispatcher);
  });

  const createMockRelationship = (sourceId: string, targetId: string, type: RelationshipType): Relationship => ({
    id: `${sourceId}_${type}_${targetId}`,
    sourceId,
    targetId,
    type,
    direction: 'directed',
    confidence: 1.0,
    weight: 1.0,
    version: 1,
    evidence: [{ description: 'mock', confidenceScore: 1.0 }],
    metadata: {},
    history: [],
    created: 1,
    updated: 1
  });

  it('should extract semantic dependencies from relationships', () => {
    const r1 = createMockRelationship('sym_A', 'sym_B', RelationshipType.Imports);
    
    engine.processRelationships([r1]);

    const outDeps = resolver.findDependencies('sym_A');
    expect(outDeps.length).toBe(1);
    expect(outDeps[0].targetId).toBe('sym_B');
    expect(outDeps[0].category).toBe('Module'); // Imports maps to Module
    expect(outDeps[0].confidence).toBe(1.0);
  });

  it('should calculate Coupling Metrics (Fan-in / Fan-out / Instability)', () => {
    // A -> B, A -> C (A has 2 fan-out, 0 fan-in)
    const r1 = createMockRelationship('sym_A', 'sym_B', RelationshipType.Calls);
    const r2 = createMockRelationship('sym_A', 'sym_C', RelationshipType.Calls);
    // D -> A (A has 1 fan-in)
    const r3 = createMockRelationship('sym_D', 'sym_A', RelationshipType.Calls);
    
    engine.processRelationships([r1, r2, r3]);

    const coupling = new CouplingAnalyzer(registry);
    const metricsA = coupling.calculateMetrics('sym_A');

    expect(metricsA.efferentCoupling).toBe(2); // Fan-out
    expect(metricsA.afferentCoupling).toBe(1); // Fan-in
    // Instability = Ce / (Ca + Ce) = 2 / (1 + 2) = 0.666
    expect(metricsA.instability).toBeCloseTo(0.666);
  });

  it('should detect architecture violations via the Rule Engine (Circular Dependency)', () => {
    // A -> B -> C -> A
    const r1 = createMockRelationship('sym_A', 'sym_B', RelationshipType.Calls);
    const r2 = createMockRelationship('sym_B', 'sym_C', RelationshipType.Calls);
    const r3 = createMockRelationship('sym_C', 'sym_A', RelationshipType.Calls);

    // Write a mock Circular Rule
    const cycleRule: ArchitectureRule = {
      name: 'CycleDetector',
      evaluate: (reg) => {
        const violations = [];
        const allDeps = reg.getAllDependencies();
        
        for (const dep of allDeps) {
           const chain = builder.buildChain(dep.sourceId, allDeps, (id) => reg.getOutEdges(id).map(e => reg.getDependency(e)!));
           if (chain.isCircular) {
             violations.push({
               id: 'vio_1',
               ruleName: 'CycleDetector',
               type: 'CircularDependency',
               severity: ViolationSeverity.High,
               path: chain.path,
               description: 'Cycle found'
             });
             break; // Found one
           }
        }
        return violations;
      }
    };

    ruleEngine.registerRule(cycleRule);

    let violationFired = false;
    dispatcher.subscribe('ArchitectureViolationDetected', (v) => {
       if (v.type === 'CircularDependency') violationFired = true;
    });

    engine.processRelationships([r1, r2, r3]);

    expect(violationFired).toBe(true);
  });
});
