import { z } from "zod";

const normalizedEmailSchema = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

const passwordSchema = z.string().min(8);

const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .transform((value) => value)
  .optional();

/**
 * A consent as submitted by a client.
 *
 * @remarks
 * Optional at the schema layer and required at the service layer, on purpose.
 * Whether consent is needed depends on where the instance stores data, which
 * zod cannot see; making it structurally required here would reject legitimate
 * mainland registrations, and making it structurally sufficient would let a
 * schema change quietly become a compliance change. The schema validates the
 * shape; `assertCrossBorderConsent` decides whether it had to be there.
 */
const consentDecisionSchema = z
  .object({
    accepted: z.boolean(),
    policy_version: z.string().trim().min(1),
  })
  .optional();

export const registerSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
  display_name: displayNameSchema,
  cross_border_consent: consentDecisionSchema,
});

/**
 * Account deletion re-authentication.
 *
 * @remarks
 * The session alone is not sufficient authority to destroy an account. Tokens
 * last seven days, so a leaked cookie or bearer would otherwise be enough to
 * erase everything the user has — and unlike every other action here, that one
 * cannot be undone or even inspected afterwards. Proving possession of the
 * password narrows the window from "any time in the last week" to "right now".
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export const recordConsentSchema = z.object({
  consent_type: z.enum(["cross_border_transfer", "sensitive_health_data"]),
  accepted: z.boolean(),
  policy_version: z.string().trim().min(1),
});

export const loginSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RecordConsentInput = z.infer<typeof recordConsentSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
