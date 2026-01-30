/**
 * Index des providers d'authentification OVH
 * Factory pour sélectionner le provider selon la configuration
 */

export { AuthProvider, AuthHeaders, AuthError } from './provider.js';
export { OAuth2ServiceAccountProvider, type OAuth2ServiceAccountConfig } from './oauth2ServiceAccount.js';
export {
  AkAsCkSignatureProvider,
  type AkAsCkConfig,
  requestCredential,
  type AccessRule,
  type CredentialRequest,
  type CredentialResponse,
} from './akAsCkSignature.js';
export {
  BearerPassthroughProvider,
  withBearerToken,
  withBearerTokenAsync,
  extractBearerToken,
  bearerStorage,
  type BearerContext,
} from './bearerPassthrough.js';

import { AuthProvider } from './provider.js';
import { OAuth2ServiceAccountProvider, OAuth2ServiceAccountConfig } from './oauth2ServiceAccount.js';
import { AkAsCkSignatureProvider, AkAsCkConfig } from './akAsCkSignature.js';
import { BearerPassthroughProvider } from './bearerPassthrough.js';
import { Config, getOAuth2TokenUrl, getApiBaseUrl } from '../../config.js';

/**
 * Crée le provider d'authentification approprié selon la configuration
 */
export function createAuthProvider(config: Config): AuthProvider {
  if (config.authMode === 'oauth2') {
    if (!config.oauth2) {
      throw new Error('Configuration OAuth2 manquante pour le mode oauth2');
    }

    const oauth2Config: OAuth2ServiceAccountConfig = {
      clientId: config.oauth2.clientId,
      clientSecret: config.oauth2.clientSecret,
      scope: config.oauth2.scope,
      tokenUrl: getOAuth2TokenUrl(config),
    };

    return new OAuth2ServiceAccountProvider(oauth2Config);
  }

  if (config.authMode === 'akasck') {
    if (!config.akasck) {
      throw new Error('Configuration AK/AS/CK manquante pour le mode akasck');
    }

    const akasckConfig: AkAsCkConfig = {
      appKey: config.akasck.appKey,
      appSecret: config.akasck.appSecret,
      consumerKey: config.akasck.consumerKey,
      apiBaseUrl: getApiBaseUrl(config),
    };

    return new AkAsCkSignatureProvider(akasckConfig);
  }

  if (config.authMode === 'bearer') {
    // Mode passthrough : le bearer token vient de la requête HTTP du client MCP
    return new BearerPassthroughProvider();
  }

  throw new Error(`Mode d'authentification non supporté: ${config.authMode}`);
}
