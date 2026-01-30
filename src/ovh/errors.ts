/**
 * Gestion des erreurs OVH et mapping vers erreurs MCP
 */

export enum McpErrorCode {
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  RESOURCE_NOT_FOUND = -32001,
  PERMISSION_DENIED = -32002,
  RATE_LIMITED = -32003,
  SERVICE_UNAVAILABLE = -32004,
}

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

  toMcpError(): { code: number; message: string; data?: unknown } {
    return {
      code: this.mcpErrorCode,
      message: this.message,
      data: { httpStatus: this.httpStatus, ovhErrorCode: this.ovhErrorCode, retryable: this.retryable },
    };
  }
}

interface OvhErrorResponse {
  class?: string;
  message?: string;
  errorCode?: string;
}

export function parseOvhError(httpStatus: number, responseBody: string | OvhErrorResponse, cause?: Error): OvhApiError {
  let errorData: OvhErrorResponse;

  if (typeof responseBody === 'string') {
    try {
      errorData = JSON.parse(responseBody) as OvhErrorResponse;
    } catch {
      return createHttpError(httpStatus, responseBody, cause);
    }
  } else {
    errorData = responseBody;
  }

  const message = errorData.message || `Erreur OVH HTTP ${httpStatus}`;
  const { mcpErrorCode, retryable } = mapHttpStatusToMcp(httpStatus);

  return new OvhApiError(message, httpStatus, errorData.errorCode, mcpErrorCode, retryable, cause);
}

function createHttpError(httpStatus: number, message: string, cause?: Error): OvhApiError {
  const { mcpErrorCode, retryable } = mapHttpStatusToMcp(httpStatus);
  return new OvhApiError(message, httpStatus, undefined, mcpErrorCode, retryable, cause);
}

function mapHttpStatusToMcp(httpStatus: number): { mcpErrorCode: McpErrorCode; retryable: boolean } {
  if (httpStatus === 400) return { mcpErrorCode: McpErrorCode.INVALID_PARAMS, retryable: false };
  if (httpStatus === 401 || httpStatus === 403) return { mcpErrorCode: McpErrorCode.PERMISSION_DENIED, retryable: false };
  if (httpStatus === 404) return { mcpErrorCode: McpErrorCode.RESOURCE_NOT_FOUND, retryable: false };
  if (httpStatus === 429) return { mcpErrorCode: McpErrorCode.RATE_LIMITED, retryable: true };
  if (httpStatus >= 500) return { mcpErrorCode: McpErrorCode.SERVICE_UNAVAILABLE, retryable: true };
  return { mcpErrorCode: McpErrorCode.INTERNAL_ERROR, retryable: false };
}

export class TimeoutError extends OvhApiError {
  constructor(timeoutMs: number) {
    super(`Timeout après ${timeoutMs}ms`, 0, 'TIMEOUT', McpErrorCode.SERVICE_UNAVAILABLE, true);
    this.name = 'TimeoutError';
  }
}

export class RateLimitError extends OvhApiError {
  constructor(message: string = 'Rate limit atteint') {
    super(message, 0, 'RATE_LIMIT', McpErrorCode.RATE_LIMITED, true);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends OvhApiError {
  constructor(message: string, public readonly field?: string) {
    super(message, 0, 'VALIDATION_ERROR', McpErrorCode.INVALID_PARAMS, false);
    this.name = 'ValidationError';
  }
}
