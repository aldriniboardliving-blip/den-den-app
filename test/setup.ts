// test/setup.ts
import '@testing-library/jest-native/extend-expect';
import 'react-native-gesture-handler/jestSetup';

// Mock Expo modules
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
  enablePromise: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      eas: {
        projectId: 'test',
      },
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  writeAsStringAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn(),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  addNotificationReceivedListener: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

jest.mock('expo-task-manager', () => ({
  defineTask: jest.fn(),
}));

jest.mock('expo-background-fetch', () => ({
  registerTaskAsync: jest.fn(),
  BackgroundFetchResult: { NewData: 'new_data', NoData: 'no_data', Failed: 'failed' },
}));

jest.mock('react-native-libsodium', () => ({
  crypto_box_keypair: jest.fn(),
  crypto_sign_keypair: jest.fn(),
  crypto_sign_detached: jest.fn(),
  crypto_sign_verify_detached: jest.fn(),
  crypto_scalarmult: jest.fn(),
  crypto_kdf_derive_from_key: jest.fn(),
  crypto_aead_aes256gcm_encrypt: jest.fn(),
  crypto_aead_aes256gcm_decrypt: jest.fn(),
  crypto_pwhash: jest.fn(),
  crypto_hash_sha256: jest.fn(),
  randombytes_buf: jest.fn(),
  crypto_pwhash_ALG_ARGON2ID13: 1,
}));

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn(() => Promise.resolve({ isConnected: true, isInternetReachable: true })),
}));

jest.mock('zustand', () => ({
  create: (fn: any) => {
    let state: any = {};
    const listeners: Array<(state: any) => void> = [];

    const setState = (partial: any) => {
      state = typeof partial === 'function' ? partial(state) : { ...state, ...partial };
      listeners.forEach(l => l(state));
    };

    const getState = () => state;

    const subscribe = (listener: (state: any) => void) => {
      listeners.push(listener);
      return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
      };
    };

    const api = { getState, setState, subscribe };
    state = fn(setState, getState, api);
    return Object.assign(() => state, api);
  },
  persist: (fn: any, options: any) => fn,
  createJSONStorage: () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: null, isLoading: false, error: null })),
  useMutation: jest.fn(() => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  })),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Silence console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('act(...)') || args[0].includes('Warning:'))
  ) {
    return;
  }
  originalWarn.apply(console, args);
};
