/**
 * Network Service with proper error handling, retries, and logging
 */
import { logger, safeApiCall, createAppError, ErrorType, AppError } from './logger';
import NetInfo from '@react-native-community/netinfo';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface ApiResponse<T> {
  data: T | null;
  error: AppError | null;
  status: number;
}

class NetworkService {
  private static instance: NetworkService;
  private isOnline: boolean = true;
  private listeners: ((online: boolean) => void)[] = [];

  static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener() {
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      if (wasOnline !== this.isOnline) {
        logger.info(`Network status changed: ${this.isOnline ? 'Online' : 'Offline'}`);
        this.listeners.forEach(listener => listener(this.isOnline));
      }
    });
  }

  onNetworkChange(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = 15000,
      retries = 3,
      retryDelay = 1000,
    } = config;

    const url = `${API_URL}${endpoint}`;
    const requestId = Math.random().toString(36).substring(7);

    logger.info(`[${requestId}] API Request: ${method} ${endpoint}`);

    // Check network before making request
    if (!this.isOnline) {
      logger.warn(`[${requestId}] Request blocked: Device is offline`);
      return {
        data: null,
        error: createAppError(
          ErrorType.NETWORK,
          'Device is offline',
          new Error('No network connection')
        ),
        status: 0,
      };
    }

    const requestOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body && method !== 'GET') {
      requestOptions.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        logger.debug(`[${requestId}] Attempt ${attempt}/${retries}`);

        const response = await this.fetchWithTimeout(url, requestOptions, timeout);
        const responseData = await response.json().catch(() => null);

        if (!response.ok) {
          const errorMessage = responseData?.detail || responseData?.message || `HTTP ${response.status}`;
          throw new Error(errorMessage);
        }

        logger.info(`[${requestId}] Request successful: ${response.status}`);
        
        return {
          data: responseData as T,
          error: null,
          status: response.status,
        };
      } catch (error) {
        lastError = error as Error;
        
        const isRetryable = 
          lastError.name === 'AbortError' || 
          lastError.message.includes('network') ||
          lastError.message.includes('fetch');

        logger.warn(`[${requestId}] Attempt ${attempt} failed: ${lastError.message}`, {
          retryable: isRetryable,
          attemptsRemaining: retries - attempt,
        });

        if (attempt < retries && isRetryable) {
          await this.delay(retryDelay * attempt); // Exponential backoff
        }
      }
    }

    // All retries failed
    const appError = createAppError(
      ErrorType.NETWORK,
      `Request failed after ${retries} attempts`,
      lastError || new Error('Unknown error'),
      { endpoint, method, requestId }
    );

    return {
      data: null,
      error: appError,
      status: 0,
    };
  }

  // Convenience methods
  async get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  async put<T>(endpoint: string, body?: any, config?: Omit<RequestConfig, 'method'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  async delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }
}

export const networkService = NetworkService.getInstance();
export default networkService;
