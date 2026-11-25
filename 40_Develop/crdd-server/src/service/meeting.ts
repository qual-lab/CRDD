/**
 * RESTとMCPのMeeting書込みをDocument Modelの操作へ対応付ける。
 * @responsibility 対象確定済みのMeetingコマンドだけを配送する。
 * @trace ARCH-000006
 * @trace ARCH-000012
 * @boundary 各通信の受付とDocument ModelのMeeting操作。
 */
import type { TopicMeetingAccess } from "@qual-lab/crdd-document-model";
import type { RecordWriteCommand } from "./topic.ts";

type MeetingOutcomeAction = Readonly<{
  operation: "treat-outcome";
  input: Parameters<TopicMeetingAccess["meeting"]["treatMeetingOutcome"]>[0];
}>;

/** 作成・更新・削除・成果処置を既存のMeeting操作で行う。 @trace ARCH-000006 */
export function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: RecordWriteCommand,
): ReturnType<TopicMeetingAccess["meeting"]["create"]>;
export function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: MeetingOutcomeAction,
): ReturnType<TopicMeetingAccess["meeting"]["treatMeetingOutcome"]>;
export function executeMeetingAction(
  meeting: TopicMeetingAccess["meeting"],
  command: RecordWriteCommand | MeetingOutcomeAction,
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
