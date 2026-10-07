// src/utils/id.ts

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 15)}`;
}

export function generateShortId(): string {
  return Math.random().toString(36).slice(2, 10);
}