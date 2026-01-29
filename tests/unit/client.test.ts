/**
 * Tests unitaires pour le client OVH
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OvhClient } from '../../src/ovh/client.js';
import { OvhApiError, TimeoutError } from '../../src/ovh/errors.js';
import { AuthProvider } from '../../src/ovh/auth/provider.js';

// Mock fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock du logger
vi.mock('../../src/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }),
}));

// Mock AuthProvider
const mockAuthProvider: AuthProvider = {
  name: 'MockAuth',
  isConfigured: () => true,
  getHeaders: vi.fn().mockResolvedValue({
    Authorization: 'Bearer test-token',
    'Content-Type': 'application/json',
  }),
};

describe('OvhClient', () => {
  let client: OvhClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OvhClient({
      baseUrl: 'https://eu.api.ovh.com/v1',
      authProvider: mockAuthProvider,
      timeoutMs: 5000,
      maxRetries: 2,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('GET requests', () => {
    it('should make a successful GET request', async () => {
      const mockData = ['service1', 'service2'];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => mockData,
      });

      const response = await client.get<string[]>('/hosting/web');

      expect(response.data).toEqual(mockData);
      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://eu.api.ovh.com/v1/hosting/web',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should include query parameters in URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
      });

      await client.get('/hosting/web/test/database', {
        query: { mode: 'classic', active: true },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('mode=classic'),
        expect.anything()
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('active=true'),
        expect.anything()
      );
    });
  });

  describe('POST requests', () => {
    it('should make a successful POST request with body', async () => {
      const mockResponse = { id: 123, status: 'pending' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers(),
        json: async () => mockResponse,
      });

      const response = await client.post('/hosting/web/test/database', {
        body: { user: 'testuser', type: 'mysql' },
      });

      expect(response.data).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://eu.api.ovh.com/v1/hosting/web/test/database',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ user: 'testuser', type: 'mysql' }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should throw OvhApiError on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: 'Service not found' }),
      });

      await expect(
        client.get('/hosting/web/nonexistent', { skipRetry: true })
      ).rejects.toThrow(OvhApiError);
    });

    it('should include HTTP status in error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: 'Forbidden' }),
      });

      try {
        await client.get('/hosting/web/test', { skipRetry: true });
      } catch (error) {
        expect(error).toBeInstanceOf(OvhApiError);
        expect((error as OvhApiError).httpStatus).toBe(403);
      }
    });

    it('should retry on 5xx errors', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ success: true }),
        });

      const response = await client.get('/hosting/web');

      expect(response.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 429 rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Too Many Requests',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ success: true }),
        });

      const response = await client.get('/hosting/web');

      expect(response.data).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors (except 429)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      await expect(client.get('/hosting/web')).rejects.toThrow(OvhApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries limit', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      await expect(client.get('/hosting/web')).rejects.toThrow(OvhApiError);
      // Initial attempt + 2 retries = 3 calls
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should skip retries when skipRetry is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable',
      });

      await expect(
        client.get('/hosting/web', { skipRetry: true })
      ).rejects.toThrow(OvhApiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('toMcpError conversion', () => {
    it('should convert OvhApiError to MCP error format', () => {
      const error = new OvhApiError('Not found', 404, 'RESOURCE_NOT_FOUND', -32001, false);
      const mcpError = error.toMcpError();

      expect(mcpError.code).toBe(-32001);
      expect(mcpError.message).toBe('Not found');
      expect(mcpError.data).toEqual({
        httpStatus: 404,
        ovhErrorCode: 'RESOURCE_NOT_FOUND',
        retryable: false,
      });
    });
  });
});


