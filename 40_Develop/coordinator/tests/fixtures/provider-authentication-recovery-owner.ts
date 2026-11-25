/**
 * Claude再認証のProcess喪失Fixtureを実行する。
 *
 * @packageDocumentation
 * @responsibility 試験専用Homeの実File Lockとactive回復記録を作成し、解放処理なしのProcess終了状態を構築する。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、claude-authentication、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: 別Process・Repository-local Filesystem境界
 */
import fs from "node:fs";
import path from "node:path";
import { prepareAuthenticationProjection } from "../support/authentication.ts";
import { acquireProviderHomeLock } from "../../src/lifecycle/host.ts";
import {
  beginProviderAuthenticationRecovery,
  createProviderAuthenticationRecoveryRecord,
} from "../../src/lifecycle/authentication.ts";

const [stableLogicalHomeBindingHash, providerHome, suffix, token] =
  process.argv.slice(2);
if (!stableLogicalHomeBindingHash || !providerHome || !suffix || !token)
  process.exit(70);
const homes = path.dirname(providerHome);
const root = path.dirname(homes);
if (
  path.dirname(root) !==
    path.resolve(import.meta.dirname, "../../../../.crdd/tests") ||
  !path.basename(root).startsWith("provider-auth-process-") ||
  path.basename(homes) !== "ProviderHomes" ||
  path.basename(providerHome) !== "claude" ||
  ![root, homes, providerHome].every((directory) => {
    const stat = fs.lstatSync(directory);
    return (
      stat.isDirectory() &&
      !stat.isSymbolicLink() &&
      fs.realpathSync.native(directory) === directory
    );
  })
)
  process.exit(70);
const acquisition = acquireProviderHomeLock(
  stableLogicalHomeBindingHash,
  homes,
);
if (acquisition.status !== "acquired") process.exit(71);
const plan = prepareAuthenticationProjection(
  "claude",
  "login",
  providerHome,
  suffix,
  token,
);
if (!plan) process.exit(72);
const record = createProviderAuthenticationRecoveryRecord(
  providerHome,
  stableLogicalHomeBindingHash,
  plan,
);
if (!record) process.exit(73);
if (beginProviderAuthenticationRecovery(record) !== "created") process.exit(74);
// 親が試験専用の残存Fileを照合できるよう、取得結果だけを同期通知する。
// 明示releaseを呼ばず終了し、同じHomeに協調Fileが残る状態を再現する。
fs.writeSync(
  process.stdout.fd,
  `${JSON.stringify(acquisition.lock.reference)}\n`,
);
