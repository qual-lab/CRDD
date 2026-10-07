/**
 * CROS Shared ServerのOS管理運用設定を読取り、検証済みRepository Exposureへ変換する。
 *
 * @packageDocumentation
 * @responsibility 固定Runtime Config Pathの閉じたJSONを検証し、Repository Root、Project ContextおよびWorkspace Exposureを同じSnapshotへ構成する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @boundary OS管理CROS Config Root、Repository BindingおよびShared Server Compositionの境界。
 * @effect Config、Repository境界およびPROJECT_CONTEXT.mdを読取るが変更しない。
 * @security 任意Config Pathを受理せず、検証済みRepository Root以外を公開集合へ入れない。
 */
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import path from "node:path";

import type { TopicMeetingApplications } from "../../domain-model/src/topic/index.ts";
import { createTopicApplication } from "../../domain-model/src/topic/index.ts";
import { createMeetingApplication } from "../../domain-model/src/meeting/index.ts";
import { parseRepositoryProjectContextMarkdown } from "../../domain-model/src/project-context/index.ts";
import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../domain-model/src/repository/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/index.ts";

import type { CrosExposureSnapshot } from "./remote-transport.ts";
import type { CrosRepository } from "./runtime.ts";

const CONFIG_FILE = "shared-server.json";
const CONTRACT = "cros/shared-server-config/v1";
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 検証済みShared Server運用設定を定義する。
 *
 * @responsibility 公開Origin、Port、Exposure SnapshotおよびRepository Application Resolverを一つの観測へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @shape Shared Server起動に必要な非秘密値と検証済みApplication Portを持つ。
 * @invariant Repository Rootを公開結果のPropertyとして返さない。
 * @boundary Config File AdapterとShared Server Compositionの型境界。
 * @security Credential Token、VerifierまたはTLS秘密鍵を含まない。
 * @compatibility contract revision変更時はParserと移行を同時に更新する。
 */
export type CrosSharedServerOperationalConfig = Readonly<{
  publicOrigin: string;
  port: number;
  exposureSnapshot: CrosExposureSnapshot;
  resolveTopicMeetingApplication(
    repository: CrosRepository,
  ): TopicMeetingApplications | null;
}>;

/**
 * OS管理CROS Config Rootの固定FileからShared Server運用設定を読取る。
 *
 * @responsibility Config Schema、Repository Root、Project Context Identity、重複およびWorkspace Exposureを起動前に完全検証する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input Runtime Data契約のCrosRootInputを受け取る。
 * @returns 検証済みShared Server運用設定を返す。
 * @precondition ConfigはResolverが確定したRoot直下の`shared-server.json`に存在する。
 * @postcondition 全Repositoryはexact Git RootとPROJECT_CONTEXT.mdのIdentityが一致し、同じrevision Snapshotへ固定される。
 * @effect Config File、Git Repository境界およびProject Contextを読取る。
 * @failure Root、File、JSON、Schema、Repository、Identityまたは重複不正を閉じたErrorで拒否する。
 * @invariant ConfigにRepository Rootが記載されているだけでは公開せず、Workspace IDの明示列挙を要求する。
 * @boundary OS Runtime Config→Verified Repository Binding→Exposure Snapshot。
 * @security Config Pathを引数で上書きできず、秘密値またはCredential Recordを読み込まない。
 * @concurrency 一回の読取りで一つのConfig revisionと全Repository Contextを固定する。
 */
export function readCrosSharedServerOperationalConfig(
  input: CrosRootInput,
): CrosSharedServerOperationalConfig {
  const roots = resolveCrosRuntimeRoots(input);
  if (roots === null)
    throw new Error("cros_shared_server_runtime_root_invalid");
  const configPath = path.join(roots.config, CONFIG_FILE);
  let text: string;
  try {
    const stat = lstatSync(configPath);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("cros_shared_server_config_file_invalid");
    text = readFileSync(configPath, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "cros_shared_server_config_file_invalid"
    )
      throw error;
    throw new Error("cros_shared_server_config_unavailable");
  }
  const config = parseConfig(text);
  const registryRevision = `shared-server-config-${config.revision}`;
  const repositories: CrosRepository[] = [];
  const exposures: CrosExposureSnapshot["exposures"][number][] = [];
  const applications = new Map<string, TopicMeetingApplications>();
  const rootsByRepository = new Map<string, string>();

  for (const candidate of config.repositories) {
    const root = resolveVerifiedRepositoryRootFromWorkingDirectory(
      candidate.repositoryRoot,
    );
    if (!samePath(root, candidate.repositoryRoot))
      throw new Error("cros_shared_server_repository_root_invalid");
    const contextText = readContext(root);
    const context = parseRepositoryProjectContextMarkdown(contextText);
    if (rootsByRepository.has(context.repositoryId))
      throw new Error("cros_shared_server_repository_identity_conflict");
    rootsByRepository.set(context.repositoryId, root);
    const revision = `project-context-${createHash("sha256")
      .update(contextText, "utf8")
      .digest("hex")}`;
    const bindingId = `binding-${createHash("sha256")
      .update(`${context.repositoryId}\n${normalizePath(root)}`, "utf8")
      .digest("hex")
      .slice(0, 32)}`;
    const repository = Object.freeze({
      projectId: context.projectId,
      repositoryId: context.repositoryId,
      bindingId,
      revision,
      content: Object.freeze({ projectContext: context }),
    });
    repositories.push(repository);
    applications.set(
      context.repositoryId,
      Object.freeze({
        topic: createTopicApplication(root),
        meeting: createMeetingApplication(root),
      }),
    );
    for (const workspaceId of candidate.workspaceIds)
      exposures.push(
        Object.freeze({
          workspaceId,
          repositoryId: context.repositoryId,
          repositoryRevision: revision,
          registryRevision,
          active: true,
        }),
      );
  }

  const exposureSnapshot = Object.freeze({
    revision: registryRevision,
    exposures: Object.freeze(exposures),
    repositories: Object.freeze(repositories),
  });
  return Object.freeze({
    publicOrigin: config.publicOrigin,
    port: config.port,
    exposureSnapshot,
    resolveTopicMeetingApplication: (repository: CrosRepository) =>
      applications.get(repository.repositoryId) ?? null,
  });
}

/**
 * Shared Server Config JSONを閉じた内部値へ変換する。
 *
 * @responsibility JSON構文、Property集合、Revision、Origin、Port、Repository RootおよびWorkspace IDを検証する。
 * @trace ARCH-000013
 * @input Config File全体のUTF-8文字列を受け取る。
 * @returns 検証済みConfig値を返す。
 * @precondition 入力を信頼済みJSONと仮定しない。
 * @postcondition 不明Property、空Repository集合、重複Workspaceまたは不正型を受理しない。
 * @effect N/A: JSON文字列を解析するだけである。
 * @failure 構文またはSchema不正を閉じたErrorで拒否する。
 * @invariant Credential、Token、VerifierまたはTLS鍵Fieldを許可しない。
 * @boundary Config File bytesとShared Server Config Modelの境界。
 * @security 解析失敗へ入力本文を含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseConfig(text: string): Readonly<{
  revision: number;
  publicOrigin: string;
  port: number;
  repositories: readonly Readonly<{
    repositoryRoot: string;
    workspaceIds: readonly string[];
  }>[];
}> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("cros_shared_server_config_json_invalid");
  }
  if (
    !plain(value) ||
    !sameKeys(value, [
      "contract",
      "revision",
      "public_origin",
      "listen_port",
      "repositories",
    ])
  )
    throw new Error("cros_shared_server_config_schema_invalid");
  if (
    value.contract !== CONTRACT ||
    !Number.isInteger(value.revision) ||
    (value.revision as number) < 1 ||
    typeof value.public_origin !== "string" ||
    !Number.isInteger(value.listen_port) ||
    (value.listen_port as number) < 1 ||
    (value.listen_port as number) > 65_535 ||
    !Array.isArray(value.repositories) ||
    value.repositories.length === 0
  )
    throw new Error("cros_shared_server_config_schema_invalid");
  inspectHttpsOrigin(value.public_origin);
  const repositories = value.repositories.map((candidate) => {
    if (
      !plain(candidate) ||
      !sameKeys(candidate, ["repository_root", "workspace_ids"]) ||
      typeof candidate.repository_root !== "string" ||
      !path.isAbsolute(candidate.repository_root) ||
      !Array.isArray(candidate.workspace_ids) ||
      candidate.workspace_ids.length === 0 ||
      !candidate.workspace_ids.every(
        (workspaceId) =>
          typeof workspaceId === "string" && ID.test(workspaceId),
      ) ||
      new Set(candidate.workspace_ids).size !== candidate.workspace_ids.length
    )
      throw new Error("cros_shared_server_config_schema_invalid");
    return Object.freeze({
      repositoryRoot: candidate.repository_root,
      workspaceIds: Object.freeze([...candidate.workspace_ids] as string[]),
    });
  });
  return Object.freeze({
    revision: value.revision as number,
    publicOrigin: value.public_origin,
    port: value.listen_port as number,
    repositories: Object.freeze(repositories),
  });
}

/**
 * 公開URLがPath等を持たないHTTPS Originかを検証する。
 *
 * @responsibility Config AdapterとShared Gatewayで同じ公開TLS条件を保つ。
 * @trace ARCH-000013
 * @input 公開Origin候補を受け取る。
 * @returns N/A: 適合時に正常終了する。
 * @precondition 入力をURLと仮定しない。
 * @postcondition HTTPS、Root Path、認証情報なしだけを許可する。
 * @effect N/A: 文字列を解析するだけである。
 * @failure 不正値をConfig Schema Errorで拒否する。
 * @invariant localhostも平文HTTPを許可しない。
 * @boundary Config ModelとTLS配置契約の境界。
 * @security URL内Credentialを許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function inspectHttpsOrigin(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("cros_shared_server_config_schema_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  )
    throw new Error("cros_shared_server_config_schema_invalid");
}

/**
 * Repository RootのProject Context正本を読取る。
 *
 * @responsibility 固定Filenameの通常FileだけをUTF-8として取得する。
 * @trace ARCH-000005
 * @trace ARCH-000013
 * @input 検証済みRepository Rootを受け取る。
 * @returns PROJECT_CONTEXT.md全文を返す。
 * @precondition rootはexact Git Rootとして検証済みである。
 * @postcondition Symbolic Linkまたは非Fileを受理しない。
 * @effect Repository内の一Fileを読取る。
 * @failure 欠落、型不正または読取り失敗を閉じたErrorで拒否する。
 * @invariant Topic、Meetingその他のDirectoryを探索しない。
 * @boundary Verified Repository RootとProject Context Parserの境界。
 * @security Root外Pathや任意Filenameを受理しない。
 * @concurrency 一つのFile Snapshotを同期読取りする。
 */
function readContext(root: string): string {
  const file = path.join(root, "PROJECT_CONTEXT.md");
  try {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("cros_shared_server_project_context_invalid");
    return readFileSync(file, "utf8");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "cros_shared_server_project_context_invalid"
    )
      throw error;
    throw new Error("cros_shared_server_project_context_unavailable");
  }
}

/**
 * 値が通常Objectかを判定する。
 *
 * @responsibility Config解析でAccessorやArrayを通常Recordとして扱わない。
 * @trace ARCH-000013
 * @input 未信頼値を受け取る。
 * @returns prototypeがObject.prototypeのObjectだけtrueを返す。
 * @precondition 値の型を仮定しない。
 * @postcondition null、Arrayおよび非標準prototypeをfalseにする。
 * @effect N/A: 値の構造を観測するだけである。
 * @failure N/A: 不適合はfalseで返す。
 * @invariant Getterを読まない。
 * @boundary JSON値とConfig Schema検証の境界。
 * @security Proxy等の未信頼Objectを許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function plain(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * ObjectのProperty集合が期待値と完全一致するか確認する。
 *
 * @responsibility Configの未知Propertyと欠落Propertyを同じSchema境界で拒否する。
 * @trace ARCH-000013
 * @input 通常Recordと期待Property集合を受け取る。
 * @returns 昇順比較が一致する場合だけtrueを返す。
 * @precondition valueはplainで確認済みである。
 * @postcondition 順序に依存せず完全一致だけを許可する。
 * @effect N/A: Property名を列挙するだけである。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant Property値を読まない。
 * @boundary Config SchemaのProperty集合境界。
 * @security 未知Secret Fieldを黙って保持しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function sameKeys(
  value: Record<string, unknown>,
  expectedKeys: string[],
): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expectedKeys].sort())
  );
}

/**
 * Repository Pathを現在OSで比較可能な表現へ正規化する。
 *
 * @responsibility Config値とGitが返したexact Rootの同一性をCase規則込みで比較可能にする。
 * @trace ARCH-000013
 * @input 絶対Pathを受け取る。
 * @returns resolve済みで末尾Separatorを除いた比較文字列を返す。
 * @precondition 入力は絶対Path候補である。
 * @postcondition Windowsでは小文字化し、他PlatformではCaseを保持する。
 * @effect N/A: Path文字列を変換するだけである。
 * @failure N/A: path.resolveの結果を返す。
 * @invariant Filesystemを変更しない。
 * @boundary Config PathとGit Root Pathの比較境界。
 * @security 正規化結果を公開ResultやErrorへ含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function normalizePath(value: string): string {
  const normalized = path.resolve(value).replace(/[\\/]+$/u, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/**
 * 二つのRepository Root Pathが現在OSで同じか判定する。
 *
 * @responsibility ConfigがRepository内SubdirectoryをRootとして偽装することを拒否する。
 * @trace ARCH-000013
 * @input Git検証済みRootとConfig候補を受け取る。
 * @returns 正規化後に一致する場合だけtrueを返す。
 * @precondition 両入力は絶対Path候補である。
 * @postcondition 親子Pathを同一と扱わない。
 * @effect N/A: Path文字列を比較するだけである。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant Symbolic Link解決のAuthorityを新しく生成しない。
 * @boundary Git Root VerificationとConfig Bindingの境界。
 * @security Pathを結果へ公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function samePath(left: string, right: string): boolean {
  return normalizePath(left) === normalizePath(right);
}
