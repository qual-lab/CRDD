/**
 * Artifact署名で利用する秘密鍵参照と対話入力の公開境界。
 * @packageDocumentation
 * @responsibility 秘密鍵をRepositoryへ取り込まず署名処理へ渡す。
 * @trace ARCH-000014
 * @boundary 秘密鍵File・対話端末と署名Applicationの境界。
 * @security 秘密鍵内容とpassphraseを公開結果へ含めない。
 */
export {
  preflightPrivateKeyReference,
  readPrivateKeyReferenceFromEnvironmentFile,
  signEd25519Payload,
  type PrivateKeyReferenceAuthorization,
} from "./private-key-signing.ts";
export { readHiddenLine } from "./terminal-secret-input.ts";
