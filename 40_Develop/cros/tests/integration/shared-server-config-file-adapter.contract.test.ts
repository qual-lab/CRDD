/**
 * CROS Shared Server運用設定の固定Path、Repository検証およびExposure構成を検証する。
 *
 * @packageDocumentation
 * @responsibility OS管理Configから検証済みRepository Project ContextだけをShared Server Snapshotへ接続できることを確認する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、shared-server、config、repository-binding、exposure
 * @boundary RFD-IT-013／PPR-IT-002=Direct Boundary: OS Config→Git Root→Project Context→Exposure Snapshot
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../../runtime-data/src/index.ts";
import { readCrosSharedServerOperationalConfig } from "../../src/index.ts";

/**
 * 現在OS向けの検証用CROS Runtime Root入力を構築する。
 *
 * @responsibility 一時DirectoryをRuntime Data ResolverのKnown Folder入力へ変換する。
 * @trace RFD-IT-013
 * @input baseに検証用絶対Directoryを受け取る。
 * @returns 現在OSで解決可能なCrosRootInputを返す。
 * @precondition baseは絶対Pathである。
 * @postcondition publisher、application、trustDomainを固定する。
 * @effect N/A: Objectを構築するだけである。
 * @failure 未対応Platformでは試験を失敗させる。
 * @invariant Repository RootをRuntime Rootと混同しない。
 * @stimulus runtimeInputの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 * @security 合成した一時Pathだけを使用する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function runtimeInput(base: string): CrosRootInput {
  if (process.platform === "win32")
    return Object.freeze({
      platform: "win32",
      trustDomainId: "shared-test",
      publisher: "qual-lab",
      application: "cros",
      localAppData: base,
    });
  if (process.platform === "linux")
    return Object.freeze({
      platform: "linux",
      trustDomainId: "shared-test",
      publisher: "qual-lab",
      application: "cros",
      homeDirectory: base,
      xdgConfigHome: path.join(base, "config"),
      xdgStateHome: path.join(base, "state"),
    });
  assert.fail("shared server config test requires win32 or linux");
}

/**
 * 検証用Repositoryへ五場面Project Contextを作成する。
 *
 * @responsibility exact Git RootとProject Context正本を再現する最小Fixtureを作る。
 * @trace PPR-IT-002
 * @input rootに新規Repository Directoryを受け取る。
 * @returns N/A: FixtureをFilesystemへ作成する。
 * @precondition rootの親Directoryが存在する。
 * @postcondition Git Root直下にREPO-SHAREDのPROJECT_CONTEXT.mdが存在する。
 * @effect Directory、Git MetadataおよびMarkdown Fileを作成する。
 * @failure GitまたはFilesystem失敗を試験失敗として送出する。
 * @invariant Commit作成を成立条件にしない。
 * @stimulus createRepositoryの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary PPR-IT-002=Direct Boundary: cros Test Source→対象契約
 * @security 一時Directory外へ書き込まない。
 * @concurrency 一Repositoryを同期作成する。
 */
function createRepository(root: string): void {
  mkdirSync(root, { recursive: true });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  /**
   * scene用の試験入力または観測処理を提供する。
   *
   * @responsibility scene用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace PPR-IT-002
   * @trace RFD-IT-013
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus sceneの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: cros Test Source→対象契約
   */
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Shared | current | owner.md |`;
  writeFileSync(
    path.join(root, "PROJECT_CONTEXT.md"),
    `# Project Context\n\nProject ID: \`PRJ-SHARED\`\nRepository ID: \`REPO-SHARED\`\nRepository Role: \`development\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
    "utf8",
  );
}

/**
 * 固定OS ConfigからRepository ExposureとApplicationを構成できることを検証する。
 *
 * @responsibility 任意Path入力なしにHTTPS設定、exact Root、Project Context、Workspace ExposureおよびTopic／Meeting Applicationを接続する。
 * @trace RFD-IT-013
 * @precondition 一時Runtime Root、未Commit Git Repositoryおよび閉じたConfig JSONを用意する。
 * @stimulus File Adapterから運用設定を一回読取る。
 * @observation 公開Origin、Port、Snapshot revision、Binding、ExposureおよびApplication解決を観測する。
 * @oracle ConfigとProject ContextのIdentityだけが公開Snapshotへ入り、RepositoryはCommitなしでも利用できる。
 * @cleanup 一時Runtime／Repository Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("OS管理Configから検証済みShared Server Snapshotを構成する", () => {
  const base = mkdtempSync(path.join(tmpdir(), "crdd-shared-config-"));
  const repositoryRoot = path.join(base, "repository");
  try {
    createRepository(repositoryRoot);
    const rootInput = runtimeInput(base);
    const runtimeRoots = resolveCrosRuntimeRoots(rootInput);
    assert.notEqual(runtimeRoots, null);
    if (runtimeRoots === null) return;
    mkdirSync(runtimeRoots.config, { recursive: true });
    writeFileSync(
      path.join(runtimeRoots.config, "shared-server.json"),
      `${JSON.stringify({
        contract: "cros/shared-server-config/v1",
        revision: 7,
        public_origin: "https://cros.example.test",
        listen_port: 4242,
        repositories: [
          {
            repository_root: repositoryRoot,
            workspace_ids: ["development"],
          },
        ],
      })}\n`,
      "utf8",
    );

    const config = readCrosSharedServerOperationalConfig(rootInput);
    assert.equal(config.publicOrigin, "https://cros.example.test");
    assert.equal(config.port, 4242);
    assert.equal(config.exposureSnapshot.revision, "shared-server-config-7");
    assert.equal(
      config.exposureSnapshot.repositories[0]?.repositoryId,
      "REPO-SHARED",
    );
    assert.equal(
      config.exposureSnapshot.exposures[0]?.workspaceId,
      "development",
    );
    const repository = config.exposureSnapshot.repositories[0];
    assert.notEqual(repository, undefined);
    if (repository !== undefined)
      assert.notEqual(config.resolveTopicMeetingApplication(repository), null);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

/**
 * Shared Server Configが平文OriginとRepository Subdirectoryを拒否することを検証する。
 *
 * @responsibility TLS省略とexact Root迂回をListener開始前に検出する。
 * @trace RFD-IT-013
 * @precondition 一時Runtime Rootと検証用Git Repositoryを用意する。
 * @stimulus HTTP OriginまたはRepository内Subdirectoryを持つConfigを順に読取る。
 * @observation 閉じたSchema／Root Errorを観測する。
 * @oracle どちらもExposure Snapshotを返さず拒否される。
 * @cleanup 一時Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Shared Server Configは平文OriginとRepository Subdirectoryを拒否する", () => {
  const base = mkdtempSync(path.join(tmpdir(), "crdd-shared-invalid-"));
  const repositoryRoot = path.join(base, "repository");
  const child = path.join(repositoryRoot, "child");
  try {
    createRepository(repositoryRoot);
    mkdirSync(child);
    const rootInput = runtimeInput(base);
    const runtimeRoots = resolveCrosRuntimeRoots(rootInput);
    assert.notEqual(runtimeRoots, null);
    if (runtimeRoots === null) return;
    mkdirSync(runtimeRoots.config, { recursive: true });
    const file = path.join(runtimeRoots.config, "shared-server.json");
    /**
     * writeConfig用の試験入力または観測処理を提供する。
     *
     * @responsibility writeConfig用の試験入力または観測処理を提供するの検証責務を所有する。
     * @trace PPR-IT-002
     * @trace RFD-IT-013
     * @precondition 対象契約を再現できる固定入力と依存を用意する。
     * @stimulus writeConfigの対象操作を実行する。
     * @observation 返却値、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionがSummaryの期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
     * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: cros Test Source→対象契約
     */
    const writeConfig = (publicOrigin: string, repository: string) =>
      writeFileSync(
        file,
        JSON.stringify({
          contract: "cros/shared-server-config/v1",
          revision: 1,
          public_origin: publicOrigin,
          listen_port: 4242,
          repositories: [
            {
              repository_root: repository,
              workspace_ids: ["development"],
            },
          ],
        }),
        "utf8",
      );
    writeConfig("http://cros.example.test", repositoryRoot);
    assert.throws(
      () => readCrosSharedServerOperationalConfig(rootInput),
      /cros_shared_server_config_schema_invalid/u,
    );
    writeConfig("https://cros.example.test", child);
    assert.throws(
      () => readCrosSharedServerOperationalConfig(rootInput),
      /cros_shared_server_repository_root_invalid/u,
    );
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
