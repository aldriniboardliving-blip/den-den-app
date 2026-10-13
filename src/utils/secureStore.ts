// src/utils/secureStore.ts
// Secure storage wrapper using expo-secure-store

import * as ExpoSecureStore from 'expo-secure-store';

const SECURE_STORE_OPTIONS = {
  keychainService: 'den-den-app',
  keychainAccessible: ExpoSecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureStoreUtil {
  static async setItem(key: string, value: string): Promise<void> {
    try {
      await ExpoSecureStore.setItemAsync(key, value, SECURE_STORE_OPTIONS);
    } catch (error) {
      console.error(`SecureStore setItem failed for key ${key}:`, error);
      throw error;
    }
  }

  static async getItem(key: string): Promise<string | null> {
    try {
      return await ExpoSecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (error) {
      console.error(`SecureStore getItem failed for key ${key}:`, error);
      return null;
    }
  }

  static async deleteItem(key: string): Promise<void> {
    try {
      await ExpoSecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (error) {
      console.error(`SecureStore deleteItem failed for key ${key}:`, error);
      throw error;
    }
  }

  static async setObject<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  static async getObject<T>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`SecureStore getObject parse failed for key ${key}:`, error);
      return null;
    }
  }

  static async clearAll(): Promise<void> {
    // Note: expo-secure-store doesn't have a clear all method
    // In a real implementation, you'd track keys and delete them individually
  }
}

export const SecureStore = {
  setItem: SecureStoreUtil.setItem,
  getItem: SecureStoreUtil.getItem,
  deleteItem: SecureStoreUtil.deleteItem,
  setObject: SecureStoreUtil.setObject,
  getObject: SecureStoreUtil.getObject,
};