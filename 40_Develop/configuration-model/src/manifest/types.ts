/**
 * Repository Manifestと読取り結果の値契約。
 * @responsibility Manifestと読取り結果の値契約だけを所有する。
 * @trace ARCH-000011
 */
import type { REPOSITORY_MANIFEST_SCHEMA } from "./validation.ts";

/**
 * runtime-data-contractで使用するRepository Manifestの値契約を定義する。
 *
 * @responsibility Repository ManifestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000011
 * @shape RepositoryManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryManifestの宣言は外部境界を開かない。
 * @security N/A: RepositoryManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryManifest = Readonly<{
  schema: typeof REPOSITORY_MANIFEST_SCHEMA;
  projectId: string;
  repositoryId: string;
  displayName: string;
  repositoryRole: string;
  capabilities: readonly string[];
  contextSurfaces: readonly string[];
  externalSendPolicy: "config/external-send-policy.json" | null;
}>;

/**
 * 同じ読取りの宣言と内容Identity、真正不存在、不正・観測不能を区別する。
 * @responsibility 読取り成功を実行許可や保存CASへ昇格しない。
 * @trace ARCH-000011
 * @shape readyはmanifest/identity、missing/blockedは固定reason。
 * @invariant 失敗時に設定・Path・生例外を返さない。
 * @boundary 固定Repository設定と利用側の再観測。
 * @security identityは旧Readerと同じUTF-8復号本文のSHA256でありAuthorityではない。
 * @compatibility 既存Manifest Schemaと保存先を変更しない。
 */
export type RepositoryManifestReadResult =
  | Readonly<{
      status: "ready";
      manifest: RepositoryManifest;
      identity: string;
    }>
  | Readonly<{ status: "missing"; reason: "repository_manifest_missing" }>
  | Readonly<{
      status: "blocked";
      reason: "repository_manifest_invalid" | "repository_manifest_unavailable";
    }>;
