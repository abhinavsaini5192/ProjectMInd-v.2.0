import { describe, it, expect } from 'vitest';
import {
  parsePaginationParams,
  encodeCursor,
  decodeCursor,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../../src/api/contracts/ApiPagination.js';
import { parseFilterParams } from '../../src/api/contracts/ApiFilter.js';
import { parseSortParams } from '../../src/api/contracts/ApiSorting.js';
import { ResponseService } from '../../src/api/services/ResponseService.js';
import type { ApiRequestContext } from '../../src/api/contracts/ApiRequestContext.js';

describe('API Pagination, Filtering, and Sorting', () => {
  const dummyContext: ApiRequestContext = {
    requestId: 'req-1',
    correlationId: 'corr-1',
    apiVersion: 'v1',
    receivedAt: Date.now() - 15,
    principal: {
      principalId: 'p-1',
      identityId: 'i-1',
      type: 'USER',
      status: 'ACTIVE',
      authenticationMethod: 'API_KEY',
      createdAt: new Date().toISOString(),
    },
    securityContext: {
      principal: {
        principalId: 'p-1',
        identityId: 'i-1',
        type: 'USER',
        status: 'ACTIVE',
        authenticationMethod: 'API_KEY',
        createdAt: new Date().toISOString(),
      },
      permissions: [],
      capabilities: [],
      authenticationMethod: 'API_KEY',
      trustLevel: 'VERIFIED',
      createdAt: new Date().toISOString(),
    },
  };

  describe('Pagination', () => {
    it('uses defaults when query parameters are absent', () => {
      const params = parsePaginationParams({});
      expect(params.limit).toBe(DEFAULT_PAGE_LIMIT);
      expect(params.cursor).toBeUndefined();
      expect(params.direction).toBe('forward');
    });

    it('clamps limit to MAX_PAGE_LIMIT to prevent unbounded memory usage', () => {
      const params = parsePaginationParams({ limit: '5000' });
      expect(params.limit).toBe(MAX_PAGE_LIMIT);
    });

    it('correctly parses custom valid limit and backward direction', () => {
      const params = parsePaginationParams({ limit: '35', direction: 'backward', cursor: 'curs-abc' });
      expect(params.limit).toBe(35);
      expect(params.direction).toBe('backward');
      expect(params.cursor).toBe('curs-abc');
    });

    it('encodes and decodes pagination cursor payloads accurately', () => {
      const payload = { lastId: 'item-99', timestamp: 1700000000 };
      const encoded = encodeCursor(payload);
      expect(typeof encoded).toBe('string');
      expect(encoded).not.toContain('{');

      const decoded = decodeCursor<typeof payload>(encoded);
      expect(decoded.lastId).toBe('item-99');
      expect(decoded.timestamp).toBe(1700000000);
    });

    it('builds standard paginated response envelope using ResponseService', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const paginationParams = { limit: 3, direction: 'forward' as const };

      const response = ResponseService.paginated(dummyContext, items, paginationParams, {
        hasMore: true,
        totalCount: 10,
        cursorGenerator: (item) => ({ id: item.id }),
      });

      expect(response.status).toBe(200);
      expect(response.data.length).toBe(3);
      expect(response.meta.pagination.hasMore).toBe(true);
      expect(response.meta.pagination.totalCount).toBe(10);
      expect(response.meta.pagination.nextCursor).toBeDefined();
    });
  });

  describe('Filtering', () => {
    it('parses allowed filter fields and discards unauthorized fields', () => {
      const allowedFields = ['status', 'severity', 'type'];
      const query = {
        'filter[status]': 'ACTIVE',
        'filter[severity][gte]': '3',
        'disallowed_field': 'malicious_input',
        'filter[sql_injection]': "'; DROP TABLE users; --",
      };

      const filter = parseFilterParams(query, allowedFields);
      expect(filter.rules.length).toBe(2);

      const statusRule = filter.rules.find((r) => r.field === 'status');
      expect(statusRule).toBeDefined();
      expect(statusRule?.operator).toBe('eq');
      expect(statusRule?.value).toBe('ACTIVE');

      const severityRule = filter.rules.find((r) => r.field === 'severity');
      expect(severityRule).toBeDefined();
      expect(severityRule?.operator).toBe('gte');
      expect(severityRule?.value).toBe('3');

      // Unauthorized fields are strictly not included
      expect(filter.rules.find((r) => r.field === 'sql_injection')).toBeUndefined();
      expect(filter.rules.find((r) => r.field === 'disallowed_field')).toBeUndefined();
    });

    it('parses in-list filters into arrays', () => {
      const filter = parseFilterParams(
        { 'filter[category][in]': 'SECURITY,PERFORMANCE,HEALTH' },
        ['category']
      );

      expect(filter.rules[0]?.operator).toBe('in');
      expect(Array.isArray(filter.rules[0]?.value)).toBe(true);
      expect(filter.rules[0]?.value).toEqual(['SECURITY', 'PERFORMANCE', 'HEALTH']);
    });
  });

  describe('Sorting', () => {
    it('parses sort parameter into ordered SortField specifications', () => {
      const allowedSortFields = ['createdAt', 'priority', 'name'];
      const sortParam = '-priority,+createdAt,unknownField';

      const sortFields = parseSortParams(sortParam, allowedSortFields);
      expect(sortFields.length).toBe(2);
      expect(sortFields[0]).toEqual({ field: 'priority', direction: 'desc' });
      expect(sortFields[1]).toEqual({ field: 'createdAt', direction: 'asc' });
    });

    it('falls back to default sort when no sort fields provided', () => {
      const defaultSort = { field: 'createdAt', direction: 'desc' as const };
      const sortFields = parseSortParams(undefined, ['createdAt'], defaultSort);
      expect(sortFields).toEqual([defaultSort]);
    });
  });
});
