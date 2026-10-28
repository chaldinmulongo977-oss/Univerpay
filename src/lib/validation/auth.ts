import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Au moins 10 caractères")
  .regex(/[a-z]/, "Au moins une minuscule")
  .regex(/[A-Z]/, "Au moins une majuscule")
  .regex(/[0-9]/, "Au moins un chiffre");

export const loginSchema = z.object({
  email: z.string().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const registerSchema = z
  .object({
    lastName: z.string().trim().min(1, "Nom requis").max(80),
    middleName: z.string().trim().max(80).optional(),
    firstName: z.string().trim().min(1, "Prénom requis").max(80),
    email: z.string().email("Adresse e-mail invalide"),
    phone: z.string().trim().max(30).optional(),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "Vous devez accepter les conditions" }) }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export const forgotSchema = z.object({ email: z.string().email("Adresse e-mail invalide") });
export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { message: "Les mots de passe ne correspondent pas", path: ["confirmPassword"] });

export type RegisterInput = z.infer<typeof registerSchema>;
