/**
 * Gestion des erreurs OVH et mapping vers erreurs MCP normalisées
 */

/**
 * Codes d'erreur MCP standard
 */
export enum McpErrorCode {
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  RESOURCE_NOT_FOUND = -32001,
  PERMISSION_DENIED = -32002,
  RATE_LIMITED = -32003,
  SERVICE_UNAVAILABLE = -32004,
}

/**
 * Erreur OVH API normalisée
 */
export class OvhApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly ovhErrorCode?: string,
    public readonly mcpErrorCode: McpErrorCode = McpErrorCode.INTERNAL_ERROR,
    public readonly retryable: boolean = false,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'OvhApiError';
  }

  /**
   * Convertit l'erreur en format MCP
   */
  toMcpError(): { code: number; message: string; data?: unknown } {
    return {
      code: this.mcpErrorCode,
      message: this.message,
      data: {
        httpStatus: this.httpStatus,
        ovhErrorCode: this.ovhErrorCode,
        retryable: this.retryable,
      },
    };
  }
}

/**
 * Structure d'une réponse d'erreur OVH
 */
interface OvhErrorResponse {
  class?: string;
  message?: string;
  errorCode?: string;
  httpCode?: string;
  queryId?: string;
}

/**
 * Parse une réponse d'erreur OVH et retourne une OvhApiError normalisée
 */
export function parseOvhError(
  httpStatus: number,
  responseBody: string | OvhErrorResponse,
  cause?: Error
): OvhApiError {
  let errorData: OvhErrorResponse;

  if (typeof responseBody === 'string') {
    try {
      errorData = JSON.parse(responseBody) as OvhErrorResponse;
    } catch {
      // Si le body n'est pas du JSON, créer une erreur générique
      return createHttpError(httpStatus, responseBody, cause);
    }
  } else {
    errorData = responseBody;
  }

  const message = errorData.message || `Erreur OVH HTTP ${httpStatus}`;
  const ovhErrorCode = errorData.errorCode || errorData.class;

  // Mapper le code HTTP vers un code d'erreur MCP et déterminer si l'erreur est retryable
  const { mcpErrorCode, retryable } = mapHttpStatusToMcp(httpStatus, ovhErrorCode);

  return new OvhApiError(message, httpStatus, ovhErrorCode, mcpErrorCode, retryable, cause);
}

/**
 * Crée une erreur HTTP générique
 */
function createHttpError(httpStatus: number, message: string, cause?: Error): OvhApiError {
  const { mcpErrorCode, retryable } = mapHttpStatusToMcp(httpStatus);

  return new OvhApiError(
    message || `Erreur HTTP ${httpStatus}`,
    httpStatus,
    undefined,
    mcpErrorCode,
    retryable,
    cause
  );
}

/**
 * Mappe un code HTTP vers un code d'erreur MCP et détermine si l'erreur est retryable
 */
function mapHttpStatusToMcp(
  httpStatus: number,
  ovhErrorCode?: string
): { mcpErrorCode: McpErrorCode; retryable: boolean } {
  // Erreurs client (4xx)
  if (httpStatus >= 400 && httpStatus < 500) {
    switch (httpStatus) {
      case 400:
        return { mcpErrorCode: McpErrorCode.INVALID_PARAMS, retryable: false };
      case 401:
      case 403:
        return { mcpErrorCode: McpErrorCode.PERMISSION_DENIED, retryable: false };
      case 404:
        return { mcpErrorCode: McpErrorCode.RESOURCE_NOT_FOUND, retryable: false };
      case 429:
        return { mcpErrorCode: McpErrorCode.RATE_LIMITED, retryable: true };
      default:
        return { mcpErrorCode: McpErrorCode.INVALID_PARAMS, retryable: false };
    }
  }

  // Erreurs serveur (5xx) - généralement retryable
  if (httpStatus >= 500) {
    switch (httpStatus) {
      case 503:
        return { mcpErrorCode: McpErrorCode.SERVICE_UNAVAILABLE, retryable: true };
      default:
        return { mcpErrorCode: McpErrorCode.INTERNAL_ERROR, retryable: true };
    }
  }

  // Par défaut
  return { mcpErrorCode: McpErrorCode.INTERNAL_ERROR, retryable: false };
}

/**
 * Erreur de timeout
 */
export class TimeoutError extends OvhApiError {
  constructor(timeoutMs: number) {
    super(
      `Timeout après ${timeoutMs}ms`,
      0,
      'TIMEOUT',
      McpErrorCode.SERVICE_UNAVAILABLE,
      true
    );
    this.name = 'TimeoutError';
  }
}

/**
 * Erreur de rate limiting côté client
 */
export class RateLimitError extends OvhApiError {
  constructor(message: string = 'Rate limit atteint') {
    super(message, 0, 'RATE_LIMIT', McpErrorCode.RATE_LIMITED, true);
    this.name = 'RateLimitError';
  }
}

/**
 * Erreur de validation d'input
 */
export class ValidationError extends OvhApiError {
  constructor(
    message: string,
    public readonly field?: string
  ) {
    super(message, 0, 'VALIDATION_ERROR', McpErrorCode.INVALID_PARAMS, false);
    this.name = 'ValidationError';
  }
}
