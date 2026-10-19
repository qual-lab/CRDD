/**
 * 実子Processで通常鍵変更または交換保存を一回実行する試験専用入口。
 * @responsibility stdinの試験専用入力を公開保存APIへ渡し、非秘密結果だけ返す。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-013
 * @level IT
 * @precondition 親試験が自己生成Rootと模擬Bearerを渡す。
 * @stimulus 発行・独立失効・交換保存を一回実行し、指定出版位置では実終了する。
 * @observation status・生成回数・出版・清掃・固定理由だけをstdoutへ返す。
 * @oracle 親が実currentと相関し、一採用・敗者の生成0・Process喪失後の材料を判定する。
 * @cleanup 親がProcessをjoinして自己生成Rootを回収する。
 * @boundary Node実Process・pipe入力・AM公開内部API。
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  exchangeCredentials,
  exchangeCredentialsFromHost,
  finishKeyExchangeFromHost,
  issueCredential,
  revokeCredential,
} from "../../src/index.ts";

const input = JSON.parse(fs.readFileSync(0, "utf8")) as {
  directory: string;
  token: string;
  operationId: string;
  userId: string;
  credentialId: string;
  operation: "issue" | "revoke" | "exchange" | "host_exchange" | "host_finish";
  expectedRevision?: number;
  previousRecoveryId?: string;
  recoveryId?: string;
  scope?: "targeted" | "all";
  displayedOldCredentialIds?: string[];
  crashPhase?: number;
  crashTiming?: "before" | "after";
};
const root = createFilesystemStoreRoot(input.directory);
if (!root) throw new Error("fixture_root_invalid");
let generated = 0;
const random = crypto.randomBytes;
const rename = fs.renameSync;
let publications = 0;
if (input.crashPhase !== undefined)
  fs.renameSync = (from, to) => {
    publications++;
    if (publications === input.crashPhase && input.crashTiming === "before")
      process.exit(71);
    rename(from, to);
    if (publications === input.crashPhase && input.crashTiming === "after")
      process.exit(71);
  };
crypto.randomBytes = ((size: number) => {
  generated++;
  return random(size);
}) as typeof crypto.randomBytes;
const result =
  input.operation === "issue"
    ? issueCredential(root, input.token, 1, input.operationId, input.userId)
    : input.operation === "exchange"
      ? exchangeCredentials(
          root,
          input.token,
          input.expectedRevision ?? 1,
          input.operationId,
          input.scope ?? "targeted",
          input.userId,
          input.displayedOldCredentialIds,
          true,
          input.previousRecoveryId,
        )
      : input.operation === "host_exchange"
        ? exchangeCredentialsFromHost(
            root,
            input.expectedRevision ?? 1,
            input.operationId,
            input.scope ?? "targeted",
            input.userId,
            input.displayedOldCredentialIds,
            true,
            input.previousRecoveryId,
          )
        : input.operation === "host_finish"
          ? finishKeyExchangeFromHost(
              root,
              input.expectedRevision ?? 1,
              input.operationId,
              input.recoveryId ?? "",
            )
          : revokeCredential(
              root,
              input.token,
              1,
              input.operationId,
              input.userId,
              input.credentialId,
            );
process.stdout.write(
  `${JSON.stringify({
    status: result.status,
    generated,
    reason: "reason" in result ? result.reason : null,
    publication: "publication" in result ? result.publication : null,
    cleanupConfirmed:
      "cleanupConfirmed" in result ? result.cleanupConfirmed : null,
    lastConfirmedStage:
      "lastConfirmedStage" in result ? result.lastConfirmedStage : null,
  })}\n`,
);
