export type FilterOperator = 'eq' | 'neq' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte';

export interface FilterRule {
  readonly field: string;
  readonly operator: FilterOperator;
  readonly value: unknown;
}

export interface ApiFilter {
  readonly rules: readonly FilterRule[];
  readonly logic: 'and' | 'or';
}

export function parseFilterParams(
  query: Record<string, string | undefined>,
  allowedFields: readonly string[]
): ApiFilter {
  const rules: FilterRule[] = [];
  const allowedSet = new Set(allowedFields);

  for (const [key, rawVal] of Object.entries(query)) {
    if (rawVal === undefined || rawVal === '') continue;
    // Format could be: filter[fieldName]=val or fieldName=val
    let field = key;
    let op: FilterOperator = 'eq';

    const match = key.match(/^filter\[([a-zA-Z0-9_.-]+)\](?:\[([a-z]+)\])?$/);
    if (match) {
      field = match[1]!;
      if (match[2]) {
        const parsedOp = match[2] as FilterOperator;
        if (['eq', 'neq', 'in', 'contains', 'gt', 'gte', 'lt', 'lte'].includes(parsedOp)) {
          op = parsedOp;
        }
      }
    }

    if (allowedSet.has(field)) {
      let val: unknown = rawVal;
      if (op === 'in') {
        val = rawVal.split(',').map((s) => s.trim());
      }
      rules.push({ field, operator: op, value: val });
    }
  }

  return {
    rules,
    logic: 'and',
  };
}
