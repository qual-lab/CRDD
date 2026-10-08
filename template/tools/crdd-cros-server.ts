#!/usr/bin/env node

/**
 * 配布RepositoryからCROS Shared Serverを起動する。
 *
 * @packageDocumentation
 * @responsibility OS管理設定、Credential Registry、Repository Binding、REST／MCP同一Origin GatewayおよびProcess終了を一つの公開入口へ構成する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary Host運用設定、CROS Runtime Root、Repository PoolおよびShared Server Processの境界。
 * @effect 固定ConfigとRepositoryを読取り、loopback Listenerを開始・終了する。
 * @security Secretを引数、Config、標準出力またはlogに要求せず、公開通信は外部HTTPS TLS終端を必須にする。
 */
import {
  createCredentialRegistryFileAdapter,
  readCrosSharedServerOperationalConfig,
} from "../../40_Develop/cros/src/index.ts";
import { startCrosSharedServer } from "../../40_Develop/mcp-server/src/index.ts";
import type { CrosRootInput } from "../../40_Develop/domain-model/src/repository/index.ts";

/**
 * Shared Server入口の利用方法を表示する。
 *
 * @responsibility 固定Config位置、必要環境変数、TLS終端およびBootstrap入口を人間へ案内する。
 * @trace ARCH-000013
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: 戻り値を返さない。
 * @precondition 標準出力へ書き込める。
 * @postcondition 秘密値を含まないHelpを一回表示する。
 * @effect 標準出力へ文字列を書き込む。
 * @failure 出力失敗をProcessへ返す。
 * @invariant 任意Config PathまたはBearer値の引数を案内しない。
 * @boundary CLIとHost Operatorの案内境界。
 * @security Token、Verifier、Repository Pathの実値を表示しない。
 * @concurrency N/A: 同期した一出力である。
 */
function printHelp(): void {
  process.stdout.write(
    [
      "CRDD CROS Shared Server",
      "",
      "使い方:",
      "  crdd-cros-server --serve",
      "",
      "必要環境:",
      "  CROS_TRUST_DOMAIN_ID=<server trust domain>",
      "",
      "設定はOS管理CROS Config Rootのshared-server.jsonだけを読みます。",
      "TLSは同一HostのReverse Proxyで終端し、Gatewayへx-forwarded-proto=httpsと期待Hostを上書きしてください。",
      "初回管理Credentialまたは管理不能時の回復にはcrdd-cros-access-recoveryを使用します。",
      "Bearer Tokenを引数、設定Fileまたは環境変数へ保存しないでください。",
      "",
    ].join("\n"),
  );
}

/**
 * Process EnvironmentからCROS Runtime Root入力を構成する。
 *
 * @responsibility Trust DomainとOS Known FolderだけをRuntime Data Resolverへ渡す。
 * @trace ARCH-000011
 * @trace ARCH-000013
 * @input Process environment key/value集合を受け取る。
 * @returns 検証候補Root入力またはnullを返す。
 * @precondition CROS_TRUST_DOMAIN_IDとOS Known Folderが設定されている。
 * @postcondition publisher=qual-lab、application=crosを固定する。
 * @effect N/A: Environmentを読むだけである。
 * @failure 不足値または未対応OSをnullで返す。
 * @invariant Caller指定のConfig Pathを受理しない。
 * @boundary Process EnvironmentとRuntime Data Resolverの境界。
 * @security Secret環境変数を読取らない。
 * @concurrency Process開始時の値だけを使用する。
 */
function resolveRootInput(
  environment: NodeJS.ProcessEnv,
): CrosRootInput | null {
  const trustDomainId = environment.CROS_TRUST_DOMAIN_ID;
  if (!trustDomainId) return null;
  if (process.platform === "win32") {
    if (!environment.LOCALAPPDATA) return null;
    return Object.freeze({
      platform: "win32",
      trustDomainId,
      publisher: "qual-lab",
      application: "cros",
      localAppData: environment.LOCALAPPDATA,
    });
  }
  if (process.platform === "linux") {
    if (!environment.HOME) return null;
    return Object.freeze({
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
    });
  }
  return null;
}

/**
 * SIGINT、SIGTERMまたは親標準入力終了を一度観測するまで待機する。
 *
 * @responsibility Process Signalまたは親Process喪失をShared Server cleanup開始へ一回だけ変換する。
 * @trace ARCH-000013
 * @input N/A: Process Signalを使用する。
 * @returns 最初に観測した停止理由を返すPromise。
 * @precondition Serverが起動済みである。
 * @postcondition 一つの停止境界受理後に全Listenerを解除する。
 * @effect Processへ一時Signal／stdin Listenerを登録・解除する。
 * @failure N/A: 許可した三つの停止境界だけを待つ。
 * @invariant 停止境界受理だけではProcessを即時終了せず、cleanup完了を待つ。
 * @boundary OS Process Signal／親stdinとShared Server Lifecycleの境界。
 * @security SignalをAuthorityまたはContent Grantに使用しない。
 * @concurrency 最初の一Signalだけを採用する。
 */
function waitForStopBoundary(): Promise<"SIGINT" | "SIGTERM" | "parent_eof"> {
  return new Promise((resolve) => {
    const settle = (reason: "SIGINT" | "SIGTERM" | "parent_eof") => {
      process.off("SIGINT", onInterrupt);
      process.off("SIGTERM", onTerminate);
      process.stdin.off("end", onParentEnd);
      process.stdin.off("close", onParentEnd);
      process.stdin.pause();
      resolve(reason);
    };
    const onInterrupt = () => settle("SIGINT");
    const onTerminate = () => settle("SIGTERM");
    const onParentEnd = () => settle("parent_eof");
    process.once("SIGINT", onInterrupt);
    process.once("SIGTERM", onTerminate);
    process.stdin.once("end", onParentEnd);
    process.stdin.once("close", onParentEnd);
    process.stdin.resume();
  });
}

/**
 * CROS Shared Server公開入口を実行する。
 *
 * @responsibility 引数、Runtime Root、運用設定、Credential初期化状態、Gateway起動および終了時cleanupを順序付ける。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Process引数、Environment、FilesystemおよびSignalを受け取る。
 * @returns CLI終了値0、2または64を返す。
 * @precondition TLS終端と固定OS ConfigがHost Operatorにより準備済みである。
 * @postcondition 0のとき全Listenerを回収し、2／64では成立未確認を成功へ畳まない。
 * @effect Config／Repositoryを読取り、Shared Server Listenerを開始・終了する。
 * @failure 入力、Config、Credential未初期化、起動またはcleanup失敗を非0へ閉じる。
 * @invariant TokenをProcess引数、環境変数、Configまたはlogへ要求しない。
 * @boundary Host CLI→Operational Config→Credential Registry→Shared Server。
 * @security 公開OriginがHTTPSでない場合はListener開始前に拒否する。
 * @concurrency Signalと全Listener終了を一つのProcess Lifecycleへ収束させる。
 */
async function main(): Promise<0 | 2 | 64> {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0] ?? "")) {
    printHelp();
    return 0;
  }
  if (args.length !== 1 || args[0] !== "--serve") {
    process.stderr.write("使い方: crdd-cros-server --serve\n");
    return 64;
  }
  const rootInput = resolveRootInput(process.env);
  if (rootInput === null) {
    process.stderr.write("CROS Runtime Rootを解決できませんでした。\n");
    return 64;
  }
  const credentialAdapter = createCredentialRegistryFileAdapter(rootInput);
  if (credentialAdapter.status !== "ready") {
    process.stderr.write("Credential Registryを構成できませんでした。\n");
    return 64;
  }
  if (credentialAdapter.registry.inspect().records.length === 0) {
    process.stderr.write(
      "管理Credentialが未初期化です。Host上でcrdd-cros-access-recoveryを実行してください。\n",
    );
    return 2;
  }
  const config = readCrosSharedServerOperationalConfig(rootInput);
  const server = await startCrosSharedServer({
    publicOrigin: config.publicOrigin,
    port: config.port,
    registry: credentialAdapter.registry,
    readExposureSnapshot: () => config.exposureSnapshot,
    resolveTopicMeetingApplication: config.resolveTopicMeetingApplication,
  });
  process.stderr.write(
    `CROS Shared Server is ready: public=${server.publicOrigin}, local=${server.localGatewayUrl}, REST=${server.restPortfolioPath}, MCP=${server.mcpPath}\n`,
  );
  await waitForStopBoundary();
  const closed = await server.close();
  return closed.cleanupConfirmed ? 0 : 2;
}

try {
  process.exitCode = await main();
} catch {
  process.stderr.write(
    "CROS Shared Serverの起動または終了を確認できませんでした。自動再試行せず、設定とRuntime状態を確認してください。\n",
  );
  process.exitCode = 2;
}
