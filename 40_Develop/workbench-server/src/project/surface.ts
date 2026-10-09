/**
 * WorkbenchのRepository Project Surfaceを構築する。
 *
 * @packageDocumentation
 * @responsibility PROJECT_CONTEXT.mdをProject Operationの共通Readerで読み、未構成Capabilityを0件へ畳まないView Modelを返す。
 * @trace ARCH-000012
 * @boundary Project Operation公開契約とWorkbench表示ModelのAdapter境界。
 * @effect 検証済みRepository Root内の固定Project Contextと既知Capability Directoryを読取る。
 * @security 任意Path、Role外Contextまたは存在しないRepositoryを探索しない。
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

import {
  parseTopicMarkdown,
  type TopicRecord,
} from "../../../domain-model/src/index.ts";
import {
  parseMeetingMarkdown,
  type MeetingRecord,
} from "../../../domain-model/src/index.ts";
import {
  parseRepositoryProjectContextMarkdown,
  parseRepositoryQualityProjectionMarkdown,
  parseRepositoryReleaseProjectionMarkdown,
  type RepositoryProjectContext,
} from "../../../domain-model/src/index.ts";
import { gitLocalChangeSetAdapter } from "../../../version-control/src/index.ts";
import { gitChangePublicationTargetObservationAdapter } from "../../../version-control/src/index.ts";
import {
  observeLocalChangeSet,
  type LocalChangeSet,
} from "../../../version-control/src/index.ts";
import {
  observeChangePublicationTarget,
  type ChangePublicationTargetObservation,
} from "../../../version-control/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  readWorkbenchOwnerArtifactCatalog,
  type WorkbenchOwnerArtifactCatalog,
} from "../owner-artifact/read.ts";
import type { WorkbenchProjectPlanObservation } from "../project-plan/types.ts";
import type { WorkbenchQualityObservation } from "../quality/types.ts";

/**
 * Workbenchが表示するRepository Capability状態を定義する。
 *
 * @responsibility 利用可能と未構成を件数0から分離する。
 * @trace ARCH-000012
 * @shape availableまたはnot_configuredの閉集合を表す。
 * @invariant not_configuredを空一覧または正常状態として扱わない。
 * @boundary Repository観測とWorkbench表示の型境界。
 * @security N/A: 構成状態だけを表す。
 * @compatibility 新状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchCapabilityState =
  | "available"
  | "not_configured"
  | "unknown";

/**
 * WorkbenchのRecord集合を定義する。
 *
 * @responsibility Collection状態、検証済みItemおよび観測不能理由を同じ結果へ閉じる。
 * @trace ARCH-000012
 * @shape state、itemsおよびreasonを表す。
 * @invariant unknownでは部分Itemを完全一覧として公開しない。
 * @boundary Repository Record ReaderとWorkbench一覧表示の型境界。
 * @security reasonは内部Pathまたは非開示Identityを含まない固定値に限る。
 * @compatibility availableの空itemsだけが構成済み0件を意味する。
 */
export type WorkbenchRecordCollection<T> = Readonly<{
  state: WorkbenchCapabilityState;
  items: readonly T[];
  reason: "record_invalid" | "observation_failed" | null;
}>;

/**
 * WorkbenchのProject Surfaceを定義する。
 *
 * @responsibility 共通Project Context、Topic／MeetingおよびVersion Control観測を一つのSnapshotへ閉じる。
 * @trace ARCH-000012
 * @shape context、topics、meetingsおよびRepository観測を表す。
 * @invariant Topic／Meeting未配置を0件へ変換しない。
 * @boundary Workbench AdapterとBrowser RendererのRead Model境界。
 * @security Repository Role外のContextを追加しない。
 * @compatibility contextはProject Operation公開型をそのまま利用する。
 */
export type WorkbenchProjectSurface = Readonly<{
  context: RepositoryProjectContext;
  topics: WorkbenchRecordCollection<TopicRecord>;
  meetings: WorkbenchRecordCollection<MeetingRecord>;
  plan: WorkbenchProjectPlanObservation;
  quality: WorkbenchQualityObservation;
  ownerArtifacts: WorkbenchOwnerArtifactCatalog;
  repository: Readonly<{
    state: "available" | "unknown";
    changeSet: LocalChangeSet | null;
    publicationTarget: ChangePublicationTargetObservation | null;
    reason: "repository_root_invalid" | "observation_failed" | null;
  }>;
}>;

/**
 * 固定Current Release ProjectionをWorkbench向けに観測する。
 *
 * @responsibility Release Projectionの欠落、不正およびFilesystem失敗を別状態として保持する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input repositoryRootに検証済みRepository Rootを受け取る。
 * @returns 構造化Projectionまたは理由付き状態を返す。
 * @precondition 固定Path以外を探索しない。
 * @postcondition availableではProject Operation共通Readerを通過したProjectionを返す。
 * @effect 99_Roadmap/03_Releases.mdを一回読取る。
 * @failure 欠落はnot_configured、構造不正はrelease_projection_invalid、その他はobservation_failedとする。
 * @invariant 欠落項目を推測補完しない。
 * @boundary Repository FilesystemとProject Operation Release Readerの直接境界。
 * @security 固定Repository内Pathだけを読む。
 * @concurrency 他のSurface観測と独立して実行できる。
 */
async function readProjectPlan(
  repositoryRoot: string,
): Promise<WorkbenchProjectPlanObservation> {
  try {
    const markdown = await readFile(
      path.join(repositoryRoot, "99_Roadmap", "03_Releases.md"),
      "utf8",
    );
    try {
      return Object.freeze({
        state: "available",
        projection: parseRepositoryReleaseProjectionMarkdown(markdown),
        reason: null,
      });
    } catch {
      return Object.freeze({
        state: "unknown",
        projection: null,
        reason: "release_projection_invalid",
      });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        projection: null,
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      projection: null,
      reason: "observation_failed",
    });
  }
}

/**
 * 固定Current Quality ProjectionをWorkbench向けに観測する。
 *
 * @responsibility Quality Projectionの欠落、不正およびFilesystem失敗を別状態として保持する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input repositoryRootに検証済みRepository Rootを受け取る。
 * @returns 構造化Quality Projectionまたは理由付き状態を返す。
 * @precondition 固定Path以外を探索しない。
 * @postcondition availableではProject Operation共通Readerを通過したProjectionを返す。
 * @effect 07_Quality/01_Quality_Center.mdを一回読取る。
 * @failure 欠落はnot_configured、構造不正はquality_projection_invalid、その他はobservation_failedとする。
 * @invariant 未観測、GapまたはGateを推測補完しない。
 * @boundary Repository FilesystemとProject Operation Quality Readerの直接境界。
 * @security 固定Repository内Pathだけを読む。
 * @concurrency 他のSurface観測と独立して実行できる。
 */
async function readQuality(
  repositoryRoot: string,
): Promise<WorkbenchQualityObservation> {
  try {
    const markdown = await readFile(
      path.join(repositoryRoot, "07_Quality", "01_Quality_Center.md"),
      "utf8",
    );
    try {
      return Object.freeze({
        state: "available",
        projection: parseRepositoryQualityProjectionMarkdown(markdown),
        reason: null,
      });
    } catch {
      return Object.freeze({
        state: "unknown",
        projection: null,
        reason: "quality_projection_invalid",
      });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        projection: null,
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      projection: null,
      reason: "observation_failed",
    });
  }
}

/**
 * Workbench向けに現在のLocal Change Setを観測する。
 *
 * @responsibility 検証済みRepository RootだけをVersion Control Adapterへ渡し、観測不能をCleanへ畳まない。
 * @trace ARCH-000002
 * @input repositoryRootにWorkbench起動時に解決したRepository Rootを受け取る。
 * @returns 作業ツリーの観測状態、Local Change Setおよび理由を返す。
 * @precondition repositoryRootはAbsolute Path候補である。
 * @postcondition availableではVersion Control公開契約を通過した完全なLocal Change Setを返す。
 * @effect Git Processを読取り専用引数で実行する。
 * @failure Root不正またはGit観測失敗を理由付きunknownとして返す。
 * @invariant 観測不能を変更0件またはCleanと表示しない。
 * @boundary Workbench Application AdapterとVersion Control Adapterの直接境界。
 * @security Repository Pathを結果へ含めず、任意のGit引数を受け付けない。
 * @concurrency 起動時の単一Snapshotとして同期観測する。
 */
function readRepositoryChangeSet(
  repositoryRoot: string,
): WorkbenchProjectSurface["repository"] {
  const verification = verifyRepositoryRoot(repositoryRoot);
  if (verification.status !== "completed")
    return Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "repository_root_invalid",
    });
  try {
    return Object.freeze({
      state: "available",
      changeSet: observeLocalChangeSet(
        verification.capability,
        "HEAD",
        gitLocalChangeSetAdapter,
      ),
      publicationTarget: observeChangePublicationTarget(
        verification.capability,
        gitChangePublicationTargetObservationAdapter,
      ),
      reason: null,
    });
  } catch {
    return Object.freeze({
      state: "unknown",
      changeSet: null,
      publicationTarget: null,
      reason: "observation_failed",
    });
  }
}

/**
 * 固定Record Directoryから検証済み一覧を読取る。
 *
 * @responsibility 既知PathのDirectory状態を分類し、固定Identity Directory内の正本だけを検証済み一覧へ変換する。
 * @trace ARCH-000012
 * @input directoryPath、Identity形式、固定File名、ParserおよびIdentity取得処理を受け取る。
 * @returns 構成状態、全件検証済みRecordおよび観測不能理由を返す。
 * @precondition 呼出し側が固定allowlistからPathを構築している。
 * @postcondition availableでは対象Identity Directoryの全Recordが本文Identityと一致する。
 * @effect Filesystem Metadata、固定Directory一覧および固定Record Fileを読取る。
 * @failure 欠落はnot_configured、観測失敗またはRecord不正は理由付きunknownとする。
 * @invariant 未構成を空一覧へ、部分読取りを完全一覧へ畳まない。
 * @boundary Repository FilesystemとWorkbench Capability表示の境界。
 * @security 任意入力Pathを受け付けず、内容を公開しない。
 * @concurrency 独立したMetadata観測だけを行う。
 */
async function readRecordCollection<T>(
  directoryPath: string,
  identityPattern: RegExp,
  fileName: string,
  parse: (markdown: string) => T,
  identityOf: (record: T) => string,
): Promise<WorkbenchRecordCollection<T>> {
  try {
    const result = await stat(directoryPath);
    if (!result.isDirectory())
      return Object.freeze({
        state: "not_configured",
        items: Object.freeze([]),
        reason: null,
      });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        items: Object.freeze([]),
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      items: Object.freeze([]),
      reason: "observation_failed",
    });
  }
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const recordDirectories = entries
      .filter(
        (entry) => entry.isDirectory() && identityPattern.test(entry.name),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    const items = await Promise.all(
      recordDirectories.map(async (entry) => {
        const record = parse(
          await readFile(
            path.join(directoryPath, entry.name, fileName),
            "utf8",
          ),
        );
        if (identityOf(record) !== entry.name)
          throw new Error("project_operation_record_directory_mismatch");
        return record;
      }),
    );
    return Object.freeze({
      state: "available",
      items: Object.freeze(items),
      reason: null,
    });
  } catch {
    return Object.freeze({
      state: "unknown",
      items: Object.freeze([]),
      reason: "record_invalid",
    });
  }
}

/**
 * 検証済みRepositoryからWorkbench Project Surfaceを読取る。
 *
 * @responsibility 固定Project Contextを共通Readerへ渡し、Topic／Meetingの構成状態を同じSnapshotへ付加する。
 * @trace ARCH-000012
 * @input repositoryRootに検証済みRepository Rootを受け取る。
 * @returns Project ContextとCapability状態を持つWorkbenchProjectSurfaceを返す。
 * @precondition repositoryRootはVersion Control境界で検証済みである。
 * @postcondition 正本、Project ContextおよびCapability Directoryを変更しない。
 * @effect PROJECT_CONTEXT.mdと二つの固定Directory Metadataを読取る。
 * @failure Context欠落・不正またはFilesystem観測不能をErrorで拒否する。
 * @invariant Consumer固有Store、独自IdentityまたはRole外推測を作らない。
 * @boundary Repository→Project Operation Reader→Workbench Adapterの直接境界。
 * @security PROJECT_CONTEXT.md、22_Topics、23_Meetings以外を探索しない。
 * @concurrency 三つの独立読取りを並行し、全て成功したSnapshotだけを返す。
 */
export async function readWorkbenchProjectSurface(
  repositoryRoot: string,
): Promise<WorkbenchProjectSurface> {
  const repository = readRepositoryChangeSet(repositoryRoot);
  const [markdown, topics, meetings, plan, quality] = await Promise.all([
    readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
    readRecordCollection(
      path.join(repositoryRoot, "22_Topics"),
      /^TOPIC-\d{6}$/u,
      "topic.md",
      parseTopicMarkdown,
      (record) => record.topicId,
    ),
    readRecordCollection(
      path.join(repositoryRoot, "23_Meetings"),
      /^MTG-\d{6}$/u,
      "meeting.md",
      parseMeetingMarkdown,
      (record) => record.meetingId,
    ),
    readProjectPlan(repositoryRoot),
    readQuality(repositoryRoot),
  ]);
  const ownerArtifacts = await readWorkbenchOwnerArtifactCatalog(
    repositoryRoot,
    markdown,
  );
  return Object.freeze({
    context: parseRepositoryProjectContextMarkdown(markdown),
    topics,
    meetings,
    plan,
    quality,
    ownerArtifacts,
    repository,
  });
}
