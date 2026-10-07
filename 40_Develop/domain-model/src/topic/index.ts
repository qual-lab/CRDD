/**
 * Topicの意味処理を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Topicの固定Markdown解析、昇格次版とTopic専用CRUD入口を公開する。
 * @trace ARCH-000006
 * @boundary Topic正本と利用側の境界。
 * @effect N/A: 文字列解析・生成だけを行う。
 * @security 保存許可やCHG採用Authorityを生成しない。
 */
export type { TopicState, TopicRecord, TopicPromotion } from "./types.ts";
export { parseTopicMarkdown, applyTopicPromotion } from "./topic-markdown.ts";
export { createTopicApplication } from "./topic-application.ts";
export type { TopicApplication } from "./types.ts";
export type {
  TopicMeetingApplications,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicMeetingRepository,
  TopicMeetingListResult,
  TopicPromotionCommandResult,
} from "../storage/types.ts";
