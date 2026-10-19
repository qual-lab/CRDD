/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-001
 * @trace RFD-IT-002
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import {
  createFilesystemStoreRoot,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import { createCredentialMaterial } from "../../../src/credential/token.ts";
import {
  createInitialAdministrator,
  initializeAccessManagementState,
} from "../../../src/initialization/execution.ts";
import { saveExposure as updateExposure } from "../../../src/repository/exposure.ts";
import { saveRepositoryRegistration as registerRepository } from "../../../src/repository/register.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";

/**
 * 完了済み初回記録を持つ模擬現在状態を作る。
 * @responsibility 現在Userと歴史的資格IDを分ける。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 固定JSON値を作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 生Secret・実Credentialは含まない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
export function baseline(): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      {
        userId: "00000000-0000-4000-8000-000000000003",
        username: "模擬管理者",
        role: "administrator",
      },
    ],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: "00000000-0000-4000-8000-000000000003",
      initialCredentialId: "0123456789abcdef01234567",
      confirmationCredentialId: "0123456789abcdef01234567",
      connection: "confirmed",
    },
  };
}

/**
 * 初回資格保存の前状態を作る。
 * @responsibility 本番と同じ相関・User保存を通して前状態を構築する。
 * @trace RFD-IT-024
 * @precondition 自己生成の試験Root。
 * @stimulus 初回相関と管理者を保存する。
 * @observation 両保存のcompletedを確認する。
 * @oracle 資格生成前のuser_storedに到達する。
 * @cleanup 呼出元FixtureがRoot不存在を確認する。
 * @boundary 初回保存と実Filesystem。
 */
export function prepareInitialUser(f: ReturnType<typeof fixture>): string {
  fs.rmSync(path.join(f.directory, "access-management.json"));
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.equal(
    createInitialAdministrator(f.root, attempt, "管理者").status,
    "completed",
  );
  return attempt;
}

/**
 * 非秘密fixtureを固定byte化する。
 * @responsibility Source serializerから独立した期待byteを構築する。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus Object keyを辞書順でJSON化し改行を付ける。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle UTF-8正確byteをHashと比較へ使う。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
export function bytes(value: unknown): Buffer {
  return Buffer.from(
    `${JSON.stringify(value, (_key, item: unknown) =>
      item !== null && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          )
        : item,
    )}\n`,
  );
}

/**
 * Repository内の一回性保存Fixtureを構築する。
 * @responsibility RootCapabilityと試験作成物を限定する。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 検証したRepository直下に試験Rootと模擬currentを作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 試験Root以外・Host管理領域へ書込み0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
export function fixture(t: TestContext): {
  directory: string;
  root: FilesystemStoreRoot;
  state: AccessManagementState;
} {
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "access-management-store-"),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const state = baseline();
  fs.writeFileSync(
    path.join(directory, "access-management.json"),
    bytes(state),
  );
  return { directory, root, state };
}

/**
 * 三Roleの資格を持つ通常管理前状態を作る。
 * @responsibility 実Hostと分離した現在認証とUser対象を準備する。
 * @trace RFD-IT-021
 * @precondition 自己生成試験Rootだけを使用する。
 * @stimulus 最小Userと一回性資格材料を保存する。
 * @observation 完全Schemaとcurrent byteを確認する。
 * @oracle 生鍵は短命メモリだけ、Storeにはsalt／Verifierだけ。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 公開暗号部品と自己生成Filesystem。
 */
export function managementFixture(t: TestContext) {
  const f = fixture(t);
  const tokens = { administrator: "", manager: "", developer: "" };
  for (const [index, role] of (
    ["administrator", "manager", "developer"] as const
  ).entries()) {
    const userId = `00000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`;
    if (index > 0) f.state.users.push({ userId, username: role, role });
    const material = createCredentialMaterial();
    tokens[role] = material.token;
    f.state.credentials.push({
      credentialId: material.credentialId,
      userId,
      tokenVersion: 1,
      tokenSalt: material.tokenSalt,
      tokenVerifier: material.tokenVerifier,
      revoked: false,
      operationId: crypto.randomUUID(),
      presentation: "confirmed",
    });
  }
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  return { ...f, tokens };
}

/**
 * Canonical Identityを持つ自己生成Repositoryを用意する。
 * @responsibility 実Hostと分離したGit境界・manifest・表示投影を作る。
 * @trace RFD-IT-001
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus git initと固定文書を生成する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 正本と表示Identityが同じ。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
export function repositoryFixture(t: TestContext) {
  const f = fixture(t);
  const git = spawnSync("git", ["init", "--quiet", f.directory], {
    encoding: "utf8",
  });
  assert.equal(git.status, 0, git.stderr);
  const manifest = {
    schema: "crdd/repository-manifest/v2",
    projectId: "project.fixture",
    repositoryId: "repository.fixture",
    displayName: "試験",
    repositoryRole: "development",
    capabilities: [],
    contextSurfaces: [],
    externalSendPolicy: null,
  };
  fs.mkdirSync(path.join(f.directory, ".crdd", "config"), { recursive: true });
  const manifestPath = path.join(
    f.directory,
    ".crdd",
    "config",
    "repository-manifest.json",
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const headings = [
    "今どうなっているか",
    "何が危ない、または止まっているか",
    "今、人間が決めることは何か",
    "なぜこの状態・判断になったか",
    "次に何をすべきか",
  ];
  const context =
    "# Project Context\n\nProject ID: project.fixture\nRepository ID: repository.fixture\nRepository Role: development\n" +
    headings
      .map(
        (heading, i) =>
          `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
      )
      .join("");
  fs.writeFileSync(path.join(f.directory, "PROJECT_CONTEXT.md"), context);
  return { ...f, manifest, manifestPath, context };
}

/**
 * 公開済みRepositoryと三Roleの内容要求前状態を構築する。
 * @responsibility 登録・Exposureの公開入口を通して内容認可の前提を作る。
 * @trace RFD-IT-013
 * @precondition 自己生成管理StoreとGit Repositoryだけを使う。
 * @stimulus managerで登録とdevelopment公開を確定する。
 * @observation 各管理結果と完全現在状態を確認する。
 * @oracle 登録改訂2、公開改訂3。管理者の内容範囲は空のまま。
 * @cleanup 既存Fixtureが全自己生成Rootを削除する。
 * @boundary AM公開管理入口と実Git／Filesystem。
 */
export function contentFixture(t: TestContext) {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.manager,
      1,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      target.directory,
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      2,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      ["development"],
    ).status,
    "completed",
  );
  return { ...f, target };
}

/**
 * 途中出版の独立Fixtureを生成する。
 * @responsibility 基準Hash・次Hash・改訂・操作IDを模擬保存材料へ保持する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus pendingと任意のreplaceを作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle nextSnapshotはobjectであり二重encodeしない。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
export function prepare(
  f: ReturnType<typeof fixture>,
  next: AccessManagementState,
  kind = "management",
  replace = true,
): void {
  /**
   * 保存途中fixtureの基準・次状態byteをSHA-256で識別する。
   * @responsibility 二つの完全byte列からpendingの相関値を作る。
   * @trace RFD-IT-021
   * @precondition 非秘密のfixture状態をUTF-8 byteへ変換済み。
   * @stimulus 状態Buffer。
   * @observation 16進のSHA-256値。
   * @oracle 異なる状態のHashを基準・次として取り違えない。
   * @cleanup N/A: 純粋計算。
   * @boundary 試験材料生成。署名・認可の証明にはしない。
   */
  const digest = (value: Buffer) =>
    createHash("sha256").update(value).digest("hex");
  fs.writeFileSync(
    path.join(f.directory, "access-management.pending.json"),
    bytes({
      contract: "crdd-access-management/pending",
      schemaRevision: 1,
      kind,
      baseRevision: f.state.revision,
      baseSha256: digest(bytes(f.state)),
      nextRevision: next.revision,
      nextSha256: digest(bytes(next)),
      operationId: next.operationId,
      nextSnapshot: next,
    }),
  );
  if (replace)
    fs.writeFileSync(
      path.join(f.directory, "access-management.replace.json"),
      bytes(next),
    );
}
