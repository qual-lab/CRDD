/**
 * OAuthの共有起動設定と短命状態の失敗境界を検証する。
 * @trace ARCH-000012
 * @level UT
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  consumeOAuthEnvironment,
  readSharedOAuthConfiguration,
} from "../../src/cli/environment.ts";
import { bindGitHost, configuredGitHosts } from "../../src/service/git-host.ts";

test("共有OAuthは部分設定・重複Client・HTTP公開URLで旧方式に戻らない", () => {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const configuration = {
    CRDD_GOOGLE_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    CRDD_GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
    CRDD_MCP_OAUTH_CLIENTS: JSON.stringify([
      { id: "desktop", redirects: ["http://127.0.0.1:18443/callback"] },
    ]),
    CRDD_MCP_OAUTH_SIGNING_KEY: privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString(),
  };
  assert.equal(readSharedOAuthConfiguration({}), undefined);
  const githubSettings = {
    host: "github.com",
    provider: "github",
    providerData: {
      clientIdEnv: "CRDD_GIT_HOST_SAMPLE_CLIENT_ID",
      clientSecretEnv: "CRDD_GIT_HOST_SAMPLE_CLIENT_SECRET",
    },
  };
  const github = {
    ...configuration,
    CRDD_LOGIN_PROVIDERS: '["google"]',
    CRDD_GIT_HOSTS: JSON.stringify([githubSettings]),
    CRDD_SHARED_REPOSITORY_ROOTS: JSON.stringify([import.meta.dirname]),
    CRDD_GIT_HOST_SAMPLE_CLIENT_ID: "synthetic-github-app",
    CRDD_GIT_HOST_SAMPLE_CLIENT_SECRET: "synthetic-github-secret",
  };
  const implicit: NodeJS.ProcessEnv = { ...github };
  delete implicit.CRDD_LOGIN_PROVIDERS;
  assert.throws(() => consumeOAuthEnvironment(implicit, true), {
    message: "mcp_oauth_configuration_invalid",
  });
  assert.deepEqual(implicit, {});
  for (const roots of [undefined, "[", "[]", "[42]"]) {
    const invalid = { ...github, CRDD_SHARED_REPOSITORY_ROOTS: roots };
    assert.throws(() => consumeOAuthEnvironment(invalid, true), {
      message: "shared_repository_roots_invalid",
    });
    assert.deepEqual(invalid, {});
  }
  const valid = readSharedOAuthConfiguration(github);
  assert.ok(valid);
  assert.deepEqual(valid.loginProviders, {
    google: {
      clientId: configuration.CRDD_GOOGLE_CLIENT_ID,
      clientSecret: configuration.CRDD_GOOGLE_CLIENT_SECRET,
    },
  });
  const explicit = { ...github };
  assert.deepEqual(
    consumeOAuthEnvironment(explicit, true)?.loginProviders,
    valid.loginProviders,
  );
  assert.deepEqual(explicit, {});
  for (const loginProviders of [
    '["other"]',
    '["google","google"]',
    "[]",
    '"google"',
    "[",
  ]) {
    const invalid = { ...github, CRDD_LOGIN_PROVIDERS: loginProviders };
    assert.throws(() => consumeOAuthEnvironment(invalid, true), {
      message: "mcp_oauth_configuration_invalid",
    });
    assert.deepEqual(invalid, {});
  }
  const environment = { ...github, UNRELATED: "preserve" };
  assert.ok(consumeOAuthEnvironment(environment, true));
  assert.deepEqual(environment, { UNRELATED: "preserve" });
  const sharedGitHub = { ...github };
  const configured = consumeOAuthEnvironment(sharedGitHub, true)?.gitHosts;
  assert.equal(configured?.[0]?.providerData, undefined);
  const [host] = configuredGitHosts(configured).map(bindGitHost);
  assert.equal(host?.host, "github.com");
  assert.equal(host?.observePermission, undefined);
  assert.deepEqual(sharedGitHub, {});
  const withMonitor = {
    ...github,
    CRDD_GIT_HOSTS: JSON.stringify([
      {
        ...githubSettings,
        providerData: {
          ...githubSettings.providerData,
          privateKeyEnv: "CRDD_GITHUB_APP_PRIVATE_KEY",
        },
      },
    ]),
    CRDD_GITHUB_APP_PRIVATE_KEY: configuration.CRDD_MCP_OAUTH_SIGNING_KEY,
  };
  const [monitored] = configuredGitHosts(
    consumeOAuthEnvironment(withMonitor, true)?.gitHosts,
  ).map(bindGitHost);
  assert.equal(typeof monitored?.observePermission, "function");
  assert.deepEqual(withMonitor, {});
  const localGitHub = { ...github };
  assert.equal(consumeOAuthEnvironment(localGitHub, false), undefined);
  assert.deepEqual(localGitHub, {});
  const unselected: NodeJS.ProcessEnv = { ...github };
  delete unselected.CRDD_GIT_HOSTS;
  assert.throws(() => consumeOAuthEnvironment(unselected, true), {
    message: "git_hosts_configuration_required",
  });
  assert.deepEqual(unselected, {});
  const disabled = { ...github, CRDD_GIT_HOSTS: "[]" };
  assert.throws(() => consumeOAuthEnvironment(disabled, true), {
    message: "git_hosts_configuration_required",
  });
  assert.deepEqual(disabled, {});
  const staleSecret = { CRDD_GITHUB_CLIENT_SECRET: "synthetic-github-secret" };
  assert.equal(consumeOAuthEnvironment(staleSecret, true), undefined);
  assert.deepEqual(staleSecret, {});
  assert.equal(
    readSharedOAuthConfiguration({ CRDD_GIT_HOSTS: "[]" }),
    undefined,
  );
  for (const hosts of [
    JSON.stringify([{ ...githubSettings, host: "unconfigured.example.test" }]),
    JSON.stringify([{ ...githubSettings, provider: "unconfigured" }]),
    JSON.stringify([
      { ...githubSettings, apiBase: "https://other.example.test" },
    ]),
    JSON.stringify([
      {
        ...githubSettings,
        providerData: {
          ...githubSettings.providerData,
          clientSecretEnv: "PATH",
        },
      },
    ]),
    JSON.stringify([
      { ...githubSettings, clientSecret: "must-not-be-in-json" },
    ]),
    JSON.stringify([githubSettings, githubSettings]),
    '["github.com"]',
    '["gitlab.com"]',
    '["github.com","github.com"]',
    '["https://github.com"]',
    '"github.com"',
    "[",
  ]) {
    const invalid = { ...github, CRDD_GIT_HOSTS: hosts };
    assert.throws(() => consumeOAuthEnvironment(invalid, true), {
      message: "git_hosts_configuration_invalid",
    });
    assert.deepEqual(invalid, {});
  }
  assert.throws(
    () =>
      readSharedOAuthConfiguration({
        ...github,
        CRDD_GIT_HOST_SAMPLE_CLIENT_SECRET: undefined,
      }),
    { message: "git_host_connection_configuration_invalid" },
  );
  const incomplete = { CRDD_GOOGLE_CLIENT_SECRET: "synthetic-only" };
  assert.throws(() => consumeOAuthEnvironment(incomplete, true), {
    message: "mcp_oauth_configuration_invalid",
  });
  assert.deepEqual(incomplete, {});
  assert.equal(valid.mcpOAuth.clients[0]?.id, "desktop");
  assert.notEqual(
    readSharedOAuthConfiguration(github)?.mcpOAuth.verifier.secret,
    valid.mcpOAuth.verifier.secret,
  );
  for (const invalid of [
    { CRDD_GOOGLE_CLIENT_ID: configuration.CRDD_GOOGLE_CLIENT_ID },
    {
      ...github,
      CRDD_MCP_OAUTH_CLIENTS:
        '[{"id":"desktop","id":"overwrite","redirects":["http://127.0.0.1:18443/callback"]}]',
    },
    {
      ...github,
      CRDD_MCP_OAUTH_CLIENTS:
        '[{"id":"desktop","redirects":["http://external.example/callback"]}]',
    },
    { ...github, CRDD_MCP_OAUTH_SIGNING_KEY: "not a key" },
  ])
    assert.throws(() => readSharedOAuthConfiguration(invalid), {
      message: "mcp_oauth_configuration_invalid",
    });
});
