/**
 * ログイン済みHostの初回設定と明示的な鍵交換コマンドを構成する。
 * @responsibility CLI入力・TTY・環境・表示名を扱い、保存と鍵提示は既存Ownerへ委譲する。
 * @trace ARCH-000013
 */
import { createInterface } from "node:readline/promises";
import { randomUUID } from "node:crypto";
import type {
  CrosRootInput,
  FilesystemStoreRoot,
} from "../../../domain-model/src/index.ts";
import { exchangeFromHost } from "../credential/exchange-from-host.ts";
import { initializeFromHost } from "./initialize-from-host.ts";
import {
  readHostInitializationState,
  readAccessManagementState,
  finishKeyExchangeFromHost,
} from "../state/file-store.ts";
import {
  prepareHostInitializationRoot,
  type HostPreviousInputObservation,
} from "./prepare-host-root.ts";

/**
 * 非秘密のコマンド案内を共有出力へ書き込む。
 * @responsibility 出力故障を成功へ変換せず、追加したListenerだけを解放する。
 * @trace ARCH-000013
 * @input 共有出力と固定非秘密の案内。
 * @returns callbackと通知tickを処置できた場合だけtrue。
 * @precondition 案内にSecret・内部Root・例外本文を含めない。
 * @postcondition write一回、callback join後に自身のerror Listenerを除去する。
 * @effect 標準出力への案内。end／destroyは0。
 * @failure throw・write errorはfalse、callback未着は保留。
 * @invariant 案内出力を鍵提示や初回完了の根拠にしない。
 * @boundary CLI出力とNode Writable。
 * @security Secretを受け取らない私有処理。
 * @concurrency 自身のcallbackを待ち、既存Listenerを変更しない。
 */
async function writeHostNotice(
  output: NodeJS.WriteStream,
  text: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let failed = false;
    let joined = false;
    const fail = () => {
      failed = true;
    };
    const finish = (error?: Error | null) => {
      if (joined) return;
      joined = true;
      setImmediate(() => {
        output.removeListener("error", fail);
        resolve(!error && !failed);
      });
    };
    output.on("error", fail);
    try {
      output.write(text, finish);
    } catch {
      finish(new Error("host_notice_failed"));
    }
  });
}

/**
 * Host環境から既存CROS配置契約の入力だけを選ぶ。
 * @responsibility Publisher・Applicationを固定し、任意Path引数や秘密環境値を読まない。
 * @trace ARCH-000013
 * @input Process Environmentと実OS。
 * @returns 固定用途Root入力、または不足・未対応のnull。
 * @precondition ログイン済みHostの環境であり、Remote要求ではない。
 * @postcondition CROS_TRUST_DOMAIN_IDとOS標準領域だけを搬送する。
 * @effect N/A: 環境の選択だけ。
 * @failure 環境不足・未対応OSはnull。
 * @invariant Secret環境値・Repository Rootを保存先へ使わない。
 * @boundary Host CLIと既存Root Resolver。
 * @security 認証・User・Roleを環境から生成しない。
 * @concurrency 開始時の入力Snapshotだけを使用する。
 */
function resolveHostRootInput(
  environment: NodeJS.ProcessEnv,
): CrosRootInput | null {
  const trustDomainId = environment.CROS_TRUST_DOMAIN_ID;
  if (!trustDomainId) return null;
  if (process.platform === "win32") {
    if (!environment.LOCALAPPDATA) return null;
    return {
      platform: "win32",
      trustDomainId,
      publisher: "qual-lab",
      application: "cros",
      localAppData: environment.LOCALAPPDATA,
    };
  }
  if (process.platform !== "linux" || !environment.HOME) return null;
  return {
    platform: "linux",
    trustDomainId,
    publisher: "qual-lab",
    application: "cros",
    homeDirectory: environment.HOME,
    ...(environment.XDG_CONFIG_HOME
      ? { xdgConfigHome: environment.XDG_CONFIG_HOME }
      : {}),
    ...(environment.XDG_STATE_HOME
      ? { xdgStateHome: environment.XDG_STATE_HOME }
      : {}),
    ...(environment.XDG_RUNTIME_DIR
      ? { xdgRuntimeDirectory: environment.XDG_RUNTIME_DIR }
      : {}),
  };
}

/**
 * Host交換の対象表示と確認を保存Consumerへ接続する。
 * @responsibility 所有Snapshotから影響を表示し、現在条件の採用は保存Ownerへ任せる。
 * @trace ARCH-000013
 * @input 検証済みRoot、選択範囲・発行先UUID、対話stream、取消Signal。
 * @returns 非秘密のExit code。0は当該交換または前記録整理だけの成立。
 * @precondition ログイン済みHost、起動条件と旧入力確認済み。
 * @postcondition yes後だけ操作UUIDを生成し、readlineを閉じてから鍵提示する。
 * @effect 現在状態観測・非秘密影響表示・確認入力、既存交換または記録終了。
 * @failure 観測不明・材料処置・対象差・未確認・取消は新交換を開始しない。
 * @invariant OS操作者をAM Userへ同一視せず、前記録整理を指定新交換の完了にしない。
 * @boundary CLI選択→Host内部composition。MCP公開操作ではない。
 * @security Verifier・salt・内部Path・例外本文を表示しない。生鍵はTTY Ownerだけ。
 * @concurrency 表示改訂と固定旧集合を保存時に再評価し、入力待機のListenerを回収する。
 */
async function runHostExchangeCommand(
  root: FilesystemStoreRoot,
  scope: "targeted" | "all",
  recipientUserId: string,
  input: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
  signal: AbortSignal,
): Promise<number> {
  const observed = readAccessManagementState(root);
  if (observed.status !== "completed" || !observed.cleanupConfirmed) {
    await writeHostNotice(
      output,
      "現在の管理状態を確認できないため停止しました。\n",
    );
    return 2;
  }
  if (observed.publication !== "not_attempted") {
    await writeHostNotice(
      output,
      "保存済み材料を整理しました。対象を新しく確認するため、同じコマンドを再実行してください。\n",
    );
    return 2;
  }
  const state = observed.value;
  const recipient = state.users.find((user) => user.userId === recipientUserId);
  if (
    !recipient ||
    (scope === "all" && recipient.role !== "administrator") ||
    state.unresolvedKeyExchanges.length > 1 ||
    (state.initialization.stage !== "completed" &&
      (state.initialization.stage !== "credential_stored" ||
        scope !== "targeted" ||
        state.initialization.userId !== recipientUserId))
  ) {
    await writeHostNotice(
      output,
      "発行先・範囲または初回段階が交換条件に一致しないため停止しました。\n",
    );
    return 2;
  }
  const previous = state.unresolvedKeyExchanges[0];
  const newCredential =
    previous?.stage === "credential_stored"
      ? state.credentials.find(
          (credential) => credential.credentialId === previous.newCredentialId,
        )
      : undefined;
  const closeOnly =
    previous?.stage === "credential_stored" &&
    newCredential?.presentation === "confirmed";
  if (
    previous &&
    !closeOnly &&
    (previous.stage !== "credential_stored"
      ? previous.scope !== scope || previous.recipientUserId !== recipientUserId
      : scope === "targeted" && previous.recipientUserId !== recipientUserId)
  ) {
    await writeHostNotice(
      output,
      "未完了交換と対象・範囲が一致しないため停止しました。\n",
    );
    return 2;
  }
  const ids =
    previous && previous.stage !== "credential_stored"
      ? [...previous.oldCredentialIds]
      : state.credentials
          .filter(
            (credential) =>
              !credential.revoked &&
              (scope === "all" || credential.userId === recipientUserId),
          )
          .map((credential) => credential.credentialId);
  const priorRecipient = previous
    ? state.users.find((user) => user.userId === previous.recipientUserId)
    : undefined;
  if (previous && !priorRecipient) return 2;
  const notice =
    closeOnly && previous && priorRecipient
      ? `前の交換は鍵提示を確認済みです。記録だけを終了します。\n元範囲: ${previous.scope === "all" ? "全員" : "指定ユーザー"}\n元発行先: ${priorRecipient.username} (${priorRecipient.userId})\n起点: ${previous.entry}\n鍵の再表示と、今回指定した新しい交換は行いません。\n`
      : `Host鍵交換\n範囲: ${scope === "all" ? "全ユーザーの有効資格（発行先administratorの有効資格も対象）" : "指定ユーザーの有効資格"}\n発行先: ${recipient.username} (${recipient.userId})\n処置する旧資格: ${ids.length}件\n${ids.map((id) => `- ${id}`).join("\n")}\n${previous?.stage === "credential_stored" && priorRecipient ? `前の発行先: ${priorRecipient.username} (${priorRecipient.userId})。未確認の保存済み鍵を別の明示交換で置き換えます。\n` : previous ? "保存済みの同じ交換を続けます。\n" : ""}ユーザー・Role・公開設定・Repository本体は保持します。新しい鍵は一度だけ表示します。\n`;
  if (!(await writeHostNotice(output, notice)) || signal.aborted) return 2;
  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const terminal = createInterface({ input, output, terminal: true });
  const cancelInput = () => controller.abort();
  terminal.on("SIGINT", cancelInput);
  terminal.on("close", cancelInput);
  terminal.on("error", cancelInput);
  output.on("error", cancelInput);
  output.on("close", cancelInput);
  let answer: string;
  try {
    answer = await terminal.question(
      "実行する場合だけ yes と入力してください: ",
      { signal: activeSignal },
    );
  } catch {
    return 2;
  } finally {
    terminal.removeListener("SIGINT", cancelInput);
    terminal.removeListener("close", cancelInput);
    terminal.removeListener("error", cancelInput);
    output.removeListener("error", cancelInput);
    output.removeListener("close", cancelInput);
    terminal.close();
  }
  if (answer !== "yes" || activeSignal.aborted) return 2;
  try {
    const completionOperationId = randomUUID();
    if (closeOnly && previous) {
      const finished = finishKeyExchangeFromHost(
        root,
        state.revision,
        completionOperationId,
        previous.recoveryId,
      );
      if (activeSignal.aborted || finished.status !== "completed") {
        await writeHostNotice(
          output,
          "前の交換記録の終了は未確認です。保存済みの事実を保持して停止しました。\n",
        );
        return 2;
      }
      return (await writeHostNotice(
        output,
        "前の交換記録を終了しました。鍵の再表示・今回指定の新交換は行っていません。新しい交換が必要なら再実行してください。\n",
      ))
        ? 0
        : 1;
    }
    const exchangeOperationId =
      previous && previous.stage !== "credential_stored"
        ? previous.operationId
        : randomUUID();
    const result = await exchangeFromHost(
      root,
      {
        expectedRevision: state.revision,
        exchangeOperationId,
        completionOperationId,
        scope,
        recipientUserId,
        displayedOldCredentialIds: ids,
        confirmed: true,
        ...(previous?.stage === "credential_stored"
          ? { previousRecoveryId: previous.recoveryId }
          : {}),
      },
      output,
      activeSignal,
    );
    if (result.status === "completed")
      return (await writeHostNotice(
        output,
        "鍵を一度提示し、交換記録を終了しました。初回設定中の場合は接続確認待ちです。\n",
      ))
        ? 0
        : 1;
    await writeHostNotice(
      output,
      result.status === "key_exchange_required"
        ? "保存済みの鍵は再表示しません。新しい明示交換を実行してください。\n"
        : "交換は未完了です。確定済みの保存と相関を保持して停止しました。\n",
    );
    return 2;
  } catch {
    await writeHostNotice(
      output,
      "交換は未完了です。確定済みの保存を保持して停止しました。\n",
    );
    return 2;
  }
}

/**
 * 初回設定とHost交換の明示CLIを入力から非秘密の終了案内まで実行する。
 * @responsibility 起動条件をRoot Effectより先に検査し、入力interfaceを確実に閉じる。
 * @trace ARCH-000013
 * @input 引数・Host環境・共有stdin/stdout・取消Signal。
 * @returns Exit code。0は当該提示または前交換記録の整理。初回設定全体の完了ではない。
 * @precondition bin／配布入口のログイン済みHost操作者だけ。旧Writer停止は切替前提。
 * @postcondition 対話interfaceを閉じ、自分の取消Listenerを回収して共有streamを保持する。
 * @effect 正規引数だけRoot準備、初回設定または確認済みHost交換と鍵一度提示を行う。
 * @failure 不正args/env/非TTYは準備0。旧入力・Root故障は保持停止、例外は固定案内だけ。
 * @invariant 通常発行・独立失効・Role変更・MCP鍵操作を公開しない。
 * @boundary Host CLI→Root準備→既存初回または交換composition。
 * @security Tokenを引数・環境・ログ・Resultへ保存せず、内部絶対Pathを案内へ透過しない。
 * @concurrency Signalは保存開始前と入力待ちへ伝播し、開始済み保存／TTYは既存Ownerをjoinする。
 */
export async function runHostAccessCommand(
  args: readonly string[],
  environment: NodeJS.ProcessEnv,
  input: NodeJS.ReadStream,
  output: NodeJS.WriteStream,
  signal: AbortSignal,
): Promise<number> {
  if (args.length === 1 && args[0] === "--help")
    return (await writeHostNotice(
      output,
      "CRDD Access Management\n使い方: crdd-access-management --initialize\n  --exchange-user <User UUID>\n  --exchange-all <発行先administrator UUID>\nCROS_TRUST_DOMAIN_IDとOS標準保存先を使用します。Host対話端末で対象・影響を確認し、鍵を一度だけ表示します。\n旧構成からの切替では、フロントAIが旧Writerの停止と旧入力の移行・清掃を確認してください。\n鍵の発行・失効・交換はMCPへ公開しません。\n",
    ))
      ? 0
      : 1;
  const initializing = args.length === 1 && args[0] === "--initialize";
  const exchanging =
    args.length === 2 &&
    (args[0] === "--exchange-user" || args[0] === "--exchange-all") &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      args[1] ?? "",
    );
  if (!initializing && !exchanging) {
    await writeHostNotice(
      output,
      "起動引数が不正です。--helpを参照してください。\n",
    );
    return 64;
  }
  const rootInput = resolveHostRootInput(environment);
  if (!rootInput) {
    await writeHostNotice(
      output,
      "Host保存先の環境が不足しているか、未対応OSです。\n",
    );
    return 64;
  }
  if (signal.aborted) return 2;
  if (
    input.isTTY !== true ||
    output.isTTY !== true ||
    !output.writable ||
    output.destroyed
  ) {
    await writeHostNotice(
      output,
      "鍵管理はHostの対話端末から実行してください。\n",
    );
    return 64;
  }
  const prepared = prepareHostInitializationRoot(rootInput);
  if (prepared.status !== "ready") {
    await writeHostNotice(
      output,
      prepared.createdDirectories.length === 0
        ? "Host保存先を確認できないため停止しました。\n"
        : "保存先の準備途中で停止しました。作成済みフォルダは保持しています。\n",
    );
    return 2;
  }
  let previous: HostPreviousInputObservation = prepared.observePrevious();
  if (previous.reason !== "legacy_inputs_absent") {
    await writeHostNotice(
      output,
      previous.reason === "host_previous_inputs_unknown"
        ? "旧入力を観測できないため停止しました。\n"
        : "旧管理・回復領域が残っています。フロントAIによる切替・移行確認が必要です。\n",
    );
    return 2;
  }
  if (signal.aborted) return 2;
  if (exchanging)
    return runHostExchangeCommand(
      prepared.root,
      args[0] === "--exchange-all" ? "all" : "targeted",
      args[1] ?? "",
      input,
      output,
      signal,
    );
  const saved = readHostInitializationState(prepared.root);
  if (saved.status === "existing") {
    await writeHostNotice(output, "設定済みです。初期化は行っていません。\n");
    return 2;
  }
  if (saved.status === "unknown") {
    await writeHostNotice(
      output,
      "保存済みの初回段階を確認できないため停止しました。\n",
    );
    return 2;
  }
  if (saved.status === "in_progress" && saved.stage === "credential_stored") {
    if (saved.presentation === "confirmed" && !saved.unresolvedExchange)
      return (await writeHostNotice(
        output,
        "鍵は提示済みです。保存した鍵で接続してください。再表示は行いません。\n",
      ))
        ? 0
        : 1;
    await writeHostNotice(
      output,
      "保存済みの鍵は再表示できません。明示的なHost鍵交換が必要です。\n",
    );
    return 2;
  }
  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const terminal = createInterface({ input, output, terminal: true });
  const cancelInput = () => controller.abort();
  terminal.on("SIGINT", cancelInput);
  terminal.on("close", cancelInput);
  terminal.on("error", cancelInput);
  output.on("error", cancelInput);
  output.on("close", cancelInput);
  let username: string;
  try {
    username = await terminal.question(
      "初回管理者の表示名（保存済みの名前は変更しません）: ",
      { signal: activeSignal },
    );
  } catch {
    await writeHostNotice(
      output,
      activeSignal.aborted
        ? "初回設定を取り消しました。\n"
        : "表示名の入力を完了できないため停止しました。\n",
    );
    return 2;
  } finally {
    terminal.removeListener("SIGINT", cancelInput);
    terminal.removeListener("close", cancelInput);
    terminal.removeListener("error", cancelInput);
    output.removeListener("error", cancelInput);
    output.removeListener("close", cancelInput);
    terminal.close();
  }
  if (activeSignal.aborted) return 2;
  try {
    const result = await initializeFromHost(
      prepared.root,
      username,
      true,
      () => {
        previous = prepared.observePrevious();
        return [previous.management, previous.attempt];
      },
      output,
      activeSignal,
    );
    if (result.status === "awaiting_connection") {
      return (await writeHostNotice(
        output,
        "鍵の提示を確認しました。この鍵で接続してください。初回設定は接続確認待ちです。\n",
      ))
        ? 0
        : 1;
    }
    if (result.status === "existing")
      await writeHostNotice(output, "設定済みです。初期化は行っていません。\n");
    else if (result.status === "key_exchange_required")
      await writeHostNotice(
        output,
        "保存済みの鍵は再表示できません。明示的なHost鍵交換が必要です。\n",
      );
    else if (result.status === "cancelled")
      await writeHostNotice(
        output,
        "初回設定を取り消しました。確定済みの保存は保持します。\n",
      );
    else
      await writeHostNotice(
        output,
        previous.reason !== "legacy_inputs_absent"
          ? "旧入力が変化したため停止しました。\n"
          : "初回設定は未完了です。保存済み段階を保持して停止しました。\n",
      );
    return 2;
  } catch {
    await writeHostNotice(
      output,
      "初回設定は未完了です。保存済み段階を保持して停止しました。\n",
    );
    return 2;
  }
}
