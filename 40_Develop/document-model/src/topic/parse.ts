/**
 * Topic正本を取得済みMarkdownから構造化する。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import { readMetadata, readSummary } from "../artifact/activity-table.ts";
import type { TopicRecord, TopicState } from "./types.ts";

/**
 * Topic Markdownを公開Read Modelへ変換する。
 *
 * @responsibility Topic Identity、Lifecycle状態と現在要約を決定論的に解析する。
 * @trace ARCH-000006
 * @input markdownにtopic.mdのUTF-8本文を受け取る。
 * @returns TopicRecordを返す。
 * @precondition 現行Topic Templateの固定Metadataと現在の論点節が存在する。
 * @postcondition 入力本文のIdentityと状態をそのまま保持する。
 * @effect N/A: Markdownを変更しない。
 * @failure ID、状態、改訂または要約不正をErrorで拒否する。
 * @invariant waiting、promoted、closedをopenへ畳まない。
 * @boundary Topic MarkdownとProject Operation公開Readerの直接境界。
 * @security Relation先を取得・推測しない。
 * @concurrency N/A: 一つの不変Snapshotを同期解析する。
 */
export function parseTopicMarkdown(markdown: string): TopicRecord {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const title = lines[0]?.replace(/^#\s+/u, "").trim() ?? "";
  const topicId = readMetadata(lines, "Topic ID");
  const projectId = readMetadata(lines, "Project ID");
  const state = readMetadata(lines, "状態");
  const revision = Number(readMetadata(lines, "改訂"));
  const owner = readMetadata(lines, "維持責任者");
  if (
    !/^TOPIC-\d{6}$/u.test(topicId) ||
    !title ||
    !Number.isSafeInteger(revision) ||
    revision < 1
  )
    throw new Error("topic_record_identity_invalid");
  if (
    !(["open", "waiting", "promoted", "closed"] as const).includes(
      state as TopicState,
    )
  )
    throw new Error("topic_record_state_invalid");
  return Object.freeze({
    topicId,
    projectId,
    state: state as TopicState,
    revision,
    owner,
    title,
    summary: readSummary(lines),
  });
}
