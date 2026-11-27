/** 有効化できるログイン提供元と、提供元固有の設定・本人情報の解釈。 @trace ARCH-000012 */
import type { IDToken } from "openid-client";

type LoginCredentials = Readonly<{ clientId: string; clientSecret: string }>;
export type LoginProviderProfile = Readonly<{
  id: string;
  displayName: string;
  environmentNames: readonly string[];
  readConfiguration(environment: NodeJS.ProcessEnv): LoginCredentials;
  configurationError: string;
  unavailableError: string;
  discoveryUrl: string;
  acceptsIssuer(issuer: string): boolean;
  acceptsTenant?(claims: IDToken): boolean;
  invitationScope: string;
  readVerifiedEmail(claims: IDToken): string | null;
  accountSelectionPrompt?: string;
}>;

const googleIssuer = "https://accounts.google.com";
const google = Object.freeze({
  id: "google",
  displayName: "Google",
  environmentNames: ["CRDD_GOOGLE_CLIENT_ID", "CRDD_GOOGLE_CLIENT_SECRET"],
  configurationError: "google_login_configuration_invalid",
  unavailableError: "google_login_unavailable",
  discoveryUrl: googleIssuer,
  acceptsIssuer: (issuer) => issuer === googleIssuer,
  invitationScope: "openid email",
  accountSelectionPrompt: "select_account",
  readVerifiedEmail: ({ email, email_verified }) =>
    email_verified === true && typeof email === "string" ? email : null,
  readConfiguration(environment) {
    const clientId = environment.CRDD_GOOGLE_CLIENT_ID;
    const clientSecret = environment.CRDD_GOOGLE_CLIENT_SECRET;
    if (
      !clientId ||
      !/^[A-Za-z0-9_-]{1,256}\.apps\.googleusercontent\.com$/u.test(clientId) ||
      !clientSecret ||
      !/^[!-~]{1,1024}$/u.test(clientSecret)
    )
      throw new Error("google_login_configuration_invalid");
    return { clientId, clientSecret };
  },
} satisfies LoginProviderProfile);

export const loginProviderProfiles = Object.freeze({ google });

export type LoginProviderId = keyof typeof loginProviderProfiles;
export type PublicLoginProvider = Readonly<{ id: string; displayName: string }>;
export type LoginProviderConfiguration = Readonly<
  Partial<Record<LoginProviderId, LoginCredentials>>
>;

export function isLoginProviderId(value: unknown): value is LoginProviderId {
  return (
    typeof value === "string" && Object.hasOwn(loginProviderProfiles, value)
  );
}

/** 起動時の設定だけを取り込み、未対応や資格欠測の提供元を有効化しない。 */
export function configuredLoginProviders(config: unknown) {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("login_configuration_invalid");
  const entries = Object.entries(config);
  if (!entries.length) throw new Error("login_configuration_invalid");
  return entries.map(([id, value]) => {
    if (
      !isLoginProviderId(id) ||
      !value ||
      typeof value !== "object" ||
      Object.keys(value).length !== 2 ||
      !Object.hasOwn(value, "clientId") ||
      !Object.hasOwn(value, "clientSecret") ||
      typeof value.clientId !== "string" ||
      !value.clientId ||
      typeof value.clientSecret !== "string" ||
      !value.clientSecret
    )
      throw new Error("login_configuration_invalid");
    return {
      profile: loginProviderProfiles[id],
      credentials: {
        clientId: value.clientId,
        clientSecret: value.clientSecret,
      },
    };
  });
}
