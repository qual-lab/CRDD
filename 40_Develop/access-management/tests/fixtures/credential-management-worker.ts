/**
 * 実子Processで通常鍵変更を一回実行する試験専用入口。
 * @responsibility stdinの試験専用入力を公開保存APIへ渡し、非秘密結果だけ返す。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @level IT
 * @precondition 親試験が自己生成Rootと模擬Bearerを渡す。
 * @stimulus 発行または独立失効を一回実行する。
 * @observation status・生成回数・出版・清掃・固定理由だけをstdoutへ返す。
 * @oracle 親が実currentと相関し、一採用と敗者の追加生成0を判定する。
 * @cleanup 親がProcessをjoinして自己生成Rootを回収する。
 * @boundary Node実Process・pipe入力・AM公開内部API。
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { issueCredential, revokeCredential } from "../../src/index.ts";

const input = JSON.parse(fs.readFileSync(0, "utf8")) as {
  directory: string;
  token: string;
  operationId: string;
  userId: string;
  credentialId: string;
  operation: "issue" | "revoke";
};
const root = createFilesystemStoreRoot(input.directory);
if (!root) throw new Error("fixture_root_invalid");
let generated = 0;
const random = crypto.randomBytes;
crypto.randomBytes = ((size: number) => {
  generated++;
  return random(size);
}) as typeof crypto.randomBytes;
const result =
  input.operation === "issue"
    ? issueCredential(root, input.token, 1, input.operationId, input.userId)
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
  })}\n`,
);
