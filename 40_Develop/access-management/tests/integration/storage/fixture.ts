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
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import {
  createFilesystemStoreRoot,
  type FilesystemStoreRoot,
} from "../../../src/initialization/root.ts";
import { saveRepositoryRegistration } from "../../../src/repository/register.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { readHostInitializationState } from "../../../src/initialization/state.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import type { AccountAccessPrincipal } from "../../../src/index.ts";
import { saveUserRegistration } from "../../../src/user/crud.ts";

/**
 * 有限試験の既知取得を、通常処理の停止確認後に明示処置する。
 * @precondition 同期保存はreturn済み。子ProcessのCaseはjoin済みで、新しい利用者はいない。
 * @boundary 試験所有Rootのみ。製品RecoveryやPID不存在による自動削除ではない。
 */
export function removeKnownStoppedTestLock(
  directory: string,
  expectedPid: number,
): void {
  const parent = path.resolve(
    import.meta.dirname,
    "../../../../../.crdd/tests",
  );
  assert.equal(path.dirname(directory), parent);
  const target = path.join(directory, "access-management.state.lock");
  try {
    fs.lstatSync(target);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    )
      return;
    throw error;
  }
  assert.equal(fs.realpathSync.native(directory), directory);
  const before = fs.lstatSync(target, { bigint: true });
  assert.equal(
    before.isFile() && !before.isSymbolicLink() && before.nlink === 1n,
    true,
  );
  const bytes = fs.readFileSync(target);
  const record = JSON.parse(bytes.toString());
  assert.equal(record.schema, "crdd-lock/v1");
  assert.equal(record.owner.processId, expectedPid);
  assert.match(record.generation, /^[a-f0-9-]{36}$/u);
  assert.match(record.identity, /^filesystem-store:[a-f0-9]{64}$/u);
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  assert.equal(readHostInitializationState(root).status, "unknown");
  const current = fs.lstatSync(target, { bigint: true });
  assert.equal(current.dev, before.dev);
  assert.equal(current.ino, before.ino);
  assert.deepEqual(fs.readFileSync(target), bytes);
  fs.unlinkSync(target);
  assert.equal(fs.existsSync(target), false);
}

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
    schemaRevision: 4,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      {
        userId: "00000000-0000-4000-8000-000000000003",
        username: "模擬管理者",
        role: "administrator",
        accountLinks: [
          {
            issuer: "https://fixture-identity.example.test",
            subject: "initial-administrator",
            bindingId: "00000000-0000-4000-8000-000000000011",
          },
        ],
      },
    ],
    registeredRepositories: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000001",
      initialUserId: "00000000-0000-4000-8000-000000000003",
      connection: "account_confirmed",
    },
  };
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
  assert.equal(fs.realpathSync.native(repository), repository);
  const marker = fs.lstatSync(path.join(repository, ".git"));
  assert.ok(marker.isDirectory() || marker.isFile());
  assert.equal(marker.isSymbolicLink(), false);
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
 * 三つのロールの確認済み主体を持つ管理状態を作る。
 * @responsibility 実Hostと分離した現在認証とUser対象を準備する。
 * @trace RFD-IT-021
 * @precondition 自己生成試験Rootだけを使用する。
 * @stimulus 利用者と外部アカウントの紐付けを保存する。
 * @observation 完全Schemaとcurrent byteを確認する。
 * @oracle 現在の紐付けに対応する主体を返す。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 確認済み主体と試験用の保存先。
 */
export function managementFixture(t: TestContext) {
  const f = fixture(t);
  const principals = {} as Record<
    "administrator" | "manager" | "developer",
    AccountAccessPrincipal
  >;
  f.state.revision = 2;
  f.state.operationId = "00000000-0000-4000-8000-000000000002";
  for (const [index, role] of (
    ["administrator", "manager", "developer"] as const
  ).entries()) {
    const userId = `00000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`;
    if (index > 0) f.state.users.push({ userId, username: role, role });
    const user = f.state.users.find((entry) => entry.userId === userId);
    assert.ok(user);
    const bindingId = crypto.randomUUID();
    user.accountLinks = [
      {
        issuer: "https://fixture-identity.example.test",
        subject: userId,
        bindingId,
      },
    ];
    principals[role] = {
      kind: "account",
      userId,
      bindingId,
      expiresAt: Date.now() + 300_000,
    };
  }
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  return { ...f, principals };
}

/** 通常の利用者登録は確認済みの主体と、対象専用の招待をそろえて行う。 */
export function saveUserRegistrationFixture(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  revision: number,
  operationId: string,
  name: string,
  role: unknown,
) {
  const digest = createHash("sha256").update(operationId).digest("hex");
  return saveUserRegistration(
    root,
    principal,
    revision,
    operationId,
    name,
    role,
    {
      email: `invite-${digest.slice(0, 24)}@example.test`,
      digest,
      expiresAt: Date.now() + 300_000,
    },
  );
}

/**
 * Canonical Identityを持つ自己生成Repositoryを用意する。
 * @responsibility 実Hostと分離した内容ディレクトリと固定文書を作る。
 * @trace RFD-IT-001
 * @precondition Repository-localな自己生成Storeと内容ディレクトリ。
 * @stimulus git initと固定文書を生成する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 正本と表示Identityが同じ。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と内容ディレクトリのFilesystem。
 */
export function repositoryFixture(t: TestContext) {
  const f = fixture(t);
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
 * 登録試験の呼出し側として、自己所有ディレクトリを渡す。
 * @responsibility AMの登録試験をGit観測の実装に依存させない。
 * @trace RFD-IT-002
 * @precondition 自己生成した通常ディレクトリだけを使う。
 * @stimulus 呼出し側が選択したPathを登録処理へ搬送する。
 * @observation 候補Pathと、同じ対象を許可する有限の確認結果。
 * @oracle Gitの探索や書込みを行わない。
 * @cleanup N/A: 領域の清掃は既存Fixtureが所有する。
 * @boundary 登録試験の信頼した呼出し側代役。
 */
export function observeFixtureDirectory(directory: string) {
  return {
    directory,
    isCurrent: () => true,
    hostedRepository: {
      provider: "github",
      host: "github.com",
      repositoryId: "92",
      providerData: { installationId: "24" },
    },
  };
}

/**
 * 三Roleとリポジトリ登録を備えた自己生成の状態を構築する。
 * @responsibility 登録の実保存を利用側の試験へ渡す。
 * @trace RFD-IT-013
 * @precondition 自己生成管理StoreとGit Repositoryだけを使う。
 * @stimulus managerでリポジトリを登録する。
 * @observation 各管理結果と完全現在状態を確認する。
 * @oracle 登録改訂2。旧内容範囲は生成しない。
 * @cleanup 既存Fixtureが全自己生成Rootを削除する。
 * @boundary AM公開管理入口と内容ディレクトリのFilesystem。
 */
export function contentFixture(t: TestContext) {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  assert.equal(
    saveRepositoryRegistration(
      f.root,
      f.principals.manager,
      f.state.revision,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      target.directory,
      observeFixtureDirectory,
    ).status,
    "completed",
  );
  return { ...f, target };
}

/** 現行の内容認可の境界に、確認済み本人と合成Gitホスト対象を渡す。 */
export function hostedContentFixture(t: TestContext) {
  const f = contentFixture(t);
  return { ...f, ...attachGitHostLinkedContentFixture(f) };
}

/** 試験が登録した対象と利用者に、合成の外部IDを結び付ける。 */
export function attachGitHostLinkedContentFixture(
  f: ReturnType<typeof managementFixture>,
) {
  const currentPath = path.join(f.directory, "access-management.json");
  const state = JSON.parse(
    fs.readFileSync(currentPath, "utf8"),
  ) as AccessManagementState;
  const user = state.users.find(({ role }) => role === "developer");
  const registration = state.registeredRepositories[0];
  assert.ok(user && registration);
  const bindingId = crypto.randomUUID();
  user.accountLinks = [
    {
      issuer: "https://accounts.google.com",
      subject: "hosted-fixture",
      bindingId,
    },
  ];
  const hostedRepository = {
    provider: "github",
    host: "github.com",
    repositoryId: "92",
    providerData: { installationId: "24" },
  };
  registration.hostedRepository = hostedRepository;
  assert.equal(parseAccessManagementState(bytes(state)).status, "parsed");
  fs.writeFileSync(currentPath, bytes(state));
  const principal = {
    kind: "account" as const,
    userId: user.userId,
    bindingId,
    expiresAt: Date.now() + 120_000,
  };
  const candidate = {
    repositoryId: registration.repositoryId,
    bindingId: registration.bindingId,
    hostedRepository,
  };
  return { state, principal, candidate, currentPath };
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
