/**
 * Custom Error Classes for Service Layer
 * Provides explicit error categorization for proper handling
 */

/**
 * Base Service Error Class
 */
class ServiceError extends Error {
  constructor(message, code, retryable = false, context = {}) {
    super(message);
    this.name = 'ServiceError';
    this.code = code;
    this.retryable = retryable;
    this.context = context;
    this.timestamp = new Date();
  }

  /**
   * Convert error to JSON for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      retryable: this.retryable,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * Database Connection Error (Transient)
 * Used for connection failures, timeouts, network issues
 */
class DatabaseConnectionError extends ServiceError {
  constructor(message, context = {}) {
    super(message, 'DB_CONNECTION_ERROR', true, context);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Validation Error (Permanent)
 * Used for invalid input data, schema violations
 */
class ValidationError extends ServiceError {
  constructor(message, field = null, value = null) {
    const context = { field, value };
    super(message, 'VALIDATION_ERROR', false, context);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Cache Error (Transient)
 * Used for cache-related failures
 */
class CacheError extends ServiceError {
  constructor(message, operation = null, context = {}) {
    super(message, 'CACHE_ERROR', true, { operation, ...context });
    this.name = 'CacheError';
    this.operation = operation;
  }
}

/**
 * Database Write Error (Depends on cause)
 * Used for database write failures - retryable depends on underlying cause
 */
class DatabaseWriteError extends ServiceError {
  constructor(message, originalError = null, context = {}) {
    // Determine if retryable based on original error
    const retryable = DatabaseWriteError.isRetryableError(originalError);
    
    super(message, 'DB_WRITE_ERROR', retryable, { originalError: originalError?.message, ...context });
    this.name = 'DatabaseWriteError';
    this.originalError = originalError;
  }

  /**
   * Determine if a database error is retryable
   * @param {Error} error - Original database error
   * @returns {boolean} True if error is transient and retryable
   */
  static isRetryableError(error) {
    if (!error) return false;

    const transientCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EPIPE',
      'EHOSTUNREACH'
    ];

    const transientMessages = [
      'connection',
      'timeout',
      'network',
      'temporary',
      'retry'
    ];

    // Check error code
    if (error.code && transientCodes.includes(error.code)) {
      return true;
    }

    // Check error message for transient indicators
    const message = error.message?.toLowerCase() || '';
    if (transientMessages.some(indicator => message.includes(indicator))) {
      return true;
    }

    // MongoDB specific errors
    if (error.name === 'MongoNetworkError' || error.name === 'MongoTimeoutError') {
      return true;
    }

    // Permanent errors (should NOT be retried)
    const permanentCodes = [11000, 11001]; // Duplicate key errors
    if (error.code && permanentCodes.includes(error.code)) {
      return false;
    }

    // Default to non-retryable for safety
    return false;
  }
}

/**
 * Not Found Error (Permanent)
 * Used when requested data doesn't exist
 */
class NotFoundError extends ServiceError {
  constructor(resource, identifier, context = {}) {
    const message = `${resource} not found: ${identifier}`;
    super(message, 'NOT_FOUND', false, { resource, identifier, ...context });
    this.name = 'NotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }
}



/**
 * Error Handler Utility
 * Provides centralized error handling and user-friendly message translation
 */
class ErrorHandler {
  /**
   * Handle service error and return user-friendly message
   * @param {Error} error - The error to handle
   * @param {string} operation - The operation that failed
   * @param {Object} context - Additional context
   * @returns {string} User-friendly error message
   */
  static handleServiceError(error, operation = 'operation', context = {}) {
    // Log error with full context
    console.error(`Service Error in ${operation}:`, {
      error: error.message,
      code: error.code,
      retryable: error.retryable,
      context: { ...error.context, ...context },
      stack: error.stack
    });

    // Return user-friendly message based on error type
    if (error instanceof ValidationError) {
      return error.field 
        ? `Invalid ${error.field}. Please check your input and try again.`
        : 'Invalid input provided. Please check your command and try again.';
    }

    if (error instanceof NotFoundError) {
      return `${error.resource} not found. Please check the identifier and try again.`;
    }

    if (error instanceof DatabaseConnectionError) {
      return 'Database temporarily unavailable. Please try again in a moment.';
    }

    if (error instanceof CacheError) {
      return 'Cache system temporarily unavailable. Please try again.';
    }

    if (error instanceof DatabaseWriteError) {
      return 'Failed to save data. Please try again.';
    }

    // Generic fallback for unknown errors
    return 'An internal error occurred. Please try again later.';
  }

  /**
   * Determine if an error should be retried
   * @param {Error} error - The error to check
   * @returns {boolean} True if error should be retried
   */
  static shouldRetry(error) {
    return error instanceof ServiceError && error.retryable;
  }

  /**
   * Get retry delay based on error type and attempt number
   * @param {Error} error - The error
   * @param {number} attempt - Current attempt number (1-based)
   * @returns {number} Delay in milliseconds
   */
  static getRetryDelay(error, attempt) {
    // Exponential backoff: 1s, 2s, 4s, 8s...
    return Math.min(1000 * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
  }
}

module.exports = {
  ServiceError,
  DatabaseConnectionError,
  ValidationError,
  CacheError,
  DatabaseWriteError,
  NotFoundError,
  ErrorHandler
};