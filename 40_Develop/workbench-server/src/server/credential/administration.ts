/**
 * Workbenchの同Process鍵管理と用途限定HTTP提示を接続する。
 * @responsibility 入力を閉じたAM操作へ搬送し、秘密を汎用画面状態へ保持しない。
 * @trace ARCH-000013
 * @boundary Browser管理POST、AM保存Owner、Node HTTP Response。
 * @effect 明示操作の保存・提示前後記録・一応答・交換記録終了。
 * @security MCP・Remote・汎用GETへ鍵を返さず、追加受領Gateを作らない。
 */
import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import type { FilesystemStoreRoot } from "../../../../domain-model/src/index.ts";
import {
  issueCredential,
  revokeCredential,
  exchangeCredentials,
  finishKeyExchange,
  updateCredentialPresentationState,
  readCredentialAdministrationState,
  resolveConnectionAuthentication,
  confirmInitialConnection,
} from "../../../../access-management/src/index.ts";

/**
 * 同Processの管理Rootと現在Bearerを明示する。
 * @responsibility Remote接続や過去の認可Snapshotを管理Authorityへ転用させない。
 * @trace ARCH-000013
 * @shape root、token。
 * @invariant tokenは当該要求のServer memoryだけで、各操作がfresh認可する。CROSのログイン状態としてProcess全体へ保持しない。
 * @boundary 信頼したWorkbench構成Ownerから内部管理Consumer。
 * @security Rootは内部構成だけ。Bearerは検査済み専用接続POST、単一Authorization Header、または限定構成から要求memoryへ渡し、公開結果へ含めない。
 * @compatibility 新AMだけ。旧CROS Registryとの併用・fallbackなし。
 */
export type CredentialAdministration = Readonly<{
  root: FilesystemStoreRoot;
  token: string;
}>;

/**
 * 完全なWorkbench接続Formだけを現在の同Process認証へ渡す。
 * @responsibility 初回限定候補を既存確認保存へ接続し、通常認証を取り直してから接続資格を返す。
 * @trace ARCH-000013
 * @input 検証済み管理Root、容量とOrigin確認済みForm、起動専用Action Token、要求Signal。
 * @returns Server memory専用の接続資格を返す。認可結果ではなく、Browserへserializeしない。
 * @precondition Callerが同Origin・Host・Content-Type・Body上限を検査済みである。
 * @postcondition 初回相関から直接Roleや内容権限を生成せず、通常操作は次HTTP要求のfresh認証へ残す。
 * @effect AM既存認証、初回候補だけ既存確認保存とfresh再認証。
 * @failure 不正・重複・未知入力、認証不成立、確認不明、取消は固定例外で拒否する。
 * @invariant 管理RootはFormから取得せず、新Session・資格発行・自動再送を追加しない。
 * @boundary Browserの用途限定POSTとAM保存Owner。
 * @security 鍵・入力本文・内部Rootを例外へ含めず、永続化・log・応答へ渡さない。
 * @concurrency 保存前後に取消を確認する。保存後取消をrollbackと表示しない。
 */
export function authenticateWorkbenchConnection(
  root: FilesystemStoreRoot,
  form: URLSearchParams,
  expectedActionToken: string,
  signal: AbortSignal,
): CredentialAdministration {
  const fields = ["actionToken", "operation", "token"];
  const token = form.get("token");
  if (
    [...form.keys()].some((key) => !fields.includes(key)) ||
    fields.some((key) => form.getAll(key).length !== 1) ||
    !/^[A-Za-z0-9_-]{43}$/u.test(expectedActionToken) ||
    form.get("actionToken") !== expectedActionToken ||
    form.get("operation") !== "connect" ||
    !token ||
    token.length > 4096 ||
    token.trim() !== token
  )
    throw new Error("workbench_local_connection_input_invalid");
  if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
  let authentication = resolveConnectionAuthentication(root, token);
  if (authentication.status === "initial") {
    const confirmed = confirmInitialConnection(
      root,
      token,
      authentication.binding,
      signal,
    );
    if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
    if (confirmed.status !== "completed")
      throw new Error("workbench_local_connection_unavailable");
    authentication = resolveConnectionAuthentication(root, token);
  }
  if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
  if (authentication.status !== "normal")
    throw new Error("workbench_local_connection_unavailable");
  return Object.freeze({ root, token });
}

/**
 * 用途限定の管理POST応答を表す。
 * @responsibility 鍵提示応答と記録終了・拒否を区別する。
 * @trace ARCH-000013
 * @shape contract、contractRevision、status、operation、reason、非秘密相関。presentingだけtoken。
 * @invariant presentingは保存済み鍵の出力要求で、提示確認・交換全体完了・本人受領ではない。
 * @boundary 管理POSTだけ。汎用Client Modelへ入れない。
 * @security 秘密はpresentingの一応答だけ。保存・再取得・MCP公開0。
 * @compatibility 最新のissue／revoke／exchange-user／exchange-all契約。
 */
export type CredentialAdministrationResult = Readonly<{
  contract: "crdd/workbench/credential-action";
  contractRevision: 1;
  operation: "issue" | "revoke" | "exchange-user" | "exchange-all";
  reason: string;
  operationId: string;
  userId: string;
  credentialId?: string;
  recoveryId?: string;
  publication?: "not_attempted" | "unconfirmed" | "confirmed";
  cleanupConfirmed?: boolean;
  firstFailure?: string;
  secondaryFailure?: string | null;
  observedRevision?: number | null;
  lastConfirmedOperationId?: string | null;
  lastConfirmedStage?: string;
}> &
  (
    | Readonly<{ status: "presenting"; token: string; credentialId: string }>
    | Readonly<{ status: "completed" | "blocked"; token?: never }>
  );

/**
 * 保存Ownerの未完了事実を非秘密の応答fieldへ写す。
 * @responsibility 最初の失敗と後続清掃不明を分離し、全内部結果を透過しない。
 * @trace ARCH-000013
 * @input 内部保存Ownerの型確認済み結果だけ。
 * @returns 出版・清掃・主副失敗・既知相関の存在するfieldだけ。
 * @precondition arbitrary入力や例外本文を渡さない。
 * @postcondition token・Root・内部Pathを返さない。
 * @effect N/A: 局所投影だけ。
 * @failure N/A: 存在する型fieldだけを選択する。
 * @invariant unavailableから未保存・rollback・Effect0を推定しない。
 * @boundary AM結果と管理POSTの非秘密失敗情報。
 * @security 既存固定理由だけ。例外文字列の公開0。
 * @concurrency 当該要求の結果だけで、共有状態へ蓄積しない。
 */
function credentialFailureFacts(
  result: Readonly<{
    status: string;
    publication?: "not_attempted" | "unconfirmed" | "confirmed";
    cleanupConfirmed?: boolean;
    primaryFailure?: string;
    firstFailure?: string;
    secondaryReason?: string;
    secondaryFailure?: string | null;
    observedRevision?: number | null;
    lastConfirmedOperationId?: string | null;
    lastConfirmedStage?: string;
  }>,
) {
  return {
    ...(result.publication !== undefined
      ? { publication: result.publication }
      : {}),
    ...(result.cleanupConfirmed !== undefined
      ? { cleanupConfirmed: result.cleanupConfirmed }
      : {}),
    ...(result.firstFailure || result.primaryFailure
      ? { firstFailure: result.firstFailure ?? result.primaryFailure }
      : {}),
    ...(result.secondaryFailure !== undefined ||
    result.secondaryReason !== undefined
      ? {
          secondaryFailure:
            result.secondaryFailure ?? result.secondaryReason ?? null,
        }
      : {}),
    ...(result.observedRevision !== undefined
      ? { observedRevision: result.observedRevision }
      : {}),
    ...(result.lastConfirmedOperationId !== undefined
      ? { lastConfirmedOperationId: result.lastConfirmedOperationId }
      : {}),
    ...(result.lastConfirmedStage !== undefined
      ? { lastConfirmedStage: result.lastConfirmedStage }
      : {}),
  };
}

/**
 * 閉じた管理Formを保存開始前に検査する。
 * @responsibility 旧権限field・重複・未知値をAM観測より先に拒否する。
 * @trace ARCH-000013
 * @input 上限確認済みURLSearchParams。
 * @returns 許可した操作と期待改訂。
 * @precondition Origin・Action TokenはHost入口が別途確認する。
 * @postcondition UUID生成・Root観測・保存0。
 * @effect N/A: Request局所値の検査だけ。
 * @failure 不正入力を固定例外で拒否する。
 * @invariant Browserから任意Root・Bearer・Role設定を受け取らない。
 * @boundary Browser Formと内部AM操作。
 * @security 例外へ入力本文や秘密を含めない。
 * @concurrency 同じFormを再更新・自動再送しない。
 */
function readCredentialAction(form: URLSearchParams) {
  const operation = form.get("operation");
  if (
    operation !== "issue" &&
    operation !== "revoke" &&
    operation !== "exchange-user" &&
    operation !== "exchange-all"
  )
    throw new Error("workbench_credential_input_rejected");
  const allowed = ["actionToken", "operation", "expectedRevision", "userId"];
  if (operation === "revoke") allowed.push("credentialId");
  if (operation.startsWith("exchange-"))
    allowed.push(
      "displayedOldCredentialIds",
      "confirmed",
      "previousRecoveryId",
    );
  for (const key of form.keys())
    if (!allowed.includes(key) || form.getAll(key).length !== 1)
      throw new Error("workbench_credential_input_rejected");
  const revisionText = form.get("expectedRevision") ?? "";
  const expectedRevision = Number(revisionText);
  const userId = form.get("userId") ?? "";
  if (
    !/^[1-9]\d*$/.test(revisionText) ||
    !Number.isSafeInteger(expectedRevision) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      userId,
    )
  )
    throw new Error("workbench_credential_input_rejected");
  if (
    operation === "revoke" &&
    !/^[0-9a-f]{24}$/.test(form.get("credentialId") ?? "")
  )
    throw new Error("workbench_credential_input_rejected");
  let oldIds: string[] = [];
  if (operation.startsWith("exchange-")) {
    const parsed: unknown = JSON.parse(
      form.get("displayedOldCredentialIds") ?? "",
    );
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (id) => typeof id === "string" && /^[0-9a-f]{24}$/.test(id),
      ) ||
      new Set(parsed).size !== parsed.length
    )
      throw new Error("workbench_credential_input_rejected");
    oldIds = parsed;
    if (form.has("confirmed") && form.get("confirmed") !== "true")
      throw new Error("workbench_credential_input_rejected");
    if (
      form.has("previousRecoveryId") &&
      !/^access-management\.key-exchange\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        form.get("previousRecoveryId") ?? "",
      )
    )
      throw new Error("workbench_credential_input_rejected");
  }
  return {
    operation,
    expectedRevision,
    userId,
    oldIds,
    confirmed: form.get("confirmed") === "true",
  } as const;
}

/**
 * 一回の管理JSON応答をfinishと先行故障から観測する。
 * @responsibility finishをClient受領へ強めず、自分のListenerと短命byteを回収する。
 * @trace ARCH-000013
 * @input Host所有Response、短命応答、取消Signal。
 * @returns 全byteのfinishと通知tickまで故障なしの場合だけtrue。
 * @precondition 既存Security HeaderをHostが設定済み。
 * @postcondition 応答一回、秘密Buffer消去、自分のListenerだけ回収。
 * @effect Node Responseへのend一回。失敗時の再送0。
 * @failure error・finish前close・abortはfalse。開始済みResponseの終了を待つ。
 * @invariant finishはブラウザ描画・本人閲覧の証明ではない。
 * @boundary 管理POSTとHTTP socket。
 * @security no-store、URL／Location／汎用GET保存0。
 * @concurrency 同Responseに追加出力せず、開始後取消は所有Responseを破棄してcloseを待つ。
 */
async function presentCredentialResponse(
  response: ServerResponse,
  value: CredentialAdministrationResult,
  signal: AbortSignal,
): Promise<boolean> {
  const bytes = Buffer.from(JSON.stringify(value), "utf8");
  if (signal.aborted || response.destroyed) {
    bytes.fill(0);
    return false;
  }
  return new Promise((resolve) => {
    let failed = false,
      joined = false;
    const finish = () => settle(true);
    const error = () => {
      failed = true;
      if (!response.destroyed) response.destroy();
    };
    const close = () => {
      if (!response.writableFinished) failed = true;
      settle(response.writableFinished);
    };
    const abort = () => {
      failed = true;
      response.destroy();
    };
    const settle = (finished: boolean) => {
      if (joined) return;
      joined = true;
      bytes.fill(0);
      setImmediate(() => {
        response.removeListener("finish", finish);
        response.removeListener("error", error);
        response.removeListener("close", close);
        signal.removeEventListener("abort", abort);
        resolve(finished && !failed && !signal.aborted);
      });
    };
    response.on("finish", finish);
    response.on("error", error);
    response.on("close", close);
    signal.addEventListener("abort", abort, { once: true });
    try {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Content-Length", bytes.length);
      response.statusCode = value.status === "blocked" ? 409 : 200;
      response.end(bytes);
    } catch {
      failed = true;
      response.destroy();
      if (response.destroyed) settle(false);
    }
  });
}

/**
 * 明示したWorkbench鍵操作を保存と用途限定一応答へ接続する。
 * @responsibility 最新改訂と現在認可をAMへ渡し、応答終了後の提示確認・交換終了をjoinする。
 * @trace ARCH-000013
 * @input 同Process管理依存、検査済みForm、所有Response、取消Signal。
 * @returns N/A: 一応答と開始済み後処置を完了する。
 * @precondition HostがOrigin・容量・Action Tokenを検査済み。Remote構成なし。
 * @postcondition 汎用状態に秘密なし、再表示なし。保存後不明は既知Effectを保持する。
 * @effect AM保存・提示前後の別出版、HTTP一応答、交換だけrecord整理。
 * @failure 認可／競合／保存不明は非秘密停止、提示未確認ではconfirmed／finish0。
 * @invariant 提示は元相関、終了は操作対象に応じた有効管理者鍵でfresh認証する。Hostへのfallback0。
 * @boundary 同Process Workbench→AM保存Owner→Browser専用応答。
 * @security 生鍵をServer共有変数・Log・GETへ保持しない。
 * @concurrency 新要求を自動再実行せず、取消後に新Effectを開始しない。
 */
export async function executeCredentialAdministrationAction(
  administration: CredentialAdministration,
  form: URLSearchParams,
  response: ServerResponse,
  signal: AbortSignal,
): Promise<void> {
  const command = readCredentialAction(form);
  if (command.operation === "exchange-all" && !command.confirmed)
    throw new Error("workbench_credential_confirmation_required");
  if (signal.aborted || response.destroyed) return;
  const observed = readCredentialAdministrationState(
    administration.root,
    administration.token,
  );
  if (
    observed.status !== "completed" ||
    observed.snapshot.revision !== command.expectedRevision ||
    !observed.snapshot.users.some(
      (user) =>
        user.userId === command.userId &&
        (command.operation !== "exchange-all" || user.role === "administrator"),
    )
  )
    throw new Error("workbench_credential_state_unavailable");
  const previous = observed.snapshot.exchange;
  const operationId =
    command.operation.startsWith("exchange-") &&
    previous &&
    previous.stage !== "credential_stored"
      ? previous.operationId
      : randomUUID();
  const base = {
    contract: "crdd/workbench/credential-action" as const,
    contractRevision: 1 as const,
    operation: command.operation,
    operationId,
    userId: command.userId,
  };
  let token: string | null = null,
    credentialId: string | null = null,
    recoveryId: string | null = null;
  let completionToken: string | null = null;
  let revision = command.expectedRevision;
  try {
    if (command.operation === "revoke") {
      const result = revokeCredential(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.userId,
        form.get("credentialId") ?? "",
      );
      await presentCredentialResponse(
        response,
        {
          ...base,
          status: result.status === "completed" ? "completed" : "blocked",
          reason:
            result.status === "completed"
              ? "credential_revoked"
              : "credential_action_unconfirmed",
          credentialId: form.get("credentialId") ?? "",
          ...(result.status !== "completed"
            ? credentialFailureFacts(result)
            : {}),
        },
        signal,
      );
      return;
    }
    if (command.operation === "issue") {
      const result = issueCredential(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.userId,
      );
      if (
        result.status !== "completed" ||
        result.operation !== "issueCredential"
      ) {
        await presentCredentialResponse(
          response,
          {
            ...base,
            status: "blocked",
            reason: "credential_action_unconfirmed",
            ...credentialFailureFacts(result),
          },
          signal,
        );
        return;
      }
      token = result.token;
      credentialId = result.credentialId;
      revision = result.revision;
    } else {
      if (
        previous?.stage === "credential_stored" &&
        previous.presentation === "confirmed"
      ) {
        const finished = finishKeyExchange(
          administration.root,
          administration.token,
          revision,
          operationId,
          previous.recoveryId,
        );
        await presentCredentialResponse(
          response,
          {
            ...base,
            status: finished.status === "completed" ? "completed" : "blocked",
            reason:
              finished.status === "completed"
                ? "previous_exchange_record_closed_no_new_exchange"
                : "credential_action_unconfirmed",
            recoveryId: previous.recoveryId,
            userId: previous.recipientUserId,
            ...(finished.status !== "completed"
              ? credentialFailureFacts(finished)
              : {}),
          },
          signal,
        );
        return;
      }
      const result = exchangeCredentials(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.operation === "exchange-all" ? "all" : "targeted",
        command.userId,
        command.oldIds,
        command.confirmed,
        form.get("previousRecoveryId") ?? undefined,
      );
      if (result.status !== "completed" || result.token === null) {
        await presentCredentialResponse(
          response,
          {
            ...base,
            status: "blocked",
            reason: "credential_action_unconfirmed",
            ...credentialFailureFacts(result),
            ...("recoveryId" in result && result.recoveryId
              ? { recoveryId: result.recoveryId }
              : {}),
          },
          signal,
        );
        return;
      }
      token = result.token;
      credentialId = result.credentialId;
      recoveryId = result.recoveryId;
      revision = result.revision;
      completionToken =
        command.operation === "exchange-all" ||
        command.userId === observed.snapshot.actorUserId
          ? result.token
          : administration.token;
    }
    if (signal.aborted) return;
    const started = updateCredentialPresentationState(administration.root, {
      credentialId,
      issuanceOperationId: operationId,
      expectedRevision: revision,
      target: "unconfirmed",
    });
    if (started.status !== "completed") {
      await presentCredentialResponse(
        response,
        {
          ...base,
          status: "blocked",
          reason: "credential_presentation_not_started",
          ...credentialFailureFacts(started),
          credentialId,
          ...(recoveryId ? { recoveryId } : {}),
        },
        signal,
      );
      return;
    }
    const pending = presentCredentialResponse(
      response,
      {
        ...base,
        status: "presenting",
        reason: "stored_key_response",
        credentialId,
        token,
        ...(recoveryId ? { recoveryId } : {}),
      },
      signal,
    );
    token = null;
    if (!(await pending) || signal.aborted) return;
    const confirmed = updateCredentialPresentationState(administration.root, {
      credentialId,
      issuanceOperationId: operationId,
      expectedRevision: started.value.revision,
      target: "confirmed",
      presentationOperationId: started.value.presentationOperationId,
    });
    if (confirmed.status !== "completed" || signal.aborted || !recoveryId)
      return;
    if (completionToken !== null)
      finishKeyExchange(
        administration.root,
        completionToken,
        confirmed.value.revision,
        randomUUID(),
        recoveryId,
      );
  } finally {
    token = null;
    completionToken = null;
  }
}
