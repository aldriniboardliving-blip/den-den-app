// src/features/auth/validation.ts

import { z } from 'zod';

export const identifierSchema = z
  .string()
  .min(1, 'Identifier is required')
  .refine(
    (val) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      return emailRegex.test(val) || phoneRegex.test(val);
    },
    { message: 'Please enter a valid email or phone number' }
  );

export const otpCodeSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d+$/, 'OTP must contain only numbers');

export const deviceInfoSchema = z.object({
  deviceId: z.string().uuid('Invalid device ID'),
  deviceName: z.string().min(1, 'Device name is required').max(100),
  platform: z.enum(['ios', 'android', 'web']),
  platformVersion: z.string().min(1),
  appVersion: z.string().min(1),
  identityKeyPublic: z.string().min(1, 'Identity key is required'),
  signedPrekeyPublic: z.string().min(1, 'Signed prekey is required'),
  signedPrekeySignature: z.string().min(1, 'Prekey signature is required'),
  signedPrekeyCreatedAt: z.number().positive(),
  onetimePrekeys: z.array(
    z.object({
      id: z.number().int().positive(),
      publicKey: z.string().min(1),
    })
  ).min(1, 'At least one one-time prekey is required'),
});

export const otpRequestSchema = z.object({
  identifier: identifierSchema,
  type: z.enum(['EMAIL', 'SMS']),
  purpose: z.enum(['REGISTER', 'LOGIN', 'DEVICE_ADD']),
});

export const otpVerifySchema = z.object({
  identifier: identifierSchema,
  code: otpCodeSchema,
  type: z.enum(['EMAIL', 'SMS']),
  purpose: z.enum(['REGISTER', 'LOGIN', 'DEVICE_ADD']),
  deviceInfo: deviceInfoSchema,
});

export type IdentifierInput = z.infer<typeof identifierSchema>;
export type OtpCodeInput = z.infer<typeof otpCodeSchema>;
export type DeviceInfoInput = z.infer<typeof deviceInfoSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
