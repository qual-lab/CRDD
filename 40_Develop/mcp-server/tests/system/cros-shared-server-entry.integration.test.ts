/**
 * 配布CROS Shared Server入口のOS設定から終了までを検証する。
 *
 * @packageDocumentation
 * @responsibility 固定Runtime Config、File Credential Registry、公開CLI、同一Origin HealthおよびSignal cleanupを実Processで確認する。
 * @trace PPR-ST-005
 * @trace RFD-ST-004
 * @level ST
 * @scope cros、mcp、shared-server、cli、runtime-config、process-cleanup
 * @boundary RFD-ST-004／PPR-ST-005=System/E2E: OS Runtime Root→CLI Process→Shared Gateway→Signal Cleanup
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createCredentialRegistryFileAdapter,
  issueConnectionCredential,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../../domain-model/src/index.ts";

const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * 現在OS向けの一時CROS Runtime Root入力を構築する。
 *
 * @responsibility Child ProcessとTest Processが同じ固定OS Rootを解決できる入力を作る。
 * @trace RFD-ST-004
 * @input baseに一時絶対Directoryを受け取る。
 * @returns CrosRootInputを返す。
 * @precondition baseは絶対Pathである。
 * @postcondition trustDomain=entry-testを固定する。
 * @effect N/A: Objectを構築するだけである。
 * @failure 未対応OSでは試験を失敗させる。
 * @invariant Config File Pathを直接渡さない。
 * @stimulus runtimeInputの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 * @security 一時Known Folderだけを使用する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function runtimeInput(base: string): CrosRootInput {
  if (process.platform === "win32")
    return Object.freeze({
      platform: "win32",
      trustDomainId: "entry-test",
      publisher: "qual-lab",
      application: "cros",
      localAppData: base,
    });
  if (process.platform === "linux")
    return Object.freeze({
      platform: "linux",
      trustDomainId: "entry-test",
      publisher: "qual-lab",
      application: "cros",
      homeDirectory: base,
      xdgConfigHome: path.join(base, "config"),
      xdgStateHome: path.join(base, "state"),
    });
  assert.fail("shared server entry test requires win32 or linux");
}

/**
 * Child Process Environmentへ一時Known FolderとTrust Domainを設定する。
 *
 * @responsibility CLIが任意Path引数なしにTest用Runtime Rootだけを解決できるEnvironmentを作る。
 * @trace RFD-ST-004
 * @input baseに一時Rootを受け取る。
 * @returns Child Process Environmentを返す。
 * @precondition runtimeInput(base)と同じOSである。
 * @postcondition CROS_TRUST_DOMAIN_IDと必要Known Folderだけを上書きする。
 * @effect N/A: 新しいObjectを構築するだけである。
 * @failure N/A: 現在Process Environmentを基礎にする。
 * @invariant Credential TokenをEnvironmentへ入れない。
 * @stimulus childEnvironmentの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 * @security Bearer、VerifierまたはTLS鍵を含めない。
 * @concurrency N/A: Process起動前に一回構築する。
 */
function childEnvironment(base: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CROS_TRUST_DOMAIN_ID: "entry-test",
    ...(process.platform === "win32"
      ? { LOCALAPPDATA: base }
      : {
          HOME: base,
          XDG_CONFIG_HOME: path.join(base, "config"),
          XDG_STATE_HOME: path.join(base, "state"),
        }),
  };
}

/**
 * 検証用Git RepositoryとProject Contextを作成する。
 *
 * @responsibility Shared Server入口が実在Repositoryを構成できる最小Fixtureを準備する。
 * @trace PPR-ST-005
 * @input rootに新規Repository Directoryを受け取る。
 * @returns N/A: FilesystemへFixtureを作る。
 * @precondition rootの親Directoryが存在する。
 * @postcondition 未Commit Git Rootと五場面Project Contextが存在する。
 * @effect Directory、Git MetadataおよびMarkdownを作成する。
 * @failure Git／Filesystem失敗を試験失敗として送出する。
 * @invariant Commit SHAを成立条件にしない。
 * @stimulus createRepositoryの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary PPR-ST-005=Direct Boundary: mcp Test Source→対象契約
 * @security 一時Root外へ書き込まない。
 * @concurrency 一Repositoryを同期作成する。
 */
function createRepository(root: string): void {
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  /**
   * scene用の試験入力または観測処理を提供する。
   *
   * @responsibility scene用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace PPR-ST-005
   * @trace RFD-ST-004
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus sceneの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary PPR-ST-005／RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
   */
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Shared | current | owner.md |`;
  writeFileSync(
    path.join(root, "PROJECT_CONTEXT.md"),
    `# Project Context\n\nProject ID: \`PRJ-ENTRY\`\nRepository ID: \`REPO-ENTRY\`\nRepository Role: \`development\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
    "utf8",
  );
}

/**
 * Shared Server Child Processが公開したlocal Gateway URLを待機する。
 *
 * @responsibility stderrの固定Ready行から非秘密loopback URLだけを取得する。
 * @trace RFD-ST-004
 * @input 起動済みChild Processを受け取る。
 * @returns local Gateway URLを返すPromise。
 * @precondition stderrがpipeされている。
 * @postcondition Ready、早期終了または10秒Timeoutの一つへ収束する。
 * @effect stderrを読取り一時Timerを開始・解除する。
 * @failure Ready前終了またはTimeoutを秘密値なしのErrorにする。
 * @invariant Public OriginやRepository Pathを解析条件にしない。
 * @stimulus waitForGatewayの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 * @security stderr全体を成功結果へ保持しない。
 * @concurrency data、exit、timeoutの最初の一結果を採用する。
 */
function waitForGateway(child: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let stderr = "";
    /**
     * finish用の試験入力または観測処理を提供する。
     *
     * @responsibility finish用の試験入力または観測処理を提供するの検証責務を所有する。
     * @trace PPR-ST-005
     * @trace RFD-ST-004
     * @precondition 対象契約を再現できる固定入力と依存を用意する。
     * @stimulus finishの対象操作を実行する。
     * @observation 返却値、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionがSummaryの期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
     * @boundary PPR-ST-005／RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
     */
    const finish = (operation: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      operation();
    };
    const timeout = setTimeout(
      () => finish(() => reject(new Error("shared_server_start_timeout"))),
      10_000,
    );
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      const match = /local=(http:\/\/127\.0\.0\.1:\d+)/u.exec(stderr);
      if (match?.[1]) finish(() => resolve(match[1] ?? ""));
    });
    child.once("exit", () =>
      finish(() => reject(new Error("shared_server_exited_before_ready"))),
    );
  });
}

/**
 * Child Process終了を待ってExit Codeを返す。
 *
 * @responsibility Signal後のcleanup完了とProcess終了を一つの観測へ閉じる。
 * @trace RFD-ST-004
 * @input Child Processを受け取る。
 * @returns Exit Codeまたはnullを返すPromise。
 * @precondition Childが起動済みである。
 * @postcondition 既終了または将来exitを一回返す。
 * @effect exit Eventを待機する。
 * @failure N/A: Signal終了はnullを保持する。
 * @invariant 強制終了を発行しない。
 * @stimulus waitForExitの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 * @security Process出力を返さない。
 * @concurrency 一つのexitだけを観測する。
 */
function waitForExit(child: ReturnType<typeof spawn>): Promise<number | null> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve(child.exitCode);
  return new Promise((resolve) => child.once("exit", resolve));
}

/**
 * System Test用の一時loopback Port候補を取得する。
 *
 * @responsibility OSへPort 0をBindして得た番号をShared Server固定Configの試験値へ変換する。
 * @trace RFD-ST-004
 * @input N/A: OS loopback Listenerを一時使用する。
 * @returns Listener終了後のPort番号を返すPromise。
 * @precondition loopback Socketを作成できる。
 * @postcondition 戻る前に一時Listenerを閉じる。
 * @effect 127.0.0.1へ一時Listenerを開始・終了する。
 * @failure Bind、Address観測または終了失敗を試験失敗として送出する。
 * @invariant Shared Serverと同時に同Portを所有しない。
 * @stimulus findAvailablePortの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 * @security 外部InterfaceへBindしない。
 * @concurrency Port解放後の競合可能性はTest Process内の直後起動へ限定する。
 */
function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("shared_server_test_port_unavailable"));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * 配布入口が固定OS設定から起動しSignal後に全資源を回収することを検証する。
 *
 * @responsibility 実CLI ProcessでConfig／Credential読取り、Gateway Health、TLS配置Headerおよび正常終了を確認する。
 * @trace RFD-ST-004
 * @precondition 一時OS Root、File Credential Registry、Shared ConfigおよびRepositoryを準備する。
 * @stimulus `crdd-cros-server --serve`を起動しHealth要求後にSIGTERMを送る。
 * @observation Ready URL、Health結果、Exit Codeおよび終了後接続拒否を観測する。
 * @oracle Secret Environmentなしで起動し、TLS終端Header付きHealthだけ成功し、cleanup後0終了する。
 * @cleanup Child終了後に一時Rootを再帰削除する。
 * @boundary RFD-ST-004=Direct Boundary: mcp Test Source→対象契約
 */
test("配布Shared Server入口は固定運用設定から起動して安全に終了する", async () => {
  const base = mkdtempSync(path.join(tmpdir(), "crdd-shared-entry-"));
  const repositoryRoot = path.join(base, "repository");
  let child: ReturnType<typeof spawn> | null = null;
  try {
    createRepository(repositoryRoot);
    const rootInput = runtimeInput(base);
    const roots = resolveCrosRuntimeRoots(rootInput);
    assert.notEqual(roots, null);
    if (roots === null) return;
    mkdirSync(roots.config, { recursive: true });
    const port = await findAvailablePort();
    writeFileSync(
      path.join(roots.config, "shared-server.json"),
      JSON.stringify({
        contract: "cros/shared-server-config/v1",
        revision: 1,
        public_origin: "https://cros.example.test",
        listen_port: port,
        repositories: [
          {
            repository_root: repositoryRoot,
            workspace_ids: ["development"],
          },
        ],
      }),
      "utf8",
    );
    const registryAdapter = createCredentialRegistryFileAdapter(rootInput);
    assert.equal(registryAdapter.status, "ready");
    if (registryAdapter.status !== "ready") return;
    const issued = issueConnectionCredential(
      registryAdapter.registry,
      ADMINISTRATOR,
      { profile: "administrator" },
    );
    assert.equal(issued.status, "completed");
    if (issued.status !== "completed") return;

    const entry = fileURLToPath(
      new URL(
        "../../../../template/tools/crdd-cros-server.ts",
        import.meta.url,
      ),
    );
    child = spawn(process.execPath, [entry, "--serve"], {
      cwd: path.dirname(entry),
      env: childEnvironment(base),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const gateway = await waitForGateway(child);
    const health = await fetch(`${gateway}/.well-known/cros-shared-health`, {
      headers: {
        "x-forwarded-proto": "https",
        "x-forwarded-host": "cros.example.test",
        origin: "https://cros.example.test",
      },
    });
    assert.equal(health.status, 200);
    child.stdin?.end();
    const exitCode = await waitForExit(child);
    assert.equal(exitCode, 0);
    await assert.rejects(fetch(`${gateway}/.well-known/cros-shared-health`));
  } finally {
    if (child !== null && child.exitCode === null) {
      child.kill();
      await waitForExit(child);
    }
    rmSync(base, { recursive: true, force: true });
  }
});
