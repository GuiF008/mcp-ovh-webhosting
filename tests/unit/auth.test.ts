/**
 * Tests unitaires pour la couche d'authentification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuth2ServiceAccountProvider } from '../../src/ovh/auth/oauth2ServiceAccount.js';
import { AkAsCkSignatureProvider } from '../../src/ovh/auth/akAsCkSignature.js';
import { AuthError } from '../../src/ovh/auth/provider.js';

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
  initLogger: vi.fn(),
}));

describe('OAuth2ServiceAccountProvider', () => {
  const config = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    scope: 'all',
    tokenUrl: 'https://www.ovh.com/auth/oauth2/token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should be configured when all required fields are present', () => {
    const provider = new OAuth2ServiceAccountProvider(config);
    expect(provider.isConfigured()).toBe(true);
  });

  it('should not be configured when clientId is missing', () => {
    const provider = new OAuth2ServiceAccountProvider({
      ...config,
      clientId: '',
    });
    expect(provider.isConfigured()).toBe(false);
  });

  it('should fetch a new token and return Bearer header', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'test-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'all',
      }),
    });

    const provider = new OAuth2ServiceAccountProvider(config);
    const headers = await provider.getHeaders('GET', 'https://api.ovh.com/v1/test');

    expect(headers.Authorization).toBe('Bearer test-token-123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      config.tokenUrl,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    );
  });

  it('should use cached token for subsequent requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'cached-token',
        token_type: 'Bearer',
        expires_in: 3600,
      }),
    });

    const provider = new OAuth2ServiceAccountProvider(config);

    // First call - should fetch
    await provider.getHeaders('GET', 'https://api.ovh.com/v1/test1');
    // Second call - should use cache
    const headers = await provider.getHeaders('GET', 'https://api.ovh.com/v1/test2');

    expect(headers.Authorization).toBe('Bearer cached-token');
    expect(mockFetch).toHaveBeenCalledTimes(1); // Only one fetch call
  });

  it('should throw AuthError on token fetch failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Invalid credentials',
    });

    const provider = new OAuth2ServiceAccountProvider(config);

    await expect(provider.getHeaders('GET', 'https://api.ovh.com/v1/test')).rejects.toThrow(
      AuthError
    );
  });

  it('should invalidate cache when requested', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'first-token',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'second-token',
          expires_in: 3600,
        }),
      });

    const provider = new OAuth2ServiceAccountProvider(config);

    // First call
    const headers1 = await provider.getHeaders('GET', 'https://api.ovh.com/v1/test');
    expect(headers1.Authorization).toBe('Bearer first-token');

    // Invalidate cache
    provider.invalidateCache();

    // Second call - should fetch new token
    const headers2 = await provider.getHeaders('GET', 'https://api.ovh.com/v1/test');
    expect(headers2.Authorization).toBe('Bearer second-token');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe('AkAsCkSignatureProvider', () => {
  const config = {
    appKey: 'test-app-key',
    appSecret: 'test-app-secret',
    consumerKey: 'test-consumer-key',
    apiBaseUrl: 'https://eu.api.ovh.com/1.0',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be configured when all required fields are present', () => {
    const provider = new AkAsCkSignatureProvider(config);
    expect(provider.isConfigured()).toBe(true);
  });

  it('should not be configured when appKey is missing', () => {
    const provider = new AkAsCkSignatureProvider({
      ...config,
      appKey: '',
    });
    expect(provider.isConfigured()).toBe(false);
  });

  it('should return correct headers with signature', async () => {
    // Mock time sync endpoint
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => Math.floor(Date.now() / 1000),
    });

    const provider = new AkAsCkSignatureProvider(config);
    const headers = await provider.getHeaders('GET', 'https://eu.api.ovh.com/1.0/hosting/web');

    expect(headers['X-Ovh-Application']).toBe(config.appKey);
    expect(headers['X-Ovh-Consumer']).toBe(config.consumerKey);
    expect(headers['X-Ovh-Timestamp']).toBeDefined();
    expect(headers['X-Ovh-Signature']).toMatch(/^\$1\$[a-f0-9]{40}$/);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('should sync time with OVH server', async () => {
    const serverTime = Math.floor(Date.now() / 1000) + 100; // 100 seconds ahead
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => serverTime,
    });

    const provider = new AkAsCkSignatureProvider(config);
    await provider.getHeaders('GET', 'https://eu.api.ovh.com/1.0/test');

    expect(mockFetch).toHaveBeenCalledWith(
      `${config.apiBaseUrl}/auth/time`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should handle time sync failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const provider = new AkAsCkSignatureProvider(config);
    // Should not throw, should use local time
    const headers = await provider.getHeaders('GET', 'https://eu.api.ovh.com/1.0/test');

    expect(headers['X-Ovh-Timestamp']).toBeDefined();
    expect(headers['X-Ovh-Signature']).toBeDefined();
  });
});


