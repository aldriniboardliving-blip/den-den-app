# Den Den Frontend Architecture

## Overview

Feature-based architecture with clear separation of concerns. Business logic lives in features, not components. Expo Router for navigation.

## Project Structure

```
src/
├── app/                          # Expo Router routes (screens only)
│   ├── (auth)/                   # Auth stack
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── verify-otp.tsx
│   ├── (app)/                    # Main app stack (authenticated)
│   │   ├── _layout.tsx
│   │   ├── index.tsx             # Conversations list
│   │   ├── chat/
│   │   │   ├── [conversationId].tsx
│   │   │   └── _layout.tsx
│   │   ├── contacts/
│   │   │   ├── index.tsx
│   │   │   ├── add.tsx
│   │   │   └── [contactId].tsx
│   │   ├── settings/
│   │   │   ├── index.tsx
│   │   │   ├── backup.tsx
│   │   │   ├── security.tsx
│   │   │   └── notifications.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx               # Root layout
│   └── +not-found.tsx
├── components/                    # Shared UI components (presentation only)
│   ├── ui/                       # Design system primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Avatar.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Sheet.tsx
│   │   ├── Toast.tsx
│   │   ├── Spinner.tsx
│   │   └── index.ts
│   ├── chat/                     # Chat-specific reusable components
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── ConversationItem.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── AttachmentPreview.tsx
│   ├── common/                   # Truly generic components
│   │   ├── ErrorBoundary.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── EmptyState.tsx
│   │   └── PullToRefresh.tsx
│   └── index.ts
├── features/                      # Feature modules (business logic + UI)
│   ├── auth/
│   │   ├── api.ts                # Auth API calls
│   │   ├── store.ts              # Zustand auth state
│   │   ├── hooks.ts              # useAuth, useOTP, etc.
│   │   ├── types.ts
│   │   ├── validation.ts         # Zod schemas
│   │   └── components/           # Feature-specific components
│   │       ├── LoginForm.tsx
│   │       ├── OTPInput.tsx
│   │       └── DeviceRegistration.tsx
│   ├── chat/
│   │   ├── api.ts
│   │   ├── store.ts
│   │   ├── hooks.ts              # useMessages, useSendMessage, etc.
│   │   ├── types.ts
│   │   ├── encryption.ts         # Feature-specific encryption helpers
│   │   ├── components/
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageComposer.tsx
│   │   │   └── ConversationHeader.tsx
│   │   └── utils.ts
│   ├── contacts/
│   │   ├── api.ts
│   │   ├── store.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── ContactList.tsx
│   │       ├── ContactItem.tsx
│   │       ├── AddContactSheet.tsx
│   │       └── VerificationModal.tsx
│   ├── backup/
│   │   ├── api.ts
│   │   ├── store.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   ├── crypto.ts             # Backup encryption/decryption
│   │   └── components/
│   │       ├── ExportBackupScreen.tsx
│   │       ├── ImportBackupScreen.tsx
│   │       └── BackupPasswordInput.tsx
│   ├── settings/
│   │   ├── store.ts
│   │   ├── hooks.ts
│   │   ├── types.ts
│   │   └── components/
│   │       ├── SettingsScreen.tsx
│   │       ├── SecuritySettings.tsx
│   │       └── NotificationSettings.tsx
│   └── onboarding/
│       ├── store.ts
│       ├── hooks.ts
│       └── components/
│           ├── WelcomeScreen.tsx
│           ├── PermissionsScreen.tsx
│           └── DeviceSetupScreen.tsx
├── database/                      # SQLite layer
│   ├── schema.ts                 # Drizzle/Expo SQLite schema
│   ├── migrations/               # Migration files
│   ├── repositories/             # Data access layer
│   │   ├── messages.ts
│   │   ├── conversations.ts
│   │   ├── contacts.ts
│   │   ├── devices.ts
│   │   └── syncQueue.ts
│   ├── connection.ts             # DB initialization
│   └── index.ts
├── crypto/                        # Core cryptographic operations
│   ├── keys.ts                   # Key generation, storage, rotation
│   ├── encryption.ts             # Message encryption/decryption
│   ├── backup.ts                 # Backup encryption/decryption
│   ├── verification.ts           # Safety numbers
│   ├── keystore.ts               # Secure Enclave / Keystore wrapper
│   ├── types.ts
│   └── index.ts
├── api/                           # API client layer
│   ├── client.ts                 # Axios/fetch wrapper with interceptors
│   ├── endpoints.ts              # Endpoint definitions
│   ├── types.ts                  # API request/response types
│   ├── auth.ts                   # Token management
│   └── errors.ts                 # Error handling
├── realtime/                      # WebSocket connection
│   ├── connection.ts             # WS connection management
│   ├── handlers.ts               # Event handlers
│   ├── types.ts
│   └── index.ts
├── sync/                          # Offline sync engine
│   ├── queue.ts                  # Sync queue processor
│   ├── processor.ts              # Operation handlers
│   ├── network.ts                # Network monitoring
│   ├── background.ts             # Background task registration
│   ├── types.ts
│   └── index.ts
├── store/                         # Global Zustand stores
│   ├── auth.ts
│   ├── ui.ts                     # Loading, toasts, modals
│   ├── network.ts                # Online/offline status
│   └── index.ts
├── hooks/                         # Shared React hooks
│   ├── useAppSelector.ts         # Typed Zustand selector
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   ├── usePermissions.ts
│   └── index.ts
├── types/                         # Shared TypeScript types
│   ├── api.ts
│   ├── database.ts
│   ├── crypto.ts
│   ├── messages.ts
│   ├── conversations.ts
│   ├── contacts.ts
│   └── index.ts
├── utils/                         # Pure utility functions
│   ├── date.ts
│   ├── string.ts
│   ├── validation.ts
│   ├── crypto.ts                 # Helpers (base64, uuid, etc.)
│   ├── platform.ts
│   └── index.ts
├── constants/                     # App constants
│   ├── config.ts                 # API URLs, timeouts, limits
│   ├── theme.ts                  # Colors, spacing, typography
│   ├── storage.ts                # Storage keys
│   └── index.ts
├── styles/                        # Global styles
│   ├── global.css
│   └── variables.css
└── navigation/                    # Navigation helpers
    ├── types.ts
    ├── guards.ts                 # Route guards
    └── index.ts
```

---

## State Management

### Zustand Stores

```typescript
// store/auth.ts
interface AuthState {
  user: User | null;
  device: Device | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  setUser: (user: User) => void;
  setDevice: (device: Device) => void;
}

// store/chat.ts
interface ChatState {
  conversations: Conversation[];
  messages: Map<string, Message[]>; // conversationId -> messages
  activeConversationId: string | null;
  optimisticMessages: Map<string, OptimisticMessage>;
  sendMessage: (conversationId: string, content: string) => Promise<string>;
  markAsRead: (conversationId: string) => void;
  setActiveConversation: (id: string | null) => void;
}

// store/ui.ts
interface UIState {
  toasts: Toast[];
  modals: Modal[];
  loading: Record<string, boolean>;
  showToast: (toast: Omit<Toast, 'id'>) => string;
  hideToast: (id: string) => void;
  showModal: (modal: Omit<Modal, 'id'>) => string;
  hideModal: (id: string) => void;
  setLoading: (key: string, loading: boolean) => void;
}
```

### TanStack Query for Server State

```typescript
// features/chat/api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
    staleTime: 30000,
    enabled: useAuthStore(s => s.isAuthenticated),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (msg: SendMessageInput) => api.sendMessage(msg),
    onMutate: async (newMessage) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages', newMessage.conversationId] });
      const previous = queryClient.getQueryData(['messages', newMessage.conversationId]);
      queryClient.setQueryData(['messages', newMessage.conversationId], old => [...old, optimisticMessage(newMessage)]);
      return { previous };
    },
    onError: (err, newMessage, context) => {
      queryClient.setQueryData(['messages', newMessage.conversationId], context.previous);
    },
    onSettled: (data, error, newMessage) => {
      queryClient.invalidateQueries({ queryKey: ['messages', newMessage.conversationId] });
    },
  });
}
```

---

## Navigation

### Expo Router Structure

```typescript
// app/_layout.tsx
import { Stack } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="(app)" />
        </>
      ) : (
        <>
          <Stack.Screen name="(auth)" />
        </>
      )}
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
```

### Route Guards

```typescript
// navigation/guards.ts
import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export function useAuthGuard(redirectTo = '/login') {
  const router = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace(redirectTo as any);
    }
  }, [isAuthenticated, router, redirectTo]);
}

export function useGuestGuard(redirectTo = '/') {
  const router = useRouter();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirectTo as any);
    }
  }, [isAuthenticated, router, redirectTo]);
}
```

---

## Component Patterns

### Presentation vs Container

```tsx
// components/chat/MessageBubble.tsx (PRESENTATION - no business logic)
interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export function MessageBubble({ message, isOwn, onPress, onLongPress }: MessageBubbleProps) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.container}>
      <Text style={[styles.text, isOwn ? styles.ownText : styles.otherText]}>
        {message.content}
      </Text>
      <MessageStatus status={message.status} />
    </Pressable>
  );
}
```

```tsx
// features/chat/components/ChatScreen.tsx (CONTAINER - orchestrates)
export function ChatScreen({ conversationId }: { conversationId: string }) {
  const { messages, sendMessage } = useChatStore();
  const conversationMessages = messages.get(conversationId) || [];
  const [text, setText] = useState('');
  
  const handleSend = () => {
    if (text.trim()) {
      sendMessage(conversationId, text);
      setText('');
    }
  };
  
  return (
    <View style={styles.container}>
      <MessageList messages={conversationMessages} />
      <MessageComposer value={text} onChangeText={setText} onSend={handleSend} />
    </View>
  );
}
```

### Custom Hooks for Logic

```typescript
// features/chat/hooks.ts
export function useMessages(conversationId: string) {
  const messages = useChatStore(s => s.messages.get(conversationId));
  const { data: serverMessages } = useMessagesQuery(conversationId);
  const syncQueue = useSyncQueue();
  
  // Merge local + server, deduplicate by messageId
  const mergedMessages = useMemo(() => 
    mergeMessages(messages, serverMessages), 
    [messages, serverMessages]
  );
  
  return mergedMessages;
}

export function useSendMessage() {
  const { sendMessage } = useChatStore();
  const { enqueue } = useSyncQueue();
  const crypto = useCrypto();
  
  return useCallback(async (conversationId: string, content: string) => {
    // 1. Create local message
    const messageId = await sendMessage(conversationId, content);
    
    // 2. Encrypt for each recipient
    const recipients = await getRecipients(conversationId);
    for (const recipient of recipients) {
      const envelope = await crypto.encryptMessage(content, recipient.keyBundle);
      await enqueue('MESSAGE_SEND', 'messages', messageId, { envelope });
    }
    
    return messageId;
  }, [sendMessage, enqueue, crypto]);
}
```

---

## Theming

```typescript
// constants/theme.ts
export const Colors = {
  light: {
    background: '#FFFFFF',
    surface: '#F8F9FA',
    primary: '#007AFF',
    primaryText: '#FFFFFF',
    text: '#000000',
    textSecondary: '#666666',
    border: '#E0E0E0',
    error: '#FF3B30',
    success: '#34C759',
    warning: '#FF9500',
  },
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    primary: '#0A84FF',
    primaryText: '#000000',
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    border: '#38383A',
    error: '#FF453A',
    success: '#32D74B',
    warning: '#FF9F0A',
  },
} as const;

export const Spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
} as const;

export const BorderRadius = {
  sm: 4, md: 8, lg: 12, xl: 16, full: 9999,
} as const;

export const Typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
} as const;
```

### Themed Components

```tsx
// components/ui/ThemedView.tsx
import { useColorScheme } from 'react-native';
import { Colors } from '@/constants/theme';

export function ThemedView({ 
  style, 
  themeColor = 'background', 
  ...props 
}: ViewProps & { themeColor?: keyof typeof Colors.light }) {
  const colorScheme = useColorScheme() ?? 'light';
  const color = Colors[colorScheme][themeColor];
  
  return <View style={[{ backgroundColor: color }, style]} {...props} />;
}
```

---

## Error Handling

### Error Boundaries

```tsx
// components/common/ErrorBoundary.tsx
interface Props { children: React.ReactNode; fallback?: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to error reporting service (no sensitive data)
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }
  
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={styles.container}>
          <ThemedText type="title">Something went wrong</ThemedText>
          <ThemedText type="body">{this.state.error?.message}</ThemedText>
          <Button onPress={() => this.setState({ hasError: false, error: null })}>
            Try again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}
```

### Global Error Handler

```typescript
// api/errors.ts
export function handleApiError(error: unknown): AppError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;
    
    switch (status) {
      case 401: return { type: 'UNAUTHORIZED', message: 'Session expired' };
      case 403: return { type: 'FORBIDDEN', message: 'Access denied' };
      case 404: return { type: 'NOT_FOUND', message: 'Not found' };
      case 429: return { type: 'RATE_LIMITED', message: 'Too many requests', retryAfter: data?.retryAfter };
      case 500: return { type: 'SERVER_ERROR', message: 'Server error' };
      default: return { type: 'UNKNOWN', message: data?.detail || 'Request failed' };
    }
  }
  return { type: 'NETWORK_ERROR', message: 'Network error' };
}
```

---

## Performance

### FlatList Optimization

```tsx
// features/chat/components/MessageList.tsx
const MessageItem = React.memo(({ message, isOwn }: { message: Message; isOwn: boolean }) => (
  <MessageBubble message={message} isOwn={isOwn} />
));

export function MessageList({ messages }: { messages: Message[] }) {
  const isOwn = useChatStore(s => s.device?.id);
  
  return (
    <FlatList
      data={messages}
      keyExtractor={m => m.id}
      renderItem={({ item }) => <MessageItem message={item} isOwn={item.senderDeviceId === isOwn} />}
      inverted
      maintainVisibleContentPosition
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={10}
      removeClippedSubviews
      getItemLayout={(_, index) => ({
        length: 80, // Estimated height
        offset: 80 * index,
        index,
      })}
    />
  );
}
```

### Memoization

- `React.memo` for all list items
- `useMemo` for derived state
- `useCallback` for event handlers
- `useSelector` with shallow equality (Zustand)

---

## Accessibility

- All interactive elements: `accessibilityRole`, `accessibilityLabel`
- Dynamic Type support: `useFontScale` hook
- Color contrast: WCAG AA minimum
- Screen reader: Meaningful labels, hints
- Focus management: `onFocus`, `onBlur` for modals/sheets

---

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit (crypto, utils, hooks) | Vitest | 90%+ |
| Component (presentation) | React Native Testing Library | 80%+ |
| Integration (features) | Vitest + MSW | 70%+ |
| E2E (critical flows) | Detox | Key flows |

---

## References

- [Architecture](architecture.md)
- [Database](database.md)
- [Offline-First](offline-first.md)
- [Encryption](encryption.md)
- [API Design](api.md)
- [Testing](testing.md)