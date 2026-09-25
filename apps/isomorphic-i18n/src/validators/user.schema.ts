import { z } from "zod";

// form zod validation schema
export const UpsertUserSchema = z.object({
  _id: z
    .string()
    .regex(/^[a-f\d]{24}$/i) // a Mongo ObjectId
    .optional(),
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().optional(),
  role: z.string().min(1),
  status: z.string().min(1),
  bmuNames: z.array(z.object({ value: z.string(), label: z.string() })),
  userBmu: z.object({ value: z.string(), label: z.string() }).optional(),
  fisherId: z.string().optional(),
});

// generate form types from zod validation schema
export type UpsertUserSchemaType = z.infer<typeof UpsertUserSchema>;
