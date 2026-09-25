import { z } from 'zod';

export const GenerateResetPasswordTokenSchema = z.object({
  email: z.string().min(1).email(),
});

export type GenerateResetPasswordTokenType = z.infer<typeof GenerateResetPasswordTokenSchema>;
