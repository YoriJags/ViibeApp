/**
 * Centralized Error Handling & Logging System
 * - Captures all errors with context
 * - Provides user-friendly error messages
 * - Logs to console and can be extended to remote logging
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private addLog(entry: LogEntry) {
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    // Console output with color coding
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    switch (entry.level) {
      case 'error':
        console.error(prefix, entry.message, entry.context || '', entry.stack || '');
        break;
      case 'warn':
        console.warn(prefix, entry.message, entry.context || '');
        break;
      case 'info':
        console.info(prefix, entry.message, entry.context || '');
        break;
      default:
        console.log(prefix, entry.message, entry.context || '');
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.addLog({ timestamp: this.formatTimestamp(), level: 'debug', message, context });
  }

  info(message: string, context?: Record<string, any>) {
    this.addLog({ timestamp: this.formatTimestamp(), level: 'info', message, context });
  }

  warn(message: string, context?: Record<string, any>) {
    this.addLog({ timestamp: this.formatTimestamp(), level: 'warn', message, context });
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
    this.addLog({
      timestamp: this.formatTimestamp(),
      level: 'error',
      message,
      context: { ...context, errorName: error?.name, errorMessage: error?.message },
      stack: error?.stack,
    });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getRecentErrors(): LogEntry[] {
    return this.logs.filter(log => log.level === 'error').slice(0, 10);
  }

  clearLogs() {
    this.logs = [];
  }

  // Export logs for debugging
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const logger = Logger.getInstance();

// Error types for better categorization
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION',
  STORAGE = 'STORAGE',
  PERMISSION = 'PERMISSION',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  userMessage: string;
  originalError?: Error;
  retryable: boolean;
  context?: Record<string, any>;
}

// User-friendly error messages
const USER_MESSAGES: Record<ErrorType, string> = {
  [ErrorType.NETWORK]: "Can't connect to the server. Please check your internet connection.",
  [ErrorType.API]: "Something went wrong on our end. Please try again.",
  [ErrorType.AUTH]: "Your session has expired. Please sign in again.",
  [ErrorType.VALIDATION]: "Please check your input and try again.",
  [ErrorType.STORAGE]: "Unable to save data. Please try again.",
  [ErrorType.PERMISSION]: "Permission denied. Please enable the required permissions.",
  [ErrorType.UNKNOWN]: "Something unexpected happened. Please try again.",
};

export function createAppError(
  type: ErrorType,
  message: string,
  originalError?: Error,
  context?: Record<string, any>
): AppError {
  const appError: AppError = {
    type,
    message,
    userMessage: USER_MESSAGES[type],
    originalError,
    retryable: [ErrorType.NETWORK, ErrorType.API].includes(type),
    context,
  };

  logger.error(message, originalError, { type, ...context });

  return appError;
}

// Helper to detect error types
export function detectErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
    return ErrorType.NETWORK;
  }
  if (message.includes('401') || message.includes('unauthorized') || message.includes('auth')) {
    return ErrorType.AUTH;
  }
  if (message.includes('400') || message.includes('validation')) {
    return ErrorType.VALIDATION;
  }
  if (message.includes('500') || message.includes('server')) {
    return ErrorType.API;
  }
  if (message.includes('permission') || message.includes('denied')) {
    return ErrorType.PERMISSION;
  }
  if (message.includes('storage') || message.includes('async')) {
    return ErrorType.STORAGE;
  }
  
  return ErrorType.UNKNOWN;
}

// Network request wrapper with error handling
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  context?: string
): Promise<{ data: T | null; error: AppError | null }> {
  try {
    logger.debug(`API call started: ${context || 'unknown'}`);
    const data = await apiCall();
    logger.debug(`API call successful: ${context || 'unknown'}`);
    return { data, error: null };
  } catch (err) {
    const error = err as Error;
    const errorType = detectErrorType(error);
    const appError = createAppError(
      errorType,
      `API call failed: ${context || 'unknown'}`,
      error,
      { context }
    );
    return { data: null, error: appError };
  }
}

export default logger;
