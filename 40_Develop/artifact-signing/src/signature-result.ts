/**
 * Artifact Signingが利用側へ返す署名結果だけを定義する。
 *
 * @packageDocumentation
 * @responsibility 暗号署名結果とManifest生成・配置・公開責務の境界を固定する。
 * @trace ARCH-000014
 * @boundary Artifact Signing→署名結果Consumerの値境界。
 * @security 秘密値、Filesystem Pathおよび公開判断を結果へ含めない。
 */

const ARTIFACT_SIGNATURE_RESULT_KEYS = Object.freeze([
  "algorithm",
  "keyId",
  "signature",
] as const);

/**
 * Artifact Signingの公開署名結果を定義する。
 *
 * @responsibility 利用側へ渡せる署名値、Publisher IdentityおよびAlgorithmだけを型として所有する。
 * @trace ARCH-000014
 * @shape Manifest、配置、Pathおよび公開状態を含まない三Propertyの値契約。
 * @invariant Property集合はalgorithm、keyId、signatureと完全一致する。
 * @boundary Artifact Signing→署名結果Consumerの値境界。
 * @security 秘密値と秘密鍵参照を保持しない。
 * @compatibility 利用側はこの三Property以外をArtifact Signingへ要求しない。
 */
export type ArtifactSignatureResult = Readonly<{
  algorithm: "Ed25519";
  keyId: string;
  signature: string;
}>;

/**
 * Artifact Signingの署名結果を閉じたSchemaとして検証する。
 *
 * @responsibility Manifest、配置、Pathまたは公開fieldを署名結果へ混入させない。
 * @trace ARCH-000014
 * @input 検証対象の未知値。
 * @returns 正常なArtifactSignatureResult。
 * @precondition 呼出し側は外部境界から受け取った値を意味付けせず渡す。
 * @postcondition 完全一致する三Propertyだけを凍結した新しい値として返す。
 * @effect N/A: 入力値の検証と複製だけを行う。
 * @failure 欠落、余剰、不正Algorithm、不正Key IDまたは不正Signatureを拒否する。
 * @invariant Manifest生成、Filesystem配置および公開判断を発行しない。
 * @boundary Artifact Signing→署名結果Consumerの値境界。
 * @security Secret、Pathおよび公開状態を結果へ通過させない。
 * @concurrency N/A: 共有状態を持たない同期検証である。
 */
export function validateArtifactSignatureResult(
  value: unknown,
): ArtifactSignatureResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("artifact_signing_signature_result_invalid");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const expectedKeys = [...ARTIFACT_SIGNATURE_RESULT_KEYS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("artifact_signing_signature_result_invalid");
  }
  for (const descriptor of Object.values(descriptors)) {
    if (!("value" in descriptor) || descriptor.get || descriptor.set) {
      throw new Error("artifact_signing_signature_result_invalid");
    }
  }
  const record = value as Record<string, unknown>;
  if (
    record.algorithm !== "Ed25519" ||
    typeof record.keyId !== "string" ||
    !/^[0-9a-f]{64}$/u.test(record.keyId) ||
    typeof record.signature !== "string" ||
    !/^[A-Za-z0-9_-]{86}$/u.test(record.signature)
  ) {
    throw new Error("artifact_signing_signature_result_invalid");
  }
  return Object.freeze({
    algorithm: "Ed25519" as const,
    keyId: record.keyId,
    signature: record.signature,
  });
}
