/**
 * Provider出力の曖昧でないJSON構文解析を所有する。
 *
 * @packageDocumentation
 * @responsibility 重複key・不正文法・末尾データを拒否し、ProviderのEnvelope判定と分離する。
 * @trace ARCH-000015
 * @boundary 未信頼JSON文字列から構造化値への純粋解析境界。
 */
export { parseUnambiguousJsonDocument } from "./unambiguous-json-document.ts";
export { extractProviderTaskEnvelope } from "./task-envelope.ts";
