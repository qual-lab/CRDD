/**
 * Topic／Meeting正本のRepository CRUD Adapter。
 *
 * @packageDocumentation
 * @responsibility 固定Path、Markdown検証、改訂競合、Relation付き削除拒否および同一Repository内置換を所有する。
 * @trace ARCH-000006
 * @boundary Project Operation ApplicationとRepository Filesystemの境界。
 * @effect Topic／Meeting Markdownを作成・置換・削除する。
 * @security 検証済みRepository Root外へPathを解決せず、Symlinkを辿らない。
 */
import {
  existsSync,
  closeSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  parseMeetingMarkdown,
  parseTopicMarkdown,
  type MeetingRecord,
  type TopicRecord,
} from "./topic-meeting.ts";

export type ProjectOperationRecordKind = "topic" | "meeting";
export type ProjectOperationRecord = TopicRecord | MeetingRecord;
export type TopicMeetingDocument = Readonly<{
  record: ProjectOperationRecord;
  markdown: string;
}>;

export type TopicMeetingListResult = Readonly<
  | {
      status: "available";
      records: readonly ProjectOperationRecord[];
    }
  | { status: "not_configured"; records: readonly ProjectOperationRecord[] }
>;

export type TopicMeetingWriteResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "record_created"
    | "record_updated"
    | "record_deleted"
    | "record_already_exists"
    | "record_not_found"
    | "record_revision_conflict"
    | "record_identity_changed"
    | "record_delete_confirmation_required"
    | "record_delete_reason_invalid"
    | "record_relations_require_resolution";
  record: ProjectOperationRecord | null;
  relationPaths: readonly string[];
  filesystemEffectCount: 0 | 1;
}>;

export type TopicMeetingRepository = Readonly<{
  get(
    kind: ProjectOperationRecordKind,
    id: string,
  ): ProjectOperationRecord | null;
  getDocument(
    kind: ProjectOperationRecordKind,
    id: string,
  ): TopicMeetingDocument | null;
  list(kind: ProjectOperationRecordKind): TopicMeetingListResult;
  hasChange(id: string): boolean;
  create(
    kind: ProjectOperationRecordKind,
    markdown: string,
  ): TopicMeetingWriteResult;
  update(
    kind: ProjectOperationRecordKind,
    id: string,
    expectedRevision: number,
    markdown: string,
  ): TopicMeetingWriteResult;
  inspectDeletion(
    kind: ProjectOperationRecordKind,
    id: string,
  ): Readonly<{
    record: ProjectOperationRecord | null;
    relationPaths: readonly string[];
  }>;
  delete(input: {
    kind: ProjectOperationRecordKind;
    id: string;
    expectedRevision: number;
    confirmed: boolean;
    reason: "mistaken_registration";
  }): TopicMeetingWriteResult;
}>;

const kindContract = Object.freeze({
  topic: Object.freeze({ directory: "22_Topics", prefix: "TOPIC" }),
  meeting: Object.freeze({ directory: "23_Meetings", prefix: "MTG" }),
});

/** Topic／Meeting MarkdownをKind固有Recordへ検証変換する。 */
function parseRecord(
  kind: ProjectOperationRecordKind,
  markdown: string,
): ProjectOperationRecord {
  return kind === "topic"
    ? parseTopicMarkdown(markdown)
    : parseMeetingMarkdown(markdown);
}

/** Recordの安定IDをKindに依存せず取得する。 */
function recordId(record: ProjectOperationRecord): string {
  return "topicId" in record ? record.topicId : record.meetingId;
}

/** Repository内MarkdownをSymlink非追跡で列挙する。 */
function walkMarkdown(root: string, current = root): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    if ([".git", ".crdd", "node_modules"].includes(entry.name)) continue;
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) results.push(...walkMarkdown(root, absolute));
    else if (entry.isFile() && entry.name.endsWith(".md"))
      results.push(path.relative(root, absolute).replaceAll("\\", "/"));
  }
  return results;
}

/**
 * 検証済みRepository RootへTopic／Meeting CRUDを接続する。
 *
 * @responsibility 一つのRepository内でID、Revision、Path、RelationおよびFilesystem Effectを同期させる。
 * @trace ARCH-000006
 * @input repositoryRootにVersion Control境界で検証済みの絶対Rootを受け取る。
 * @returns Topic／Meetingの取得・一覧・登録・編集・削除Portを返す。
 * @precondition Rootは実在Directoryで、現在の書込み許可Repositoryである。
 * @postcondition 書込み成功時は完全検証済みMarkdownだけがCanonical Pathへ存在する。
 * @effect create、update、deleteだけがRepository Filesystemを一回変更する。
 * @failure Identity、Revision、Relationまたは確認不足ではEffect 0でblockedを返す。
 * @invariant Topicは`22_Topics/TOPIC-xxxxxx/topic.md`、Meetingは`23_Meetings/MTG-xxxxxx/meeting.md`だけを使う。
 * @boundary 検証済みRepository RootとTopic／Meeting Canonical Pathの境界。
 * @security Root外Path、Symlink Recordおよび未確認削除を拒否する。
 * @concurrency expectedRevision不一致を拒否し、自動Mergeまたは再試行を行わない。
 */
export function createTopicMeetingRepository(
  repositoryRoot: string,
): TopicMeetingRepository {
  const root = path.resolve(repositoryRoot);
  if (!path.isAbsolute(repositoryRoot) || !lstatSync(root).isDirectory())
    throw new Error("project_operation_repository_root_invalid");

  const location = (kind: ProjectOperationRecordKind, id: string) => {
    const contract = kindContract[kind];
    if (!new RegExp(`^${contract.prefix}-\\d{6}$`, "u").test(id))
      throw new Error("project_operation_record_id_invalid");
    const directory = path.resolve(root, contract.directory, id);
    const file = path.resolve(
      directory,
      kind === "topic" ? "topic.md" : "meeting.md",
    );
    if (!file.startsWith(`${root}${path.sep}`))
      throw new Error("project_operation_record_path_invalid");
    return {
      directory,
      file,
      rootDirectory: path.join(root, contract.directory),
    };
  };

  const readDocument = (kind: ProjectOperationRecordKind, id: string) => {
    const target = location(kind, id);
    if (!existsSync(target.file)) return null;
    if (lstatSync(target.file).isSymbolicLink())
      throw new Error("project_operation_record_symlink_rejected");
    const markdown = readFileSync(target.file, "utf8");
    return Object.freeze({ record: parseRecord(kind, markdown), markdown });
  };
  const read = (kind: ProjectOperationRecordKind, id: string) =>
    readDocument(kind, id)?.record ?? null;

  const relations = (kind: ProjectOperationRecordKind, id: string) => {
    const target = location(kind, id);
    return Object.freeze(
      walkMarkdown(root)
        .filter((relative) => path.resolve(root, relative) !== target.file)
        .filter((relative) =>
          readFileSync(path.resolve(root, relative), "utf8").includes(id),
        )
        .sort(),
    );
  };

  const withRecordLock = <T>(
    kind: ProjectOperationRecordKind,
    id: string,
    operation: () => T,
  ): T | null => {
    const target = location(kind, id);
    mkdirSync(target.rootDirectory, { recursive: true });
    const lockPath = path.join(target.rootDirectory, `.${id}.lock`);
    let descriptor: number;
    try {
      descriptor = openSync(lockPath, "wx");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "EEXIST"
      )
        return null;
      throw error;
    }
    try {
      return operation();
    } finally {
      closeSync(descriptor);
      unlinkSync(lockPath);
    }
  };

  const blocked = (
    reason: TopicMeetingWriteResult["reason"],
    record: ProjectOperationRecord | null,
    relationPaths: readonly string[] = [],
  ): TopicMeetingWriteResult =>
    Object.freeze({
      status: "blocked" as const,
      reason,
      record,
      relationPaths: Object.freeze([...relationPaths]),
      filesystemEffectCount: 0 as const,
    });

  const publish = (
    kind: ProjectOperationRecordKind,
    record: ProjectOperationRecord,
    markdown: string,
  ) => {
    const target = location(kind, recordId(record));
    mkdirSync(target.directory, { recursive: true });
    const temporary = path.join(
      target.directory,
      `.${path.basename(target.file)}.${process.pid}.${Date.now()}.tmp`,
    );
    writeFileSync(temporary, markdown, { encoding: "utf8", flag: "wx" });
    try {
      renameSync(temporary, target.file);
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      throw error;
    }
  };

  return Object.freeze({
    get: read,
    getDocument: readDocument,
    list: (kind) => {
      const contract = kindContract[kind];
      const rootDirectory = path.join(root, contract.directory);
      if (!existsSync(rootDirectory))
        return Object.freeze({
          status: "not_configured" as const,
          records: Object.freeze([]),
        });
      const records = readdirSync(rootDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => read(kind, entry.name))
        .filter((record): record is ProjectOperationRecord => record !== null)
        .sort((left, right) => recordId(left).localeCompare(recordId(right)));
      return Object.freeze({
        status: "available" as const,
        records: Object.freeze(records),
      });
    },
    hasChange: (id) => {
      if (!/^CHG-\d{6}$/u.test(id))
        throw new Error("project_operation_change_id_invalid");
      const file = path.resolve(root, "99_Roadmap", "Changes", id, "change.md");
      if (!file.startsWith(`${root}${path.sep}`) || !existsSync(file))
        return false;
      if (lstatSync(file).isSymbolicLink())
        throw new Error("project_operation_record_symlink_rejected");
      return true;
    },
    create: (kind, markdown) => {
      const record = parseRecord(kind, markdown);
      const id = recordId(record);
      if (record.revision !== 1)
        return blocked("record_revision_conflict", record);
      const result = withRecordLock(kind, id, () => {
        if (read(kind, id) !== null)
          return blocked("record_already_exists", record);
        publish(kind, record, markdown);
        return Object.freeze({
          status: "completed" as const,
          reason: "record_created" as const,
          record,
          relationPaths: Object.freeze([]),
          filesystemEffectCount: 1 as const,
        });
      });
      return result ?? blocked("record_revision_conflict", record);
    },
    update: (kind, id, expectedRevision, markdown) => {
      const next = parseRecord(kind, markdown);
      const result = withRecordLock(kind, id, () => {
        const current = read(kind, id);
        if (current === null) return blocked("record_not_found", null);
        if (current.revision !== expectedRevision)
          return blocked("record_revision_conflict", current);
        if (
          recordId(next) !== id ||
          next.projectId !== current.projectId ||
          next.revision !== expectedRevision + 1
        )
          return blocked("record_identity_changed", current);
        publish(kind, next, markdown);
        return Object.freeze({
          status: "completed" as const,
          reason: "record_updated" as const,
          record: next,
          relationPaths: Object.freeze([]),
          filesystemEffectCount: 1 as const,
        });
      });
      return result ?? blocked("record_revision_conflict", read(kind, id));
    },
    inspectDeletion: (kind, id) =>
      Object.freeze({
        record: read(kind, id),
        relationPaths: relations(kind, id),
      }),
    delete: ({ kind, id, expectedRevision, confirmed, reason }) => {
      const result = withRecordLock(kind, id, () => {
        const current = read(kind, id);
        if (current === null) return blocked("record_not_found", null);
        if (current.revision !== expectedRevision)
          return blocked("record_revision_conflict", current);
        if (reason !== "mistaken_registration")
          return blocked("record_delete_reason_invalid", current);
        const relationPaths = relations(kind, id);
        if (relationPaths.length > 0)
          return blocked(
            "record_relations_require_resolution",
            current,
            relationPaths,
          );
        if (!confirmed)
          return blocked("record_delete_confirmation_required", current);
        const target = location(kind, id);
        unlinkSync(target.file);
        rmdirSync(target.directory);
        return Object.freeze({
          status: "completed" as const,
          reason: "record_deleted" as const,
          record: current,
          relationPaths: Object.freeze([]),
          filesystemEffectCount: 1 as const,
        });
      });
      return result ?? blocked("record_revision_conflict", read(kind, id));
    },
  });
}
