/**
 * Topic／Meetingの記録操作と、関連文書を扱う操作の構成を担当する。
 * @responsibility 認可済み集合を既存の関連評価に渡し、種別ごとの書込みをDocument Modelへ配送する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 各通信の受付とDocument ModelのTopic／Meeting操作。
 */
import type {
  MeetingOutcomeCommandResult,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  RepositoryProjectContext,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingListReadResult,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "@qual-lab/crdd-document-model";

import type {
  AuthorizedRepository,
  FilesystemStoreRoot,
} from "@qual-lab/crdd-access-management";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import { statSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import {
  createMeetingOperations,
  createTopicOperations,
  federateTopicMeetingRelations,
  parseMeetingMarkdown,
  parseTopicMarkdown,
  readTopicMeetingList,
  readRepositoryProjectContext,
  type TopicMeetingAccess,
} from "@qual-lab/crdd-document-model";
import {
  observeAuthorizedManifest,
  resolveGitHostLinkedRepositories,
  type GitHostLinkedAccessSession,
  type GitHostLinkedRepositoryAccess,
} from "./access.ts";

function directoryIdentity(root: string) {
  const stat = statSync(root, { bigint: true });
  if (!stat.isDirectory() || stat.ino === 0n)
    throw new Error("topic_meeting_access_unavailable");
  return `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
}

type RecordReadAccess = Readonly<{
  access: TopicMeetingAccess;
  repositoryId: string;
  writable: boolean;
  verify?: () => void;
  repositoryOnly?: true;
}>;

function verifyGitHostLinkedRecordAccess(
  hosted: GitHostLinkedRepositoryAccess,
  selected: AuthorizedRepository,
) {
  if (observeAuthorizedManifest(selected) !== "current")
    throw new Error("topic_meeting_access_unavailable");
  hosted.assertCurrent([selected]);
}

type RecordWriteResult =
  | TopicMeetingWriteResult
  | TopicPromotionCommandResult
  | MeetingOutcomeCommandResult
  | {
      status: "unavailable";
      reason: "record_publication_unconfirmed";
      effectState: "unknown";
    }
  | null;

/** 通信から使う、対象決定済みの記録操作。 @trace ARCH-000012 */
export interface RecordOperations {
  write(action: RecordAction): Promise<RecordWriteResult>;
  list(
    input: Parameters<typeof readTopicMeetingList>[0],
  ): Promise<TopicMeetingListReadResult>;
  get(
    kind: ProjectOperationRecordKind,
    id: string,
    includeAccess?: boolean,
  ): Promise<RecordReadResult | null>;
}

interface RecordReadResult {
  readonly status: "completed" | "not_found";
  readonly record: ProjectOperationRecord | null;
  readonly markdown: string | null;
  readonly relations: readonly TopicMeetingRelation[];
  readonly repositoryId?: string;
  readonly writable?: boolean;
  readonly relationScope?: "repository";
}

function createRecordOperations(
  signal: AbortSignal,
  prepare: (
    detail: boolean,
  ) => RecordReadAccess | null | Promise<RecordReadAccess | null>,
  write: RecordOperations["write"],
): RecordOperations {
  return {
    write,
    async list(input: Parameters<typeof readTopicMeetingList>[0]) {
      let verify: (() => void) | undefined;
      const result = await readTopicMeetingList(
        input,
        {
          resolve: async () => {
            const chosen = await prepare(false);
            verify = chosen?.verify;
            return chosen?.access ?? null;
          },
        },
        signal,
      );
      if (result.status === "complete") verify?.();
      return result;
    },
    async get(
      kind: ProjectOperationRecordKind,
      id: string,
      includeAccess = false,
    ) {
      const chosen = await prepare(includeAccess);
      if (!chosen || signal.aborted) return null;
      const observed = chosen.access[kind].getDocumentWithRelations(id);
      const document = observed?.document;
      const result = {
        status: document ? ("completed" as const) : ("not_found" as const),
        record: document?.record ?? null,
        markdown: document?.markdown ?? null,
        relations: observed?.relations ?? [],
        ...(includeAccess && {
          repositoryId: chosen.repositoryId,
          writable: chosen.writable,
        }),
        ...(chosen.repositoryOnly
          ? { relationScope: "repository" as const }
          : {}),
      };
      chosen.verify?.();
      return result;
    },
  };
}

/** 起動リポジトリの既存文書操作だけに接続する。 @trace ARCH-000012 */
export function createLocalRecords(
  root: string,
  repositoryId: string | undefined,
  signal: AbortSignal,
  localContext?: Pick<
    RepositoryProjectContext,
    "projectId" | "repositoryId" | "repositoryRole"
  >,
): RecordOperations {
  const resolve = (readOnlyFallback = false) => {
    if (signal.aborted) return null;
    const manifest = readRepositoryManifest(root);
    if (
      manifest.status === "missing" &&
      readOnlyFallback &&
      localContext &&
      repositoryId === localContext.repositoryId
    ) {
      const identity = directoryIdentity(root);
      const observed = readRepositoryProjectContext(root, localContext);
      if (observed.status !== "completed") return null;
      return {
        projectId: localContext.projectId,
        repositoryId: localContext.repositoryId,
        writable: false,
        verify() {
          const current = readRepositoryProjectContext(root, localContext);
          if (
            signal.aborted ||
            current.status !== "completed" ||
            current.revision !== observed.revision ||
            readRepositoryManifest(root).status !== "missing" ||
            directoryIdentity(root) !== identity
          )
            throw new Error("topic_meeting_access_unavailable");
        },
      };
    }
    if (
      manifest.status !== "ready" ||
      (repositoryId !== undefined &&
        manifest.manifest.repositoryId !== repositoryId)
    )
      return null;
    const identity = directoryIdentity(root);
    const verify = () => {
      const current = readRepositoryManifest(root);
      if (
        signal.aborted ||
        current.status !== "ready" ||
        current.identity !== manifest.identity ||
        directoryIdentity(root) !== identity
      )
        throw new Error("topic_meeting_access_unavailable");
    };
    return {
      projectId: manifest.manifest.projectId,
      repositoryId: manifest.manifest.repositoryId,
      writable: true,
      verify,
    };
  };
  return createRecordOperations(
    signal,
    (detail) => {
      const selected = resolve(detail);
      return (
        selected && {
          access: {
            topic: createTopicOperations(root, selected.projectId),
            meeting: createMeetingOperations(root, selected.projectId),
          },
          verify: selected.verify,
          repositoryId: selected.repositoryId,
          writable: selected.writable,
        }
      );
    },
    async (action) => {
      const selected = resolve();
      return selected
        ? writeVerifiedRecord(root, selected.projectId, selected.verify, action)
        : null;
    },
  );
}

/** 指定した共有Repositoryの記録操作を、読み書き別の認可に結び付ける。 */
export function createGitHostLinkedRecords(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession,
  repositoryId: string,
  signal: AbortSignal,
): RecordOperations {
  const prepare = async () => {
    const hosted = await resolveGitHostLinkedRepositories(
      root,
      session,
      signal,
      repositoryId,
    );
    if (signal.aborted) return null;
    const selected = hosted?.repositories[0];
    if (!hosted || !selected) return null;
    hosted.assertDirectory(selected);
    const access = resolveTopicMeetingAccess(
      [selected],
      repositoryId,
      hosted.signal,
      "topic_meeting_access_unavailable",
    );
    return access
      ? {
          access,
          repositoryId,
          writable: hosted.canWrite(repositoryId),
          repositoryOnly: true as const,
          verify: () => verifyGitHostLinkedRecordAccess(hosted, selected),
        }
      : null;
  };
  return createRecordOperations(signal, prepare, (action) =>
    executeGitHostLinkedRecordWrite(
      root,
      session,
      repositoryId,
      signal,
      action,
    ),
  );
}

/** TopicとMeetingが共用する種別確定済みの書込み入力。 @trace ARCH-000006 */
type RecordWriteCommand =
  | Readonly<{
      operation: "create";
      input: Parameters<TopicMeetingAccess["topic"]["create"]>[0];
    }>
  | Readonly<{
      operation: "update";
      input: Parameters<TopicMeetingAccess["topic"]["update"]>[0];
    }>
  | Readonly<{
      operation: "delete";
      input: Parameters<TopicMeetingAccess["topic"]["delete"]>[0];
    }>;

/**
 * 今回の許可集合から指定先のTopic／Meeting操作を構成する。
 * @responsibility Relationと保存Ownerを同じ認可集合へ結合する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 今回AM確認済み集合、明示ID、所有Signal、既存入口の固定拒否理由。
 * @returns 指定先のDomain操作またはnull。
 * @precondition 各入口が現在の許可集合を得て、用途固有の最終確認を行う。
 * @postcondition Relationは同Projectの今回許可対象だけ。
 * @effect 検証済みRootから既存Domain操作を構成する。
 * @failure 取消・Root不明は固定例外。
 * @invariant 操作構成を次要求の認可証明として保持しない。
 * @boundary 今回のAM集合と既存Domain操作。
 * @security Root・資格を公開結果へ渡さない。
 * @concurrency AMを再取得せず同じ短命集合を使う。
 */
export function resolveTopicMeetingAccess(
  repositories: readonly Pick<
    AuthorizedRepository,
    "repositoryId" | "manifest" | "root"
  >[],
  repositoryId: string,
  signal: AbortSignal,
  unavailableReason:
    | "workbench_local_records_unavailable"
    | "topic_meeting_access_unavailable",
): TopicMeetingAccess | null {
  const selected = repositories.find(
    (entry) => entry.repositoryId === repositoryId,
  );
  if (!selected) return null;
  const sources = repositories
    .filter((entry) => entry.manifest.projectId === selected.manifest.projectId)
    .map((entry) => {
      if (signal.aborted) throw new Error(unavailableReason);
      return {
        repositoryId: entry.repositoryId,
        projectId: entry.manifest.projectId,
        application: {
          topic: createTopicOperations(entry.root, entry.manifest.projectId),
          meeting: createMeetingOperations(
            entry.root,
            entry.manifest.projectId,
          ),
        },
      };
    });
  if (signal.aborted) throw new Error(unavailableReason);
  return federateTopicMeetingRelations(repositoryId, sources);
}

type TopicPromotionAction = Readonly<{
  operation: "promote";
  input: Parameters<TopicMeetingAccess["topic"]["promoteTopic"]>[0];
}>;

type MeetingTreatment = Readonly<{
  operation: "treat-outcome";
  input: Parameters<TopicMeetingAccess["meeting"]["treatMeetingOutcome"]>[0];
}>;
type RecordAction =
  | { kind: ProjectOperationRecordKind; command: RecordWriteCommand }
  | { kind: "topic"; command: TopicPromotionAction }
  | { kind: "meeting"; command: MeetingTreatment };
export type RecordActionName = RecordAction["command"]["operation"];

/** RESTとMCPで同じ完全入力を確定してから外部の認可を照会する。 */
export function readRecordWrite(
  kind: ProjectOperationRecordKind,
  operation: RecordActionName,
  input: Record<string, unknown>,
): RecordAction | null {
  const exact = (...keys: string[]) =>
    Object.keys(input).length === keys.length &&
    keys.every((key) => Object.hasOwn(input, key));
  const strings = (...keys: string[]) =>
    keys.every((key) => typeof input[key] === "string");
  const revision =
    typeof input.expectedRevision === "number" &&
    Number.isSafeInteger(input.expectedRevision) &&
    input.expectedRevision > 0
      ? input.expectedRevision
      : null;
  const validId = (id: unknown) =>
    typeof id === "string" &&
    (kind === "topic" ? /^TOPIC-\d{6}$/u : /^MTG-\d{6}$/u).test(id);
  if (operation === "create" || operation === "update") {
    const { id, markdown } = input;
    if (
      typeof markdown !== "string" ||
      (operation === "create"
        ? !exact("markdown")
        : !exact("id", "expectedRevision", "markdown") ||
          !validId(id) ||
          revision === null)
    )
      return null;
    try {
      if (kind === "topic") parseTopicMarkdown(markdown);
      else parseMeetingMarkdown(markdown);
    } catch {
      return null;
    }
    return {
      kind,
      command:
        operation === "create"
          ? { operation, input: markdown }
          : {
              operation,
              input: {
                id: id as string,
                expectedRevision: revision as number,
                markdown,
              },
            },
    };
  }
  if (revision === null) return null;
  if (operation === "delete") {
    if (
      !exact("id", "expectedRevision", "confirmed", "reason") ||
      !validId(input.id) ||
      typeof input.confirmed !== "boolean" ||
      input.reason !== "mistaken_registration"
    )
      return null;
    return {
      kind,
      command: {
        operation,
        input: {
          id: input.id as string,
          expectedRevision: revision,
          confirmed: input.confirmed,
          reason: input.reason,
        },
      },
    };
  }
  if (operation === "promote" && kind === "topic") {
    if (
      !exact(
        "topicId",
        "expectedRevision",
        "changeId",
        "reason",
        "remainingResponsibility",
      ) ||
      !validId(input.topicId) ||
      typeof input.changeId !== "string" ||
      !/^CHG-\d{6}$/u.test(input.changeId) ||
      typeof input.reason !== "string" ||
      typeof input.remainingResponsibility !== "string"
    )
      return null;
    return {
      kind,
      command: {
        operation,
        input: {
          topicId: input.topicId as string,
          expectedRevision: revision,
          changeId: input.changeId,
          reason: input.reason,
          remainingResponsibility: input.remainingResponsibility,
        },
      },
    };
  }
  if (operation !== "treat-outcome" || kind !== "meeting") return null;
  const textFields = [
    "meetingId",
    "outcomeId",
    "disposition",
    "owner",
    "reviewTrigger",
    "targetKind",
    "targetReference",
    "treatment",
    "completionCondition",
    "result",
  ];
  if (
    !exact(...textFields, "expectedRevision", "closeMeeting") ||
    !strings(...textFields) ||
    !validId(input.meetingId) ||
    !/^OUT-\d{3,}$/u.test(input.outcomeId as string) ||
    typeof input.closeMeeting !== "boolean" ||
    !["completed", "transferred", "promoted", "rejected"].includes(
      input.disposition as string,
    ) ||
    !["topic", "change", "owner", "none"].includes(
      input.targetKind as string,
    ) ||
    (input.targetKind === "topic" &&
      !/^TOPIC-\d{6}$/u.test(input.targetReference as string)) ||
    (input.targetKind === "change" &&
      !/^CHG-\d{6}$/u.test(input.targetReference as string))
  )
    return null;
  return {
    kind,
    command: {
      operation,
      input: {
        meetingId: input.meetingId as string,
        expectedRevision: revision,
        outcomeId: input.outcomeId as string,
        disposition:
          input.disposition as MeetingTreatment["input"]["disposition"],
        owner: input.owner as string,
        reviewTrigger: input.reviewTrigger as string,
        target: {
          kind: input.targetKind as MeetingTreatment["input"]["target"]["kind"],
          reference: input.targetReference as string,
        },
        treatment: input.treatment as string,
        completionCondition: input.completionCondition as string,
        result: input.result as string,
        closeMeeting: input.closeMeeting,
      },
    },
  };
}

/** 正式な文書操作への一度の配送。 */
export function executeRecordWrite(
  access: TopicMeetingAccess,
  { kind, command }: RecordAction,
) {
  if (command.operation === "promote")
    return executeTopicAction(access.topic, command);
  if (command.operation === "treat-outcome")
    return executeMeetingAction(access.meeting, command);
  return kind === "topic"
    ? executeTopicAction(access.topic, command)
    : executeMeetingAction(access.meeting, command);
}

/** 外部照会はLock外。Lock内で行うのはローカルの現在確認だけ。 */
async function executeGitHostLinkedRecordWrite(
  root: FilesystemStoreRoot,
  session: GitHostLinkedAccessSession,
  repositoryId: string,
  signal: AbortSignal,
  action: RecordAction,
) {
  const hosted = await resolveGitHostLinkedRepositories(
    root,
    session,
    signal,
    repositoryId,
    "write",
  );
  if (signal.aborted) return null;
  const selected = hosted?.repositories[0];
  if (!hosted || !selected) return null;
  const verify = () => verifyGitHostLinkedRecordAccess(hosted, selected);
  hosted.assertDirectory(selected);
  return writeVerifiedRecord(
    selected.root,
    selected.manifest.projectId,
    verify,
    action,
  );
}

async function writeVerifiedRecord(
  root: string,
  projectId: string,
  verify: () => void,
  action: RecordAction,
) {
  let publicationAttempted = false;
  const beforeWrite = (phase: "stage" | "publish") => {
    verify();
    if (phase === "publish") publicationAttempted = true;
  };
  try {
    const access = {
      topic: createTopicOperations(root, projectId, beforeWrite),
      meeting: createMeetingOperations(root, projectId, beforeWrite),
    };
    const result = executeRecordWrite(access, action);
    // 同期保存中に到着した切断を受け、現在の認可を再照合してから結果を公開する。
    if (publicationAttempted) await setTimeout(0);
    verify();
    return result;
  } catch (error) {
    if (!publicationAttempted && !(error instanceof AggregateError))
      throw error;
    // Effect発行後は、認可を失っても無保存や巻戻しとは扱わない。
    return {
      status: "unavailable" as const,
      reason: "record_publication_unconfirmed" as const,
      effectState: "unknown" as const,
    };
  }
}

/** 作成・更新・削除・昇格を既存のTopic操作で行う。 @trace ARCH-000006 */
function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: RecordWriteCommand,
): ReturnType<TopicMeetingAccess["topic"]["create"]>;
function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: TopicPromotionAction,
): ReturnType<TopicMeetingAccess["topic"]["promoteTopic"]>;
function executeTopicAction(
  topic: TopicMeetingAccess["topic"],
  command: RecordWriteCommand | TopicPromotionAction,
) {
  switch (command.operation) {
    case "create":
      return topic.create(command.input);
    case "update":
      return topic.update(command.input);
    case "delete":
      return topic.delete(command.input);
    case "promote":
      return topic.promoteTopic(command.input);
  }
}
/** 作成・更新・削除・成果処置を既存のMeeting操作で行う。 @trace ARCH-000006 */
function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: RecordWriteCommand,
): ReturnType<TopicMeetingAccess["meeting"]["create"]>;
function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: MeetingTreatment,
): ReturnType<TopicMeetingAccess["meeting"]["treatMeetingOutcome"]>;
function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: RecordWriteCommand | MeetingTreatment,
) {
  switch (command.operation) {
    case "create":
      return meeting.create(command.input);
    case "update":
      return meeting.update(command.input);
    case "delete":
      return meeting.delete(command.input);
    case "treat-outcome":
      return meeting.treatMeetingOutcome(command.input);
  }
}

/**
 * Topic／Meeting本文とRelationを表示へ渡す同期Reader契約。
 * @responsibility 認可済みDomain操作の読取り形だけを共有する。
 * @trace ARCH-000006
 * @shape 種別とIDを受ける本文・Relationの二読取り。
 * @invariant 資格・Root・通信・保存を所有しない。
 * @boundary Domainの読取りとWorkbench表示。
 * @security Callerの現在認可済み操作だけを構成し、Rootや資格を公開しない。
 * @compatibility 現行Domain結果のみ。旧MCP搬送を含めない。
 */
export type RecordDocumentReader = Readonly<{
  getDocumentWithRelations(
    kind: ProjectOperationRecordKind,
    id: string,
  ): Pick<RecordDocumentView, "document" | "relations"> | null;
}>;

/**
 * 当該PageのRecord本文とRelationを表示用に取得する。
 * @responsibility 現在一覧に含まれるRecordだけを注入Readerから読む。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input Topic／Meetingの有界Pageと、現在認可した同期本文・Relation Reader。
 * @returns 取得できた本文の不変表示一覧。
 * @precondition Callerが当該要求のRepository・内容認可と一覧取得を完了している。
 * @postcondition Page外のIDを読まず、元の本文とRelationを保持する。
 * @effect 注入Readerを通した本文とRelationの読取り。
 * @failure Reader例外をCallerへ伝播する。本文未取得nullのRecordは一覧へ補完しない。
 * @invariant 変換だけから認可・保存・完全観測の成立を生成しない。
 * @boundary 認可済み本文Readerと表示DTO。
 * @security 本文をHTMLとして実行せず、資格・物理Rootを追加しない。
 * @concurrency 同じ要求内の同期Readerだけを使い、次要求へ保持しない。
 */
export function createRecordDocumentViews(
  topicPage: TopicMeetingPage,
  meetingPage: TopicMeetingPage,
  reader: RecordDocumentReader,
): readonly RecordDocumentView[] {
  const values: RecordDocumentView[] = [];
  for (const [kind, page] of [
    ["topic", topicPage],
    ["meeting", meetingPage],
  ] as const) {
    for (const record of page.records) {
      const id = "topicId" in record ? record.topicId : record.meetingId;
      const observed = reader.getDocumentWithRelations(kind, id);
      if (observed === null) continue;
      values.push(
        Object.freeze({
          kind,
          id,
          document: observed.document,
          relations: Object.freeze([...observed.relations]),
        }),
      );
    }
  }
  return Object.freeze(values);
}

/**
 * Topic／Meetingの表示検索を同じ固定入力へ変換する。
 * @responsibility 単体と共有で検索・並び順・ページ条件の意味を揃える。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @input URL検索値と対象Record種別。
 * @returns 既存Domain一覧へ渡す非Authorityの検索条件。
 * @precondition Repository認可は別途要求ごとに行う。
 * @postcondition 空値を省略し未知sortを既存既定値へ戻す。
 * @effect N/A: 同期入力変換だけ。
 * @failure 不正検索の最終判定はDomain一覧が所有する。
 * @invariant 検索値からRoot・権限・保存操作を生成しない。
 * @boundary HTTP表示入力とDomain一覧。
 * @security 任意Pathや資格を条件へ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function readRecordQuery(
  parameters: URLSearchParams,
  kind: "topic" | "meeting",
): TopicMeetingListQuery {
  const result: Record<string, unknown> = {};
  for (const [field, suffix] of [
    ["query", "Query"],
    ["relation", "Relation"],
    ...(kind === "topic"
      ? [["owner", "Owner"]]
      : [
          ["occurredFrom", "From"],
          ["occurredTo", "To"],
        ]),
  ]) {
    const value = parameters.get(`${kind}${suffix}`)?.trim();
    if (value && field !== undefined) result[field] = value;
  }
  const state = parameters.get(`${kind}State`)?.trim();
  if (state) result.states = [state];
  const sort = parameters.get(`${kind}Sort`)?.trim();
  result.sort =
    kind === "topic"
      ? sort === "title_asc" || sort === "state_asc"
        ? sort
        : "id_asc"
      : sort === "id_asc" || sort === "title_asc"
        ? sort
        : "occurred_desc";
  if (kind === "meeting" && parameters.get("meetingPending") === "true")
    result.pendingOnly = true;
  return Object.freeze(result) as TopicMeetingListQuery;
}

/**
 * 選択済みRepositoryのTopic・Meeting一覧を順に取得する。
 * @responsibility 単体と共有で検索・Cursor・ページ幅・本文Readerの構成を揃える。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 同じ要求内の認可済み操作へ接続し、再認可・応答は受付が所有する。
 */
export function readRecordPages(
  access: TopicMeetingAccess,
  parameters: URLSearchParams,
) {
  const topicCursor = parameters.get("topicCursor");
  const meetingCursor = parameters.get("meetingCursor");
  const topicQuery = readRecordQuery(parameters, "topic");
  const meetingQuery = readRecordQuery(parameters, "meeting");
  const topicPage = access.topic.list({
    ...(topicCursor === null ? {} : { cursor: topicCursor }),
    limit: 20,
    query: topicQuery,
  });
  const meetingPage = access.meeting.list({
    ...(meetingCursor === null ? {} : { cursor: meetingCursor }),
    limit: 20,
    query: meetingQuery,
  });
  const reader: RecordDocumentReader = {
    getDocumentWithRelations: (kind, id) =>
      access[kind].getDocumentWithRelations(id),
  };
  return { topicQuery, meetingQuery, topicPage, meetingPage, reader };
}
/**
 * Browserへ公開できる一件のTopic／Meeting本文とRelation。
 * @responsibility 本文とRelationを同一Record Identityで表示する。
 * @trace ARCH-000012
 * @shape kind、id、documentおよびrelationsで構成する。
 * @input N/A: 型宣言である。
 * @returns N/A: 型宣言である。
 * @precondition Serverで公開可能性を確定済みである。
 * @postcondition Browserは読取り表示値だけを受け取る。
 * @effect N/A: 型宣言である。
 * @failure N/A: 失敗はServer応答で表す。
 * @invariant Record正本を所有しない。
 * @boundary Project OperationとBrowser表示の境界。
 * @security Serverが許可した内容だけを含む。
 * @compatibility Client Model revision 1内で使用する。
 * @concurrency N/A: 不変Snapshotである。
 */
export type RecordDocumentView = Readonly<{
  kind: ProjectOperationRecordKind;
  id: string;
  document: TopicMeetingDocument;
  relations: readonly TopicMeetingRelation[];
}>;
/**
 * Topic／MeetingのCanonical本文と許可済み処置を表示するRead Model。
 * @responsibility Record Detailと明示POSTに必要な用途限定値を運ぶ。
 * @trace ARCH-000012
 * @shape contract、view、repositoryIdおよびrecordで構成する。
 * @invariant viewはrecord-detailである。
 * @boundary Project Operation RecordとRecord Detail ScreenのJSON境界。
 * @security 操作可否は表示用であり、書込み時に改めて認可する。
 * @compatibility contract `crdd/workbench/view/v1`のrecord-detail variantである。
 */
export type RecordDetailResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "record-detail";
  repositoryId: string | null;
  operationRepositoryId: string;
  record: RecordDocumentView;
  recordActionsConfigured: boolean;
}>;
