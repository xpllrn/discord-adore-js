const { ErrorHandler, DatabaseConnectionError, CacheError, DatabaseWriteError } = require('./errors');

/**
 * Retry Manager
 * Handles retry logic for transient errors with exponential backoff
 */
class RetryManager {
  /**
   * Execute operation with retry logic for transient errors only
   * @param {Function} operation - Async operation to execute
   * @param {number} maxRetries - Maximum number of retries (default: 3)
   * @param {Object} options - Retry options
   * @returns {Promise<*>} Operation result
   */
  static async executeWithRetry(operation, maxRetries = 3, options = {}) {
    const {
      baseDelay = 1000, // Base delay in milliseconds
      maxDelay = 30000,  // Maximum delay in milliseconds
      backoffMultiplier = 2, // Exponential backoff multiplier
      jitter = true // Add random jitter to prevent thundering herd
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt > maxRetries) {
          break;
        }

        // Only retry transient errors
        if (!this.isTransientError(error)) {
          console.warn(`Non-transient error, not retrying:`, error.message);
          throw error;
        }

        // Calculate delay with exponential backoff
        let delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt - 1),
          maxDelay
        );

        // Add jitter to prevent thundering herd problem
        if (jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }

        // Use error-specific delay if available
        const errorDelay = ErrorHandler.getRetryDelay(error, attempt);
        if (errorDelay > 0) {
          delay = Math.min(errorDelay, maxDelay);
        }

        console.warn(`Transient error on attempt ${attempt}/${maxRetries}, retrying in ${Math.round(delay)}ms:`, error.message);

        // Wait before retrying
        await this.delay(delay);
      }
    }

    // All retries exhausted, throw the last error
    throw lastError;
  }

  /**
   * Determine if an error is transient and should be retried
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is transient
   */
  static isTransientError(error) {
    // Check if it's a service error with retryable flag
    if (error.retryable !== undefined) {
      return error.retryable;
    }

    // Check specific error types
    if (error instanceof DatabaseConnectionError || 
        error instanceof CacheError) {
      return true;
    }

    // Check for database write errors (depends on underlying cause)
    if (error instanceof DatabaseWriteError) {
      return error.retryable;
    }

    // Check error codes that indicate transient issues
    const transientCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNREFUSED',
      'EPIPE',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'EAI_AGAIN'
    ];

    if (error.code && transientCodes.includes(error.code)) {
      return true;
    }

    // Check error messages for transient indicators
    const transientMessages = [
      'connection reset',
      'connection timeout',
      'network error',
      'temporary failure',
      'service unavailable',
      'too many connections',
      'connection refused'
    ];

    const message = error.message?.toLowerCase() || '';
    if (transientMessages.some(indicator => message.includes(indicator))) {
      return true;
    }

    // MongoDB specific transient errors
    if (error.name === 'MongoNetworkError' || 
        error.name === 'MongoTimeoutError' ||
        error.name === 'MongoServerSelectionError') {
      return true;
    }

    // MongoDB error codes that are transient
    const mongoTransientCodes = [
      6, // HostUnreachable
      7, // HostNotFound
      89, // NetworkTimeout
      91, // ShutdownInProgress
      11600, // InterruptedAtShutdown
      11602, // InterruptedDueToReplStateChange
      13435, // NotMasterNoSlaveOk
      13436, // NotMasterOrSecondary
      189, // PrimarySteppedDown
      11601, // InterruptedDueToStepDown
      10107, // NotMaster
      16986, // NotPrimaryNoSecondaryOk
      16987 // NotPrimaryOrSecondary
    ];

    if (error.code && mongoTransientCodes.includes(error.code)) {
      return true;
    }

    // Permanent errors that should NEVER be retried
    const permanentCodes = [
      11000, // DuplicateKey
      11001, // DuplicateKey (legacy)
      2, // BadValue
      9, // FailedToParse
      14, // TypeMismatch
      16755, // Location16755 (invalid geospatial data)
      16756, // Location16756 (invalid geospatial data)
      17280, // KeyTooLong
      17281 // WouldChangeOwningShard
    ];

    if (error.code && permanentCodes.includes(error.code)) {
      return false;
    }

    // Default to non-retryable for safety
    return false;
  }

  /**
   * Create a delay promise
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute operation with circuit breaker pattern
   * @param {Function} operation - Operation to execute
   * @param {Object} options - Circuit breaker options
   * @returns {Promise<*>} Operation result
   */
  static async executeWithCircuitBreaker(operation, options = {}) {
    const {
      failureThreshold = 5, // Number of failures before opening circuit
      resetTimeout = 60000,  // Time to wait before trying again (ms)
      monitoringPeriod = 60000 // Period to monitor failures (ms)
    } = options;

    // This is a simplified circuit breaker implementation
    // In production, you might want to use a more sophisticated library
    
    const circuitKey = operation.name || 'anonymous';
    
    if (!this.circuits) {
      this.circuits = new Map();
    }

    let circuit = this.circuits.get(circuitKey);
    if (!circuit) {
      circuit = {
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
        failures: 0,
        lastFailureTime: null,
        lastSuccessTime: null
      };
      this.circuits.set(circuitKey, circuit);
    }

    // Check circuit state
    const now = Date.now();

    if (circuit.state === 'OPEN') {
      if (now - circuit.lastFailureTime > resetTimeout) {
        circuit.state = 'HALF_OPEN';
        console.log(`Circuit breaker for ${circuitKey} moving to HALF_OPEN state`);
      } else {
        throw new Error(`Circuit breaker is OPEN for ${circuitKey}. Try again later.`);
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      circuit.failures = 0;
      circuit.lastSuccessTime = now;
      if (circuit.state === 'HALF_OPEN') {
        circuit.state = 'CLOSED';
        console.log(`Circuit breaker for ${circuitKey} reset to CLOSED state`);
      }
      
      return result;
    } catch (error) {
      circuit.failures++;
      circuit.lastFailureTime = now;

      // Check if we should open the circuit
      if (circuit.failures >= failureThreshold) {
        circuit.state = 'OPEN';
        console.warn(`Circuit breaker for ${circuitKey} opened after ${circuit.failures} failures`);
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker statistics
   * @returns {Object} Circuit breaker stats
   */
  static getCircuitStats() {
    if (!this.circuits) {
      return {};
    }

    const stats = {};
    for (const [key, circuit] of this.circuits) {
      stats[key] = {
        state: circuit.state,
        failures: circuit.failures,
        lastFailureTime: circuit.lastFailureTime,
        lastSuccessTime: circuit.lastSuccessTime
      };
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  static resetCircuits() {
    if (this.circuits) {
      this.circuits.clear();
    }
  }
}

module.exports = RetryManager;