/**
 * 現在ProcessのPlatformと、指定PIDの生存を読取り観測する。
 * @responsibility OS観測だけを所有し、Lease世代・対応保証・回復可否を判断しない。
 * @trace ARCH-000004
 */

/**
 * PIDの存在と観測不能を区別する。
 * @responsibility Signal 0による生存観測とOS失敗分類を所有する。
 * @trace ARCH-000004
 * @input processId: 観測対象PID。
 * @returns alive、absent、unknownのいずれか。
 * @precondition 呼出し元が対象PIDと上位のOwner情報を結合する。
 * @postcondition ESRCHだけをabsentとし、権限不足をunknownへ残す。
 * @effect Signal 0によるOS観測。Processの終了要求は発行しない。
 * @failure 不正PID、EPERMその他の観測失敗はunknown。
 * @invariant PID存在を同じProcess世代の証明にしない。
 * @boundary Node Process APIとOSの境界。
 * @security 観測値は処置・回復のAuthorityを発行しない。
 * @concurrency 同期観測。返却後の生存継続を保証しない。
 */
export function observeProcessLiveness(
  processId: unknown,
): "alive" | "absent" | "unknown" {
  if (!Number.isSafeInteger(processId) || Number(processId) < 1)
    return "unknown";
  try {
    process.kill(Number(processId), 0);
    return "alive";
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    return code === "ESRCH" ? "absent" : "unknown";
  }
}

/**
 * 現在対応しているPlatform familyを観測する。
 * @responsibility OS識別と非対応時の閉じた結果を所有する。
 * @trace ARCH-000004
 * @input なし。
 * @returns Windowsの観測値、またはplatform_identity_unknown。
 * @precondition 呼出し元が用途ごとの必要保証を別に評価する。
 * @postcondition 非対応OSをWindowsへfallbackしない。
 * @effect 現在ProcessのPlatform値を読む。
 * @failure 未対応Platformはblocked。
 * @invariant 観測成功は上位の全保証成立を意味しない。
 * @boundary Node RuntimeのPlatform識別境界。
 * @security 観測だけから実行Authorityを発行しない。
 * @concurrency 同期観測。共有状態は変更しない。
 */
export function observePlatformFamily():
  | Readonly<{ status: "observed"; platformFamily: string }>
  | Readonly<{ status: "blocked"; reason: "platform_identity_unknown" }> {
  if (process.platform === "win32")
    return Object.freeze({
      status: "observed" as const,
      platformFamily: "windows",
    });
  return Object.freeze({
    status: "blocked" as const,
    reason: "platform_identity_unknown" as const,
  });
}
