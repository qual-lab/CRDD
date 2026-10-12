/**
 * ログイン済みHostの初回設定コマンドを構成する。
 * @responsibility CLI入力・TTY・環境・表示名を扱い、保存と鍵提示は既存Ownerへ委譲する。
 * @trace ARCH-000013
 */
import { createInterface } from "node:readline/promises";
import type { CrosRootInput } from "../../../domain-model/src/index.ts";
import { initializeFromHost } from "./initialize-from-host.ts";
import { readHostInitializationState } from "../state/file-store.ts";
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
 * 初回設定の明示CLIを入力から非秘密の終了案内まで実行する。
 * @responsibility 起動条件をRoot Effectより先に検査し、入力interfaceを確実に閉じる。
 * @trace ARCH-000013
 * @input 引数・Host環境・共有stdin/stdout・取消Signal。
 * @returns Exit code。0は鍵提示後の接続待ちで、初回設定全体の完了ではない。
 * @precondition bin／配布入口のログイン済みHost操作者だけ。旧Writer停止は切替前提。
 * @postcondition 対話interfaceを閉じ、自分の取消Listenerを回収して共有streamを保持する。
 * @effect 正規initializeだけRoot準備・表示名入力・初回保存・鍵一度提示を行う。
 * @failure 不正args/env/非TTYは準備0。旧入力・Root故障は保持停止、例外は固定案内だけ。
 * @invariant 初回以外の鍵管理・交換・Role変更を公開しない。
 * @boundary Host CLI→Root準備→既存初回composition。
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
      "CRDD Access Management\n使い方: crdd-access-management --initialize\nCROS_TRUST_DOMAIN_IDとOS標準保存先を使用します。Host対話端末で初回管理者の表示名を入力し、鍵を一度だけ表示します。\n旧構成からの切替では、フロントAIが旧Writerの停止と旧入力の移行・清掃を確認してください。\n鍵の発行・失効・交換はMCPへ公開しません。本入口の通常鍵管理・交換は未接続です。\n",
    ))
      ? 0
      : 1;
  if (args.length !== 1 || args[0] !== "--initialize") {
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
      "初回設定はHostの対話端末から実行してください。\n",
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
