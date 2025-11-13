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
   * Write log entry to file
   */
  writeLog(level, category, message, data = null) {
    try {
      const timestamp = this.getTimestamp();
      let logEntry = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}`;
      
      if (data) {
        logEntry += `\n  Data: ${JSON.stringify(data, null, 2)}`;
      }
      
      logEntry += '\n';
      
      fs.appendFileSync(this.logFile, logEntry, 'utf8');
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
   * Log cache operations
   */
  cache(operation, service, key, details = null) {
    this.writeLog('DEBUG', 'CACHE', `${service} - ${operation} - ${key}`, details);
  }

  /**
   * Log database writes
   */
  write(service, key, success, details = null) {
    const level = success ? 'INFO' : 'ERROR';
    const status = success ? 'SUCCESS' : 'FAILED';
    this.writeLog(level, 'WRITE', `${service} - ${status} - ${key}`, details);
  }

  /**
   * Log database reads
   */
  read(service, key, found, details = null) {
    this.writeLog('DEBUG', 'READ', `${service} - ${found ? 'FOUND' : 'NOT_FOUND'} - ${key}`, details);
  }

  /**
   * Log errors
   */
  error(category, message, error) {
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      code: error.code
    };
    this.writeLog('ERROR', category, message, errorDetails);
  }

  /**
   * Log warnings
   */
  warn(category, message, details = null) {
    this.writeLog('WARN', category, message, details);
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
