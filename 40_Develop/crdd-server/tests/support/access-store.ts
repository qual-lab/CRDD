/**
 * Serverの試験が所有する空のアクセス管理保存先を準備する。
 * @packageDocumentation
 * @responsibility 合成Host配置を作り、AMの公開入口で保存先を確定する。
 * @trace ARCH-000012
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  readExistingHostRoot,
  readFilesystemStoreDirectory,
  resolveHostRootInput,
} from "@qual-lab/crdd-access-management";

/** 所有済みの試験領域だけに空のHost保存先を作る。 @trace ARCH-000012 */
export function prepareAccessStore(
  ownedDirectory: string,
  trustDomainId = "access-fixture",
) {
  assert.match(trustDomainId, /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u);
  assert.equal(fs.realpathSync.native(ownedDirectory), ownedDirectory);
  const input = resolveHostRootInput({
    CROS_TRUST_DOMAIN_ID: trustDomainId,
    LOCALAPPDATA: ownedDirectory,
    HOME: ownedDirectory,
    XDG_STATE_HOME: ownedDirectory,
  });
  assert.ok(input);
  let directory = ownedDirectory;
  for (const segment of [input.publisher, input.application, trustDomainId]) {
    directory = path.join(directory, segment);
    fs.mkdirSync(directory);
  }
  const root = readExistingHostRoot(input);
  assert.ok(root);
  assert.equal(readFilesystemStoreDirectory(root), directory);
  return { root, directory };
}

/** 実提供元への接続を伴わない合成値で、共有CLIの設定検査を通す。 @trace ARCH-000012 */
export function syntheticSharedEnvironment(repositoryRoot: string) {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return {
    CRDD_LOGIN_PROVIDERS: '["google"]',
    CRDD_GOOGLE_CLIENT_ID: "synthetic.apps.googleusercontent.com",
    CRDD_GOOGLE_CLIENT_SECRET: "synthetic-secret",
    CRDD_SHARED_REPOSITORY_ROOTS: JSON.stringify([repositoryRoot]),
    CRDD_GIT_HOSTS: JSON.stringify([
      {
        host: "github.com",
        provider: "github",
        providerData: {
          clientIdEnv: "CRDD_GITHUB_CLIENT_ID",
          clientSecretEnv: "CRDD_GITHUB_CLIENT_SECRET",
        },
      },
    ]),
    CRDD_GITHUB_CLIENT_ID: "synthetic-github-app",
    CRDD_GITHUB_CLIENT_SECRET: "synthetic-github-secret",
    CRDD_MCP_OAUTH_CLIENTS: JSON.stringify([
      { id: "desktop", redirects: ["http://127.0.0.1:18443/callback"] },
    ]),
    CRDD_MCP_OAUTH_SIGNING_KEY: privateKey
      .export({ format: "pem", type: "pkcs8" })
      .toString(),
  };
}
