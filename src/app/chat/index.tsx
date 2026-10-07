// src/app/chat/index.tsx
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function ChatIndex() {
  useEffect(() => {
    router.replace('/chat/list');
  }, []);

  return null;
}