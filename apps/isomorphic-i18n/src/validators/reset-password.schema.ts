import { z } from 'zod';

import { messages } from '@/config/messages';

const password = z
  .string()
  .min(1, { message: messages.passwordRequired })
  .min(6, { message: messages.passwordLengthMin })
  .regex(/.*[A-Z].*/, { message: messages.passwordOneUppercase })
  .regex(/.*[a-z].*/, { message: messages.passwordOneLowercase })
  .regex(/.*\d.*/, { message: messages.passwordOneNumeric });

export const ResetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: password,
    token: z.string().min(1),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: messages.passwordsDidNotMatch,
    path: ['confirmPassword'],
  });

export type ResetPasswordType = z.infer<typeof ResetPasswordSchema>;
