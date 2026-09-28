/**
 * Project Operationの部分状態投影と候補採否を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 複数Sourceの不完全性を保つ読取り投影と、明示Authorityによる候補採否を分離する。
 * @trace ARCH-000005
 * @boundary Project Operation Subsystemと利用側の公開境界。
 * @effect N/A: 公開Symbolを明示再公開するだけである。
 * @security restricted Sourceの内容・Identityを公開結果へ露出せず、候補採用Authorityを生成しない。
 */
export {
  applyProjectOperationCandidateDecision,
  projectProjectOperationSources,
  type ProjectOperationCandidate,
  type ProjectOperationCandidateDecision,
  type ProjectOperationCandidateDecisionResult,
  type ProjectOperationProjection,
  type ProjectOperationProjectionItem,
  type ProjectOperationSource,
  type ProjectOperationSourceState,
} from "./project-operation.ts";
export {
  parseRepositoryProjectContextMarkdown,
  type RepositoryProjectContext,
  type RepositoryProjectContextScene,
  type RepositoryProjectContextSceneKey,
  type RepositoryProjectContextTable,
} from "./repository-project-context.ts";
export {
  parseRepositoryReleaseProjectionMarkdown,
  type RepositoryReleaseDependency,
  type RepositoryReleaseProjection,
  type RepositoryReleaseScope,
} from "./repository-release-projection.ts";
export {
  parseRepositoryQualityProjectionMarkdown,
  type RepositoryQualityProjection,
} from "./repository-quality-projection.ts";
export {
  parseMeetingMarkdown,
  parseTopicMarkdown,
  type MeetingRecord,
  type MeetingState,
  type TopicPromotion,
  type TopicRecord,
  type TopicState,
} from "./topic-meeting.ts";
export {
  createTopicMeetingRepository,
  type ProjectOperationRecord,
  type ProjectOperationRecordKind,
  type TopicMeetingListResult,
  type TopicMeetingRepository,
  type TopicMeetingDocument,
  type TopicMeetingWriteResult,
} from "./topic-meeting-repository.ts";
export {
  createTopicMeetingApplication,
  type TopicMeetingApplication,
  type TopicMeetingListQuery,
  type TopicMeetingPage,
  type TopicMeetingRelation,
  type TopicPromotionCommandResult,
} from "./topic-meeting-application.ts";
export type {
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
} from "./topic-meeting-application.ts";
export {
  applyMeetingOutcomeTreatment,
  applyTopicPromotion,
  type MeetingOutcomeDisposition,
  type MeetingOutcomeTreatment,
} from "./topic-meeting.ts";
