// src/features/contacts/hooks/useContacts.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { contactsRepository } from '@/database/repositories/contacts';
import { conversationsRepository } from '@/database/repositories/conversations';
import { api } from '@/api/client';
import { ContactWithVerification, AddContactParams } from '../types';
import { Contact } from '@/types';

export function useContacts() {
  const { user } = useAuthStore();
  const [contacts, setContacts] = useState<ContactWithVerification[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userContacts = await contactsRepository.getAll(user.id);
      const enriched: ContactWithVerification[] = userContacts.map(c => ({
        ...c,
        isVerified: c.verificationStatus === 'VERIFIED',
        verificationStatus: c.verificationStatus,
        safetyNumber: c.safetyNumber ?? null,
        lastVerifiedAt: c.verifiedAt ?? undefined,
      }));
      setContacts(enriched);
    } catch (error) {
      console.error('Failed to load contacts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const filteredContacts = contacts.filter(c =>
    c.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactAccountId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addContact = useCallback(async (params: AddContactParams): Promise<ContactWithVerification | null> => {
    if (!user) return null;
    
    try {
      // First, try to get contact from server
      const serverContact = await api.getContact(params.accountId);
      if (!serverContact) {
        throw new Error('Contact not found on server');
      }

      // Create local contact
      const newContact = await contactsRepository.create({
        userId: user.id,
        contactAccountId: serverContact.accountId,
        contactDeviceId: serverContact.deviceId,
        displayName: params.displayName || serverContact.displayName,
        avatarUrl: serverContact.avatarUrl,
        identityKeyPublic: serverContact.identityKeyPublic,
        signedPrekeyPublic: serverContact.signedPrekeyPublic,
        signedPrekeySignature: serverContact.signedPrekeySignature,
        verificationStatus: 'UNVERIFIED',
        verifiedAt: null,
        safetyNumber: null,
        syncStatus: 'SYNCED',
        lastSyncedAt: Date.now(),
        serverVersion: 1,
        deletedAt: null,
      });

      const enriched: ContactWithVerification = {
        ...newContact,
        isVerified: false,
        verificationStatus: 'UNVERIFIED',
        safetyNumber: null,
        lastVerifiedAt: undefined,
      };

      setContacts(prev => [enriched, ...prev]);
      return enriched;
    } catch (error) {
      console.error('Failed to add contact:', error);
      throw error;
    }
  }, [user]);

  const updateContact = useCallback(async (contactId: string, updates: Partial<Omit<ContactWithVerification, 'id' | 'userId' | 'contactAccountId'>>) => {
    try {
      // Convert to Partial<Contact> for the repository
      const contactUpdates: Partial<Contact> = {};
      if (updates.displayName !== undefined) contactUpdates.displayName = updates.displayName;
      if (updates.avatarUrl !== undefined) contactUpdates.avatarUrl = updates.avatarUrl;
      if (updates.contactDeviceId !== undefined) contactUpdates.contactDeviceId = updates.contactDeviceId;
      if (updates.identityKeyPublic !== undefined) contactUpdates.identityKeyPublic = updates.identityKeyPublic;
      if (updates.signedPrekeyPublic !== undefined) contactUpdates.signedPrekeyPublic = updates.signedPrekeyPublic;
      if (updates.signedPrekeySignature !== undefined) contactUpdates.signedPrekeySignature = updates.signedPrekeySignature;
      if (updates.verificationStatus !== undefined) contactUpdates.verificationStatus = updates.verificationStatus;
      if (updates.verifiedAt !== undefined) contactUpdates.verifiedAt = updates.verifiedAt;
      if (updates.safetyNumber !== undefined) contactUpdates.safetyNumber = updates.safetyNumber;
      if (updates.syncStatus !== undefined) contactUpdates.syncStatus = updates.syncStatus;
      
      await contactsRepository.update(contactId, contactUpdates);
      setContacts(prev => prev.map(c => c.id === contactId ? { ...c, ...updates } : c));
    } catch (error) {
      console.error('Failed to update contact:', error);
      throw error;
    }
  }, []);

  const blockContact = useCallback(async (contactId: string) => {
    return updateContact(contactId, { verificationStatus: 'BLOCKED' });
  }, [updateContact]);

  const unblockContact = useCallback(async (contactId: string) => {
    return updateContact(contactId, { verificationStatus: 'UNVERIFIED' });
  }, [updateContact]);

  const deleteContact = useCallback(async (contactId: string) => {
    try {
      await contactsRepository.delete(contactId);
      setContacts(prev => prev.filter(c => c.id !== contactId));
    } catch (error) {
      console.error('Failed to delete contact:', error);
      throw error;
    }
  }, []);

  return {
    contacts: filteredContacts,
    allContacts: contacts,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    refresh,
    addContact,
    updateContact,
    blockContact,
    unblockContact,
    deleteContact,
  };
}

export function useContact(contactId: string | null) {
  const { user } = useAuthStore();
  const [contact, setContact] = useState<ContactWithVerification | null>(null);
  const [loading, setLoading] = useState(false);

  const loadContact = useCallback(async () => {
    if (!contactId || !user) return;
    setLoading(true);
    try {
      const c = await contactsRepository.getById(contactId);
      if (c && c.userId === user.id) {
        setContact({
          ...c,
          isVerified: c.verificationStatus === 'VERIFIED',
          verificationStatus: c.verificationStatus,
          safetyNumber: c.safetyNumber ?? null,
          lastVerifiedAt: c.verifiedAt ?? undefined,
        });
      }
    } catch (error) {
      console.error('Failed to load contact:', error);
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  return { contact, loading, refresh: loadContact };
}

export function useContactVerification() {
  const { user } = useAuthStore();

  const verifySafetyNumber = useCallback(async (
    contact: ContactWithVerification,
    expectedNumber: string
  ): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // In a real implementation, this would use the crypto verification module
      // For now, we'll do a simple string comparison
      const isValid = contact.safetyNumber?.toLowerCase() === expectedNumber.toLowerCase().replace(/-/g, '');
      
      if (isValid) {
        await contactsRepository.update(contact.id, {
          verificationStatus: 'VERIFIED',
          verifiedAt: Date.now(),
        });
      }
      
      return isValid;
    } catch (error) {
      console.error('Failed to verify safety number:', error);
      return false;
    }
  }, [user]);

  const requestVerification = useCallback(async (contactId: string) => {
    if (!user) return;
    
    try {
      // Send verification request to contact
      // This would typically send a push notification or in-app message
      console.log('Verification requested for contact:', contactId);
    } catch (error) {
      console.error('Failed to request verification:', error);
    }
  }, [user]);

  return { verifySafetyNumber, requestVerification };
}

export function useNewContact() {
  const { user } = useAuthStore();
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchByAccountId = useCallback(async (id: string) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    
    try {
      const contact = await api.getContact(id);
      if (!contact) {
        setError('Contact not found');
        return null;
      }
      return contact;
    } catch (err) {
      setError('Failed to search contact');
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const reset = useCallback(() => {
    setAccountId('');
    setError(null);
  }, []);

  return {
    accountId,
    setAccountId,
    loading,
    error,
    searchByAccountId,
    reset,
  };
}