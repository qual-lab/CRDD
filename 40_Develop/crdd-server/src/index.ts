/**
 * CRDD Serverの共通設定と操作接続を提供する。
 * @packageDocumentation
 * @responsibility 既存HTTP／MCP入口が使う共通接続だけを公開する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 検証済み設定・認可集合と各Protocol入口の接続。
 */
export {
  inspectServerPublicOrigin,
  readServerConnectionConfiguration,
} from "./configuration/read.ts";
export { composeAuthorizedTopicMeeting } from "./topic-meeting/operations.ts";
