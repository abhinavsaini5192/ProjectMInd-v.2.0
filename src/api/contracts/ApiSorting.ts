export type SortDirection = 'asc' | 'desc';

export interface SortField {
  readonly field: string;
  readonly direction: SortDirection;
}

export function parseSortParams(
  sortParam: string | undefined,
  allowedFields: readonly string[],
  defaultSort?: SortField | undefined
): readonly SortField[] {
  if (!sortParam || sortParam.trim().length === 0) {
    return defaultSort ? [defaultSort] : [];
  }

  const allowedSet = new Set(allowedFields);
  const parts = sortParam.split(',').map((p) => p.trim());
  const results: SortField[] = [];

  for (const part of parts) {
    if (!part) continue;
    let direction: SortDirection = 'asc';
    let field = part;

    if (field.startsWith('-')) {
      direction = 'desc';
      field = field.substring(1);
    } else if (field.startsWith('+')) {
      direction = 'asc';
      field = field.substring(1);
    }

    if (allowedSet.has(field)) {
      results.push({ field, direction });
    }
  }

  if (results.length === 0 && defaultSort) {
    return [defaultSort];
  }

  return results;
}
