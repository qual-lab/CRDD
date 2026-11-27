/** 提供元固有の設定と発行者検査を、共通のログイン設定へ結合する。 @trace ARCH-000012 */
import type { IDToken } from "openid-client";
import { googleLogin } from "./login-google.ts";

const loginFailureReasons = [
  "login_configuration_invalid",
  "login_provider_unavailable",
  "host_login_origin_invalid",
  "host_administrator_unavailable",
  "host_initialization_unavailable",
] as const;
type LoginFailureReason = (typeof loginFailureReasons)[number];

export function loginFailure(reason: LoginFailureReason): Error {
  return new Error(reason);
}

export function readLoginFailure(
  error: unknown,
): LoginFailureReason | undefined {
  return error instanceof Error
    ? loginFailureReasons.find((reason) => reason === error.message)
    : undefined;
}

export type PublicLoginProvider = Readonly<{ id: string; displayName: string }>;
export function isLoginProviderName(id: string): boolean {
  return /^[a-z][a-z0-9-]{0,63}$/u.test(id);
}

type Discovery = Readonly<{
  issuer: URL;
  clientId: string;
  clientSecret: string;
}>;

export type LoginProviderProfile<C, Id extends string = string> = Readonly<{
  id: Id;
  displayName: string;
  environmentNames: readonly string[];
  readConfiguration(environment: NodeJS.ProcessEnv): C;
  parseConfiguration(value: unknown): C | null;
  discovery(configuration: C): Discovery;
  validateDiscoveryIssuer?(issuer: string, configuration: C): boolean;
  validateIssuer(issuer: string, configuration: C): boolean;
  acceptsTenant?(claims: IDToken, configuration: C): boolean;
  invitationScope: string;
  readVerifiedEmail(claims: IDToken): string | null;
  accountSelectionPrompt?: string;
}>;

export type ConfiguredLoginProvider = PublicLoginProvider &
  Readonly<{
    discovery: Discovery;
    validateDiscoveryIssuer(issuer: string): boolean;
    acceptsIssuer(issuer: string): boolean;
    acceptsTenant(claims: IDToken): boolean;
    invitationScope: string;
    readVerifiedEmail(claims: IDToken): string | null;
    accountSelectionPrompt?: string;
  }>;

export function defineLoginProvider<C, const Id extends string>(
  profile: LoginProviderProfile<C, Id>,
) {
  if (!isLoginProviderName(profile.id))
    throw loginFailure("login_configuration_invalid");
  return Object.freeze({
    id: profile.id,
    displayName: profile.displayName,
    environmentNames: profile.environmentNames,
    readConfiguration: profile.readConfiguration,
    configure(input: unknown): ConfiguredLoginProvider {
      const config = profile.parseConfiguration(input);
      if (!config) throw loginFailure("login_configuration_invalid");
      return {
        id: profile.id,
        displayName: profile.displayName,
        discovery: profile.discovery(config),
        validateDiscoveryIssuer: (issuer) =>
          profile.validateDiscoveryIssuer?.(issuer, config) ??
          profile.validateIssuer(issuer, config),
        acceptsIssuer: (issuer) => profile.validateIssuer(issuer, config),
        acceptsTenant: (claims) =>
          profile.acceptsTenant?.(claims, config) ?? true,
        invitationScope: profile.invitationScope,
        readVerifiedEmail: profile.readVerifiedEmail,
        ...(profile.accountSelectionPrompt && {
          accountSelectionPrompt: profile.accountSelectionPrompt,
        }),
      };
    },
  });
}

type Registration = Readonly<{
  configure(input: unknown): ConfiguredLoginProvider;
}>;

export const loginProviderProfiles = Object.freeze({
  [googleLogin.id]: defineLoginProvider(googleLogin),
});

export type LoginProviderId = keyof typeof loginProviderProfiles;
export type LoginProviderConfiguration = Readonly<{
  [Id in LoginProviderId]?: ReturnType<
    (typeof loginProviderProfiles)[Id]["readConfiguration"]
  >;
}>;

export function isLoginProviderId(value: unknown): value is LoginProviderId {
  return (
    typeof value === "string" && Object.hasOwn(loginProviderProfiles, value)
  );
}

/** 未登録の提供元を使わず、設定の詳細は対応する提供元だけが検査する。 */
export function configuredLoginProviders(
  config: unknown,
  registry: Readonly<Record<string, Registration>> = loginProviderProfiles,
): ConfiguredLoginProvider[] {
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw loginFailure("login_configuration_invalid");
  const entries = Object.entries(config);
  if (!entries.length) throw loginFailure("login_configuration_invalid");
  return entries.map(([id, value]) => {
    const profile = Object.hasOwn(registry, id) ? registry[id] : undefined;
    if (!profile) throw loginFailure("login_configuration_invalid");
    const provider = profile.configure(value);
    if (provider.id !== id) throw loginFailure("login_configuration_invalid");
    return provider;
  });
}
