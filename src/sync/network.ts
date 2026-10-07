// src/sync/network.ts
// Network monitoring

import type { NetInfoState } from '@react-native-community/netinfo';
import NetInfo from '@react-native-community/netinfo';

type NetworkListener = (online: boolean) => void;

export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private listeners: Set<NetworkListener> = new Set();
  private currentState: NetInfoState | null = null;
  private unsubscribe: (() => void) | null = null;

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  start() {
    if (this.unsubscribe) return;

    this.unsubscribe = NetInfo.addEventListener(this.handleChange);
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private handleChange = (state: NetInfoState) => {
    const wasOnline = this.currentState?.isConnected === true;
    const isOnline = state.isConnected === true && state.isInternetReachable !== false;

    this.currentState = state;

    if (!wasOnline && isOnline) {
      this.listeners.forEach(l => l(true));
    }
  };

  async isOnline(): Promise<boolean> {
    if (this.currentState) {
      return (
        this.currentState.isConnected === true && this.currentState.isInternetReachable !== false
      );
    }
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }

  onOnline(listener: NetworkListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getCurrentState(): NetInfoState | null {
    return this.currentState;
  }
}

export const networkMonitor = NetworkMonitor.getInstance();
