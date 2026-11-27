/** Google固有の設定・発行者・メール証明を解釈する。 @trace ARCH-000012 */
import type { LoginProviderProfile } from "./login-providers.ts";

type GoogleSettings = Readonly<{ clientId: string; clientSecret: string }>;
const issuer = "https://accounts.google.com";

export const googleLogin = Object.freeze({
  id: "google",
  displayName: "Google",
  environmentNames: ["CRDD_GOOGLE_CLIENT_ID", "CRDD_GOOGLE_CLIENT_SECRET"],
  validateIssuer: (value) => value === issuer,
  discovery: (config) => ({ issuer: new URL(issuer), ...config }),
  invitationScope: "openid email",
  accountSelectionPrompt: "select_account",
  readVerifiedEmail: ({ email, email_verified }) =>
    email_verified === true && typeof email === "string" ? email : null,
  parseConfiguration(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 2 ||
      !Object.hasOwn(value, "clientId") ||
      !Object.hasOwn(value, "clientSecret") ||
      !("clientId" in value) ||
      !("clientSecret" in value) ||
      typeof value.clientId !== "string" ||
      !value.clientId ||
      typeof value.clientSecret !== "string" ||
      !value.clientSecret
    )
      return null;
    return { clientId: value.clientId, clientSecret: value.clientSecret };
  },
  readConfiguration(environment) {
    const clientId = environment.CRDD_GOOGLE_CLIENT_ID;
    const clientSecret = environment.CRDD_GOOGLE_CLIENT_SECRET;
    if (
      !clientId ||
      !/^[A-Za-z0-9_-]{1,256}\.apps\.googleusercontent\.com$/u.test(clientId) ||
      !clientSecret ||
      !/^[!-~]{1,1024}$/u.test(clientSecret)
    )
      throw new Error("login_configuration_invalid");
    return { clientId, clientSecret };
  },
} satisfies LoginProviderProfile<GoogleSettings, "google">);
