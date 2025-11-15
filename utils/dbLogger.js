const fs = require('fs');
const path = require('path');

/**
 * Database Logger - Logs all database operations to a file
 */
class DatabaseLogger {
  constructor() {
    this.logDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logDir, 'database.txt');
    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Format timestamp
   */
  getTimestamp() {
    const now = new Date();
    return now.toISOString();
  }

  /**
   * Write log entry to file (async, non-blocking)
   */
  writeLog(level, category, message, data = null) {
    try {
      const timestamp = this.getTimestamp();
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
      
      if (data) {
        // Pretty print with indentation for readability
        const dataStr = JSON.stringify(data, null, 2);
        // Indent each line for better visual hierarchy
        const indentedData = dataStr.split('\n').map(line => `  ${line}`).join('\n');
        logEntry += `\n${indentedData}`;
      }
      
      logEntry += '\n';
      
      // Async write - don't block the caller
      setImmediate(() => {
        fs.appendFile(this.logFile, logEntry, 'utf8', (err) => {
          if (err) {
            // Silent fail to avoid infinite loops
            console.error('Failed to write to database log:', err.message);
          }
        });
      });
    } catch (error) {
      // Silent fail to avoid infinite loops
      console.error('Failed to write to database log:', error.message);
    }
  }

  /**
   * Log connection events
   */
  connection(type, event, details = null) {
    this.writeLog('INFO', 'CONNECTION', `${type} database ${event}`, details);
  }

  /**
   * Log cache operations (only important ones to reduce file I/O)
   */
  cache(operation, service, key, details = null) {
    // Only log cache operations that matter (not every HIT/MISS)
    const importantOps = ['INVALIDATE', 'CLEAR_ALL', 'SET_FAILED', 'INVALIDATE_SKIPPED'];
    if (importantOps.includes(operation)) {
      this.writeLog('DEBUG', 'CACHE', `${service} - ${operation} - ${key}`, details);
    }
    // Skip logging HIT, MISS, LOADED, SET - too noisy (3 logs per command = 26MB in 2 days)
  }

  /**
   * Log database writes
   */
  write(service, key, success, details = null) {
    const level = success ? 'INFO' : 'ERROR';
    const status = success ? 'SUCCESS' : 'FAILED';
    
    // Add more context to write logs
    const enhancedDetails = {
      ...details,
      timestamp: new Date().toISOString(),
      service,
      key,
      success
    };
    
    this.writeLog(level, 'WRITE', `${service} - ${status} - ${key}`, enhancedDetails);
  }

  /**
   * Log database reads (disabled - too noisy)
   */
  read(service, key, found, details = null) {
    // Disabled to reduce file I/O - reads are tracked via cache logs
    // Uncomment for debugging: this.writeLog('DEBUG', 'READ', `${service} - ${found ? 'FOUND' : 'NOT_FOUND'} - ${key}`, details);
  }

  /**
   * Log errors (async)
   */
  error(category, message, error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    };
    // Add separator line for errors to make them stand out
    const separator = '='.repeat(80);
    setImmediate(() => {
      fs.appendFile(this.logFile, `\n${separator}\n`, 'utf8', () => {
        this.writeLog('ERROR', category, message, errorDetails);
        fs.appendFile(this.logFile, `${separator}\n\n`, 'utf8', () => {});
      });
    });
  }

  /**
   * Log warnings (async)
   */
  warn(category, message, details = null) {
    // Add separator line for warnings to make them stand out
    const separator = '='.repeat(80);
    setImmediate(() => {
      fs.appendFile(this.logFile, `\n${separator}\n`, 'utf8', () => {
        this.writeLog('WARN', category, message, details);
        fs.appendFile(this.logFile, `${separator}\n\n`, 'utf8', () => {});
      });
    });
  }

  /**
   * Clear old logs (keep last 7 days)
   */
  rotateLogs() {
    try {
      const stats = fs.statSync(this.logFile);
      const fileAge = Date.now() - stats.mtimeMs;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;

      if (fileAge > sevenDays) {
        const archiveName = `database_${new Date(stats.mtime).toISOString().split('T')[0]}.txt`;
        const archivePath = path.join(this.logDir, archiveName);
        
        fs.renameSync(this.logFile, archivePath);
        this.writeLog('INFO', 'SYSTEM', 'Log file rotated');
      }
    } catch (error) {
      // File doesn't exist or can't be rotated, ignore
    }
  }
}

// Export singleton instance
module.exports = new DatabaseLogger();
