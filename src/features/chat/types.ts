// src/features/chat/types.ts
import { Message, Conversation, Contact } from '@/types';

export interface ChatMessage extends Message {
  isOptimistic?: boolean;
  isSending?: boolean;
  isFailed?: boolean;
}

export interface ConversationWithLastMessage extends Conversation {
  lastMessage?: ChatMessage;
  unreadCount: number;
  contact?: Contact;
}

export interface SendMessageParams {
  conversationId: string;
  content: string;
  contentType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'SYSTEM';
  attachments?: string[];
  replyToMessageId?: string;
}

export interface ChatScreenProps {
  conversationId: string;
  conversation?: ConversationWithLastMessage;
}

export interface MessageListProps {
  messages: ChatMessage[];
  currentUserId: string;
  onLoadMore?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export interface MessageInputProps {
  conversationId: string;
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface ConversationListProps {
  conversations: ConversationWithLastMessage[];
  onSelect: (conversationId: string) => void;
  onNewChat: () => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export interface ContactSelectorProps {
  contacts: Contact[];
  onSelect: (contact: Contact) => void;
  selectedContactIds?: string[];
  multiSelect?: boolean;
  title?: string;
}

export interface MessageBubbleProps {
  message: ChatMessage;
  isOwn: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  onLongPress?: (message: ChatMessage) => void;
  onRetry?: (messageId: string) => void;
}

export interface TypingIndicatorProps {
  userName: string;
}

export interface ChatHeaderProps {
  title: string;
  subtitle?: string;
  avatar?: string;
  onPress?: () => void;
  actions?: React.ReactNode;
}