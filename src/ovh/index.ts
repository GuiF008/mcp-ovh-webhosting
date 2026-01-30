/**
 * Index du module OVH
 */

export { OvhClient, createOvhClient, type OvhClientConfig, type RequestOptions, type OvhResponse } from './client.js';
export { OvhApiError, ValidationError, TimeoutError, RateLimitError, McpErrorCode, parseOvhError } from './errors.js';
export {
  AuthProvider,
  AuthHeaders,
  AuthError,
  OAuth2ServiceAccountProvider,
  AkAsCkSignatureProvider,
  BearerPassthroughProvider,
  createAuthProvider,
  requestCredential,
  withBearerToken,
  withBearerTokenAsync,
  extractBearerToken,
  bearerStorage,
  type OAuth2ServiceAccountConfig,
  type AkAsCkConfig,
  type AccessRule,
  type CredentialRequest,
  type CredentialResponse,
  type BearerContext,
} from './auth/index.js';
