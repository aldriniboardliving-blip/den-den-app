// src/api/client.ts
// API client with interceptors, auth, and error handling

import { getDatabase } from '../database/connection';
import { CONFIG } from '../constants/config';

interface ApiResponse<T> {
  data: T;
  status: number;
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
  requireAuth?: boolean;
  idempotencyKey?: string;
}

class ApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private deviceId: string | null = null;

  constructor() {
    this.baseUrl = CONFIG.api.baseUrl;
  }

  setTokens(accessToken: string, refreshToken: string, deviceId: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.deviceId = deviceId;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.deviceId = null;
  }

  private async buildUrl(endpoint: string, params?: Record<string, string>): Promise<string> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private getHeaders(options: RequestOptions): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (options.requireAuth !== false && this.accessToken) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (this.deviceId) {
      (headers as Record<string, string>)['X-Device-ID'] = this.deviceId;
    }

    if (options.idempotencyKey) {
      (headers as Record<string, string>)['Idempotency-Key'] = options.idempotencyKey;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = await this.buildUrl(endpoint, options.params);
    const headers = this.getHeaders(options);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.api.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(response.status, errorData);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(408, { message: 'Request timeout' });
      }

      throw new ApiError(0, { message: 'Network error' });
    }
  }

  // Public API methods

  async requestOtp(identifier: string, type: 'EMAIL' | 'SMS', purpose: string) {
    return this.request('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ identifier, type, purpose }),
      requireAuth: false,
    });
  }

  async verifyOtp(
    identifier: string,
    code: string,
    type: 'EMAIL' | 'SMS',
    purpose: string,
    deviceInfo: any
  ): Promise<{ user: any; device: any; accessToken: string; refreshToken: string }> {
    return this.request('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ identifier, code, type, purpose, deviceInfo }),
      requireAuth: false,
    });
  }

  async refreshAccessToken() {
    if (!this.refreshToken) throw new Error('No refresh token');

    const response = await this.request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      requireAuth: false,
      // Refresh token sent as cookie
    });

    this.accessToken = response.accessToken;
    return response;
  }

  async getMe(): Promise<any> {
    return this.request('/users/me');
  }

  async updateProfile(data: { displayName?: string; avatarUrl?: string }) {
    return this.request('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getDevices() {
    return this.request('/devices');
  }

  async registerDevice(deviceInfo: any) {
    return this.request('/devices', {
      method: 'POST',
      body: JSON.stringify(deviceInfo),
      idempotencyKey: deviceInfo.deviceId,
    });
  }

  async getConversations(params?: { limit?: number; cursor?: string; includeArchived?: boolean }) {
    const { limit, cursor, includeArchived } = params || {};
    const stringParams: Record<string, string> = {};
    if (limit !== undefined) stringParams['limit'] = String(limit);
    if (cursor) stringParams['cursor'] = cursor;
    if (includeArchived !== undefined) stringParams['includeArchived'] = String(includeArchived);
    return this.request('/conversations', { params: stringParams });
  }

  async createConversation(data: {
    type: 'DIRECT' | 'GROUP';
    recipientAccountId?: string;
    title?: string;
    memberAccountIds?: string[];
  }) {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: generateIdempotencyKey(),
    });
  }

  async getKeyBundle(deviceId: string): Promise<any> {
    return this.request(`/devices/${deviceId}/keys`);
  }

  async sendMessage(envelope: any): Promise<{ serverMessageId: string }> {
    return this.request('/messages/send', {
      method: 'POST',
      body: JSON.stringify(envelope),
      idempotencyKey: envelope.messageId,
    });
  }

  async acknowledgeMessage(serverMessageId: string, status: string): Promise<void> {
    return this.request('/messages/ack', {
      method: 'POST',
      body: JSON.stringify({ serverMessageId, status }),
    });
  }

  async sendReadReceipt(serverMessageId: string): Promise<void> {
    return this.request('/messages/read', {
      method: 'POST',
      body: JSON.stringify({ serverMessageId }),
    });
  }

  async getAttachmentUploadUrl(data: {
    filename: string;
    mimeType: string;
    sizeBytes: number;
    conversationId: string;
  }): Promise<{ uploadUrl: string }> {
    return this.request('/attachments/upload-url', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey: generateIdempotencyKey(),
    });
  }

  async completeAttachmentUpload(attachmentId: string, sha256: string): Promise<void> {
    return this.request(`/attachments/${attachmentId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    });
  }

  async getContact(accountId: string): Promise<any> {
    return this.request(`/contacts/${accountId}`);
  }

  async updateDeviceKeys(deviceId: string, device: any): Promise<void> {
    return this.request(`/devices/${deviceId}`, {
      method: 'PATCH',
      body: JSON.stringify(device),
    });
  }
}

class ApiError extends Error {
  constructor(
    public status: number,
    public data: any
  ) {
    super(data?.message || `API Error: ${status}`);
    this.name = 'ApiError';
  }
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

export const api = new ApiClient();
