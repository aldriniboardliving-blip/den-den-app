// src/features/contacts/types.ts
import type { Contact, Contact as ContactType } from '@/types';

export interface ContactWithVerification extends ContactType {
  isVerified: boolean;
  verificationStatus: 'UNVERIFIED' | 'VERIFIED' | 'BLOCKED' | 'PENDING';
  safetyNumber: string | null;
  lastVerifiedAt?: number;
}

export interface AddContactParams {
  accountId: string;
  deviceId?: string;
  displayName?: string;
}

export interface ContactVerificationResult {
  verified: boolean;
  safetyNumber: string;
  qrCodeData: string;
}

export interface QRCodeData {
  type: 'contact_verification';
  accountId: string;
  deviceId: string;
  identityKeyPublic: string;
  safetyNumber: string;
  timestamp: number;
}

export interface ContactSelectorOptions {
  multiSelect?: boolean;
  excludeContactIds?: string[];
  onSelect: (contacts: ContactWithVerification[]) => void;
  onCancel?: () => void;
}

export interface VerificationScreenProps {
  contact: ContactWithVerification;
  onVerified: () => void;
  onCancel: () => void;
}

export interface SafetyNumberDisplayProps {
  safetyNumber: string;
  qrCodeData: string;
  onCopy: () => void;
  onShare: () => void;
}

export interface ContactListItemProps {
  contact: ContactWithVerification;
  onPress: (contact: ContactWithVerification) => void;
  onLongPress?: (contact: ContactWithVerification) => void;
  showVerificationStatus?: boolean;
}

export interface AddContactScreenProps {
  onSuccess: (contact: ContactWithVerification) => void;
  onCancel: () => void;
}