/**
 * Host観測が返したProcess環境を実行前に固定する。
 *
 * @responsibility getterや後発変更を最終照合後に評価しないsnapshotを所有する。
 * @trace ARCH-000008
 */
import { types as utilTypes } from "node:util";

/**
 * Host観測が返した環境を固定した文字列mapへ取込む。
 *
 * @responsibility 最終CLI／config照合の後にgetterや後発変更を評価しない。
 * @trace ARCH-000008
 * @input value: 既存Ownerの環境観測値。
 * @returns own string fieldだけを持つ凍結snapshot。
 * @precondition 観測callbackは実行物や環境の許可を独立に所有しない。
 * @postcondition 元Objectの変更をspawn環境へ搬送しない。
 * @effect N/A: 入力値を取込むだけで外部処置を発行しない。
 * @failure Proxy、非plain、getter、symbol、非文字列、NUL、空名／equals名は拒否する。
 * @invariant 拒否時に親ambient環境へfallbackしない。
 * @boundary Host環境観測値と固定Process構成の間。
 * @security Secret探索や環境値のログ記録を行わない。
 * @concurrency 同期snapshot後にCLIとconfigをfresh照合する。
 */
export function captureDockerProcessEnvironment(value: unknown) {
  if (
    value === null ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new Error("docker_recovery_environment_unavailable");
  const result: Record<string, string> = Object.create(null);
  for (const name of Reflect.ownKeys(value)) {
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      name.includes("=") ||
      name.includes("\0")
    )
      throw new Error("docker_recovery_environment_unavailable");
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (
      !descriptor ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      descriptor.value.includes("\0")
    )
      throw new Error("docker_recovery_environment_unavailable");
    result[name] = descriptor.value;
  }
  return Object.freeze(result);
}
