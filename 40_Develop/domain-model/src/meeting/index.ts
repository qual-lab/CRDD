/**
 * Meetingの意味処理を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Meetingの固定Markdown解析、Outcome処置次版とMeeting専用CRUD入口を公開する。
 * @trace ARCH-000006
 * @boundary Meeting正本と利用側の境界。
 * @effect N/A: 文字列解析・生成だけを行う。
 * @security 未処置Outcomeを完了へ畳まず、保存許可を生成しない。
 */
export type {
  MeetingState,
  MeetingRecord,
  MeetingOutcomeDisposition,
  MeetingOutcomeTreatment,
} from "./types.ts";
export {
  parseMeetingMarkdown,
  applyMeetingOutcomeTreatment,
} from "./meeting-markdown.ts";
export { createMeetingApplication } from "./meeting-application.ts";
export type { MeetingApplication } from "./types.ts";
export type {
  TopicMeetingApplications,
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicMeetingRepository,
} from "../storage/types.ts";
