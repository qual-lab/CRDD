/**
 * Docker DesktopのRuntime Directoryに対する安定したロック観測。
 * @packageDocumentation
 * @responsibility 親実体・有界entry集合・既知のアクセス拒否を前後照合する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { disposeDockerRepairDirectory } from "./repair-directory-disposal.ts";

/**
 * 修復によるDirectory退避の発行・確認状態。
 * @responsibility 物理退避と記録保存・修復完了を区別する。
 * @trace ARCH-000008
 * @shape 発行はtrue／false／null、確認と保持状態は独立する。
 * @invariant 不明を未発行または不存在へ丸めない。
 * @boundary Runtime Directoryの技術観測。
 * @security Pathや操作Authorityを結果へ含めない。
 * @compatibility 既存修復ledgerの値と構造を維持する。
 */
type RepairDirectoryRetention = Readonly<{
  issued: boolean | null;
  confirmation: "not_issued" | "confirmed" | "unknown";
  staleState: "retained" | "unknown";
}>;

/**
 * 修復用LocalAppDataの字句条件を既存Windows Root契約へ揃える。
 * @responsibility OSが別解釈する文字列をFilesystem観測の前に拒否する。
 * @trace ARCH-000008
 * @input value: 修復Ownerが渡すLocalAppData候補。
 * @returns 字句条件と修復用途の非Root条件を満たす場合だけtrue。
 * @precondition 実体・Rootの真正性・排他・処置許可は別のOwner確認である。
 * @postcondition 文字列の正規化や補完で受理集合を拡大しない。
 * @effect N/A: 文字列検査だけ。
 * @failure 不正UTF-16・4096bytes超・禁止文字・予約名・曖昧segmentはfalse。
 * @invariant 字句一致を実Filesystem安全性やAuthorityと同一視しない。
 * @boundary 内部修復入力とFilesystem前の値検査。
 * @security 上位Moduleをimportせず、公開の汎用Path APIを追加しない。
 * @concurrency N/A: 共有状態を扱わない同期処理。
 */
function isRepairLocalAppDataPath(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    /[\uD800-\uDFFF]/u.test(value) ||
    Buffer.byteLength(value, "utf8") > 4096 ||
    /[\u0000-\u001f\u007f]/u.test(value) ||
    !/^[A-Z]:\\/u.test(value) ||
    value.includes("/") ||
    path.win32.normalize(value) !== value ||
    value === path.win32.parse(value).root ||
    value.endsWith("\\")
  )
    return false;
  const special: Record<string, string> = {
    ß: "SS",
    ı: "I",
    ſ: "S",
    K: "K",
    ﬀ: "FF",
    ﬁ: "FI",
    ﬂ: "FL",
    ﬃ: "FFI",
    ﬄ: "FFL",
    ﬅ: "ST",
    ﬆ: "ST",
  };
  return value
    .slice(3)
    .split("\\")
    .every((segment) => {
      if (
        !segment ||
        segment === "." ||
        segment === ".." ||
        /[<>:"|?*]/u.test(segment) ||
        /[. ]$/u.test(segment)
      )
        return false;
      const candidate = segment.split(".", 1)[0];
      if (candidate === undefined) return false;
      const basename = Array.from(
        candidate.replace(/[. ]+$/u, ""),
        (character) => {
          const code = character.codePointAt(0);
          return code !== undefined && code >= 0x61 && code <= 0x7a
            ? String.fromCodePoint(code - 0x20)
            : (special[character] ?? character);
        },
      ).join("");
      return !/^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9\u00b9\u00b2\u00b3]|LPT[1-9\u00b9\u00b2\u00b3])$/u.test(
        basename,
      );
    });
}

/**
 * 任意Pathではなく固定修復用途から退避対象を導出する。
 * @responsibility localAppData・操作ID・Identityを一回捕捉し、固定直下だけを選ぶ。
 * @trace ARCH-000008
 * @input localAppData、operationId、expectedIdentity、purpose: 修復Ownerの固定値。
 * @returns 固定source／targetと捕捉済みIdentity、またはnull。
 * @precondition 意図保存・排他・実効Rootの確認は上位Ownerが保持する。
 * @postcondition Proxy／Accessorを実行せず、任意basenameや別親へ移動しない。
 * @effect N/A: 値の検査・固定Path導出のみ。
 * @failure 非Windows、不正文法、余分keyや不正Identityはnull。
 * @invariant 捕捉したIdentity自体は処置許可を発行しない。
 * @boundary 内部修復入力と固定Filesystem対象。
 * @security Root公開APIへ追加せず、上位記録・署名型へ依存しない。
 * @concurrency 値を捕捉後に実Filesystemを別途前後確認する。
 */
function repairDirectoryTargets(
  localAppData: unknown,
  operationId: unknown,
  expectedIdentity: unknown,
  purpose: "initial_run" | "failed_launch_run" | "secrets_engine",
) {
  const paths = repairDirectoryPaths(localAppData, operationId, purpose);
  const identity = paths
    ? captureRepairDirectoryIdentity(expectedIdentity)
    : null;
  return paths && identity ? Object.freeze({ ...paths, identity }) : null;
}

/**
 * 退避対象の期待実体をown dataから捕捉する。
 * @responsibility 既存退避とScope固定退避で同じ入力検査を使う。
 * @trace ARCH-000008
 * @input expectedIdentity: 三値の実体候補。
 * @returns 凍結実体、またはnull。
 * @precondition 実観測と処置許可は別途確認。
 * @postcondition getter・Proxyを実行しない。
 * @effect N/A: 値検査のみ。
 * @failure 余剰・欠落・非整数はnull。
 * @invariant 数値精度を丸めない。
 * @boundary checkpointとFilesystem処置。
 * @security 任意propertyを引き継がない。
 * @concurrency N/A: 同期捕捉。
 */
function captureRepairDirectoryIdentity(expectedIdentity: unknown) {
  if (
    !expectedIdentity ||
    typeof expectedIdentity !== "object" ||
    utilTypes.isProxy(expectedIdentity)
  )
    return null;
  const descriptors = Object.getOwnPropertyDescriptors(expectedIdentity);
  const keys = Object.keys(descriptors).sort();
  if (
    keys.join(",") !== "birthtimeNs,dev,ino" ||
    Reflect.ownKeys(expectedIdentity).length !== 3
  )
    return null;
  const values: Record<string, string> = {};
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !/^[1-9][0-9]*$/u.test(descriptor.value)
    )
      return null;
    values[key] = descriptor.value;
  }
  return Object.freeze({
    dev: values.dev as string,
    ino: values.ino as string,
    birthtimeNs: values.birthtimeNs as string,
  });
}

/**
 * 三つの固定修復用途から同じ親の対象Pathを導出する。
 * @responsibility Scopeと既存退避処理の対象名を一つの規則に揃える。
 * @trace ARCH-000008
 * @input localAppData: 検証したOS所在、operationId: 下位32桁ID、purpose: 固定用途。
 * @returns 凍結したsource／target／parent、またはnull。
 * @precondition 実体と処置許可は別途確認する。
 * @postcondition 任意basename、任意親、任意Pathを受けない。
 * @effect N/A: 純粋なPath導出のみ。
 * @failure 未対応OS、不正Path／ID／用途はnull。
 * @invariant Path一致を操作Authorityにしない。
 * @boundary DI内部のScopeとFilesystem Adapter。
 * @security Rootへ公開しない。
 * @concurrency N/A: 共有状態なし。
 */
function repairDirectoryPaths(
  localAppData: unknown,
  operationId: unknown,
  purpose: "initial_run" | "failed_launch_run" | "secrets_engine",
) {
  if (
    process.platform !== "win32" ||
    !isRepairLocalAppDataPath(localAppData) ||
    typeof operationId !== "string" ||
    !/^[a-f0-9]{32}$/u.test(operationId) ||
    !["initial_run", "failed_launch_run", "secrets_engine"].includes(purpose)
  )
    return null;
  const parent =
    purpose === "secrets_engine"
      ? localAppData
      : path.win32.join(localAppData, "Docker");
  const basename =
    purpose === "secrets_engine" ? "docker-secrets-engine" : "run";
  const source = path.win32.join(parent, basename);
  const target = path.win32.join(
    parent,
    `${basename}.crdd-stale-${operationId}${purpose === "failed_launch_run" ? "-restart" : ""}`,
  );
  return Object.freeze({
    source,
    target,
    parent,
  });
}

/**
 * 固定domainとUTF-8 byte長付きpayloadをHash化する。
 * @responsibility 曖昧な文字列連結や文字数による長さ判定を避ける。
 * @trace ARCH-000008
 * @input domain: 内部固定domain、payload: 内部構成したplain primitive値。
 * @returns 小文字SHA-256。
 * @precondition payloadは未信頼Objectを直接含めない。
 * @postcondition JSON field順と実byte長をHashへ結合する。
 * @effect N/A: メモリ内計算のみ。
 * @failure JSON化不能／長さ超過は呼出し側へ例外を返す。
 * @invariant HashはAuthorityではない。
 * @boundary 非秘密の内部相関材料。
 * @security payloadやPathをログへ出さない。
 * @concurrency N/A: 共有状態なし。
 */
function hashRepairScopeValue(domain: string, payload: unknown): string {
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(bytes.length);
  return createHash("sha256")
    .update(domain, "ascii")
    .update(Buffer.from([0]))
    .update(length)
    .update(bytes)
    .digest("hex");
}

/**
 * 安定したKnownFolder実体と固定Pathへ修復Scopeを結合する。
 * @responsibility 可変run世代を操作全体Scopeへ混入させない。
 * @trace ARCH-000008
 * @input localAppData: OS観測済み所在、operationNonce: 64hex、ownerBindingSha256: 実H、artifactSha256: 固定実行物。
 * @returns Scope Hash、下位Directory ID、canonical Localと同一の凍結targets、またはnull。
 * @precondition 本番runtimeが同じ取得結果のH／ArtifactとKnownFolderを渡す。
 * @postcondition Local以外の可変DirectoryをScope生成で観測・作成しない。
 * @effect Localのlstat／realpath前後観測だけ。
 * @failure 入力不正、link、Path差、実体差、観測不能はnull。
 * @invariant Scope Hashだけで所有・Root・Revision・現在許可を推定しない。
 * @boundary DI内部runtimeの準備と技術Adapter。
 * @security 生PathをRoot APIへ返さず、任意Rootの処置能力を発行しない。
 * @concurrency 同じ安定Localを再観測し、可変対象は各actionで別照合する。
 */
export function observeDockerDesktopRepairScope(
  localAppData: unknown,
  operationNonce: unknown,
  ownerBindingSha256: unknown,
  artifactSha256: unknown,
) {
  if (
    process.platform !== "win32" ||
    !isRepairLocalAppDataPath(localAppData) ||
    [operationNonce, ownerBindingSha256, artifactSha256].some(
      (value) => typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value),
    )
  )
    return null;
  try {
    const before = directoryIdentity(
      fs.lstatSync(localAppData, { bigint: true }),
    );
    if (!before) return null;
    const canonicalLocal = fs.realpathSync
      .native(localAppData)
      .replace(/^\\\\\?\\/u, "");
    if (
      !isRepairLocalAppDataPath(canonicalLocal) ||
      canonicalLocal.toLocaleLowerCase("en-US") !==
        localAppData.toLocaleLowerCase("en-US")
    )
      return null;
    const after = directoryIdentity(
      fs.lstatSync(canonicalLocal, { bigint: true }),
    );
    if (!after || !sameDirectoryIdentity(before, after)) return null;
    const directoryId = hashRepairScopeValue(
      "crdd/docker-desktop-repair-directory/v1",
      {
        operationNonce,
      },
    ).slice(0, 32);
    const initial = repairDirectoryPaths(
      canonicalLocal,
      directoryId,
      "initial_run",
    );
    const failed = repairDirectoryPaths(
      canonicalLocal,
      directoryId,
      "failed_launch_run",
    );
    const auxiliary = repairDirectoryPaths(
      canonicalLocal,
      directoryId,
      "secrets_engine",
    );
    if (!initial || !failed || !auxiliary) return null;
    const targets = Object.freeze({ initial, failed, auxiliary });
    const scopeSha256 = hashRepairScopeValue(
      "crdd/docker-desktop-repair-scope/v1",
      {
        protocol: "CRDDDR06",
        operationNonce,
        ownerBindingSha256,
        artifactSha256,
        localAppData: Object.freeze({ path: canonicalLocal, identity: after }),
        targets,
      },
    );
    return Object.freeze({
      scopeSha256,
      directoryId,
      localAppData: canonicalLocal,
      targets,
    });
  } catch {
    return null;
  }
}

/**
 * 一度捕捉したScope対象へDirectory操作を固定する。
 * @responsibility 相関した同じtargetsを観測・lock確認・退避に使う。
 * @trace ARCH-000008
 * @input localAppData、operationNonce、ownerBindingSha256、artifactSha256: 同取得の準備材料。
 * @returns Scope相関と三用途固定操作、またはnull。
 * @precondition Native生存と現在Ownerは呼出し側が各Effect前に確認する。
 * @postcondition 可変Docker親を全体Scopeへ固定しない。
 * @effect Local親のScope観測。返却処理は固定Filesystem操作だけ。
 * @failure Scope不成立はnull、各操作の不明はunknown。
 * @invariant 保存・再起動・任意Path操作を所有せず、回収は固定旧targetだけに限定する。
 * @boundary DI内部の実技術Adapter。Root非公開。
 * @security 生Pathを操作結果へ返さない。
 * @concurrency Scopeをfresh照合しても処置対象は元targetsのまま。
 */
export function createDockerDesktopRepairDirectoryAccess(
  localAppData: unknown,
  operationNonce: unknown,
  ownerBindingSha256: unknown,
  artifactSha256: unknown,
) {
  const scope = observeDockerDesktopRepairScope(
    localAppData,
    operationNonce,
    ownerBindingSha256,
    artifactSha256,
  );
  if (!scope) return null;
  /**
   * 安定Local親の現在相関を再照合する。
   * @responsibility 親の差替え後に処置しない。
   * @trace ARCH-000008
   * @input N/A: 同取得の材料だけ。
   * @returns Scope一致時だけtrue。
   * @precondition 初回Scope捕捉済み。
   * @postcondition 元targetsを置換しない。
   * @effect Local親の読取りのみ。
   * @failure 観測不能・実体差はfalse。
   * @invariant Hash一致をAuthorityへ昇格しない。
   * @boundary 安定親と固定操作。
   * @security Pathを返さない。
   * @concurrency 操作ごとにfresh確認。
   */
  const verify = () =>
    observeDockerDesktopRepairScope(
      scope.localAppData,
      operationNonce,
      ownerBindingSha256,
      artifactSha256,
    )?.scopeSha256 === scope.scopeSha256;
  /**
   * 固定用途の元と退避先を読取り観測する。
   * @responsibility 不存在と観測不能を分離する。
   * @trace ARCH-000008
   * @input purpose: 初回・失敗起動・補助領域。
   * @returns 元と退避先の技術観測、またはnull。
   * @precondition Scopeが現在一致する。
   * @postcondition 任意Pathを探索しない。
   * @effect 同じtargetsのlstatだけ。
   * @failure 不正用途・Scope差はnull。
   * @invariant 観測から退避許可を作らない。
   * @boundary 固定対象と実Filesystem。
   * @security 生Pathなし。
   * @concurrency 元・先を独立観測する。
   */
  const observe = (purpose: "initial" | "failed" | "auxiliary") => {
    if (!["initial", "failed", "auxiliary"].includes(purpose) || !verify())
      return null;
    const targets = scope.targets[purpose];
    return Object.freeze({
      source: Object.freeze(observeRepairDirectory(targets.source)),
      retained: Object.freeze(observeRepairDirectory(targets.target)),
    });
  };
  /**
   * 同じ固定元の既知lockを観測する。
   * @responsibility lock不明を解放済みにしない。
   * @trace ARCH-000008
   * @input purpose: 固定三用途。
   * @returns lock実体またはnull。
   * @precondition Scope現在一致。
   * @postcondition 別対象へfallbackしない。
   * @effect 固定元の有界open／close観測。
   * @failure 不正用途・不明はnull。
   * @invariant nullは不存在ではない。
   * @boundary 固定Runtime領域とlock観測。
   * @security Pathを入力公開しない。
   * @concurrency 既存の前後実体照合を維持。
   */
  const lock = (purpose: "initial" | "failed" | "auxiliary") => {
    if (!["initial", "failed", "auxiliary"].includes(purpose) || !verify())
      return null;
    return observeDockerRuntimeDirectoryLock(scope.targets[purpose].source);
  };
  /**
   * 捕捉した同じtargetsだけを退避する。
   * @responsibility 親・元・先の直前直後検査を維持する。
   * @trace ARCH-000008
   * @input purpose: 固定用途、expected: 保存Ownerに結合した実体。
   * @returns 発行・確認・保持状態。
   * @precondition 意図保存とNative／現在許可は別途確認済み。
   * @postcondition 元・先を削除せず先既存を上書きしない。
   * @effect 同じ固定targets間のrename一回。
   * @failure 不正入力・Scope差・既存不明はunknown。
   * @invariant 初回と継続の既存退避先分類を維持する。
   * @boundary DI内部の退避実処理。
   * @security 任意Pathと任意basenameを受けない。
   * @concurrency 親差替え・処置後不明を成功にしない。
   */
  const retain = (
    purpose: "initial" | "failed" | "auxiliary",
    expected: unknown,
  ): RepairDirectoryRetention => {
    const identity = captureRepairDirectoryIdentity(expected);
    if (
      !["initial", "failed", "auxiliary"].includes(purpose) ||
      !identity ||
      !verify()
    )
      return Object.freeze({
        issued: null,
        confirmation: "unknown",
        staleState: "unknown",
      });
    return retainRepairDirectory(
      Object.freeze({ ...scope.targets[purpose], identity }),
      purpose === "initial",
    );
  };
  /**
   * 同じScopeの固定旧targetだけを有界回収へ渡す。
   * @responsibility 任意Path・別用途・不正実体・現在許可不明の要求を拒否する。
   * @trace ARCH-000008
   * @input purpose: 三用途、expected: 元checkpoint実体またはnull、canIssue: 現在Owner確認。
   * @returns 今回の要求到達と現在不存在。
   * @precondition 上位が保存済み回収意図と旧OwnerのEffect不能を共同確認する。
   * @postcondition Root APIへPathや依存差替えを公開しない。
   * @effect 固定対象の読取りと条件成立時だけ有界回収。
   * @failure 不正値・Scope／Owner不明は要求0・absence unknown。
   * @invariant 元checkpointや現在sourceを変更しない。
   * @boundary DI内部の固定factoryと実回収Driver。
   * @security 任意Host Rootや別basenameを受け取らない。
   * @concurrency Driver内でも同じScopeと現在許可をfresh確認する。
   */
  const dispose = async (
    purpose: "initial" | "failed" | "auxiliary",
    expected: unknown,
    canIssue: () => unknown,
  ) => {
    const identity =
      expected === null ? null : captureRepairDirectoryIdentity(expected);
    if (
      !["initial", "failed", "auxiliary"].includes(purpose) ||
      (expected !== null && !identity) ||
      typeof canIssue !== "function" ||
      utilTypes.isProxy(canIssue)
    )
      return Object.freeze({
        request: "not_issued" as const,
        absence: "unknown" as const,
      });
    return disposeDockerRepairDirectory(scope.targets[purpose], identity, () =>
      verify() ? canIssue() : false,
    );
  };
  return Object.freeze({
    scopeSha256: scope.scopeSha256,
    verify,
    observe,
    lock,
    retain,
    dispose,
  });
}

/**
 * Directory実体または明示不存在だけを分類する。
 * @responsibility 読取不明・link・fileを不存在と区別する。
 * @trace ARCH-000008
 * @input target: 下位で導出した固定Path。
 * @returns 実体識別値、明示不存在またはunknown。
 * @precondition 対象は呼出し側が固定する。
 * @postcondition ENOENT以外の例外はunknownとなる。
 * @effect lstatのみ。
 * @failure 観測不能はunknown。
 * @invariant 名前だけから実体一致を推定しない。
 * @boundary 固定PathとFilesystem。
 * @security 再帰探索・削除を行わない。
 * @concurrency 前後で独立に観測する。
 */
function observeRepairDirectory(target: string) {
  try {
    const identity = directoryIdentity(fs.lstatSync(target, { bigint: true }));
    return { state: identity ? "present" : "unknown", identity } as const;
  } catch (error) {
    return {
      state:
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
          ? "confirmed_absent"
          : "unknown",
      identity: null,
    } as const;
  }
}

/**
 * 初回とContinuationの異なる保持判定を維持して固定Directoryを退避する。
 * @responsibility 同一実体・退避先未使用を処置直前に再確認し、処置後の両観測を返す。
 * @trace ARCH-000008
 * @input targets: 捕捉済み固定対象、initialRun: 初回退避の分類を使うか。
 * @returns 既存ledgerと同じ退避観測。
 * @precondition 上位が意図保存・排他・直前境界・取消を確認済み。
 * @postcondition 退避先の存在を上書きせず、元も退避先も削除しない。
 * @effect 固定対象間のrename一回だけ。
 * @failure 事前不明・差替え・rename例外・事後不明はunknown。
 * @invariant 失敗を冪等成功へ変換しない。
 * @boundary 修復専用PathとFilesystem。
 * @security 同じ利用者による敵対的差替えの原子的排除は保証しない。
 * @concurrency 親と元実体・退避先不存在を直前に再観測する。
 */
function retainRepairDirectory(
  targets: ReturnType<typeof repairDirectoryTargets>,
  initialRun: boolean,
): RepairDirectoryRetention {
  const unknown = Object.freeze({
    issued: null,
    confirmation: "unknown",
    staleState: "unknown",
  } as const);
  if (!targets) return unknown;
  try {
    const before = observeRepairDirectory(targets.source);
    if (
      initialRun &&
      (before.state !== "present" ||
        !before.identity ||
        !sameDirectoryIdentity(before.identity, targets.identity))
    )
      return unknown;
    const stale = observeRepairDirectory(targets.target);
    if (
      before.state !== "present" ||
      !before.identity ||
      !sameDirectoryIdentity(before.identity, targets.identity) ||
      stale.state !== "confirmed_absent"
    ) {
      return Object.freeze({
        issued: stale.state === "present" ? false : null,
        confirmation: stale.state === "present" ? "not_issued" : "unknown",
        staleState:
          initialRun &&
          stale.identity &&
          sameDirectoryIdentity(stale.identity, targets.identity)
            ? "retained"
            : "unknown",
      });
    }
    const parent = observeRepairDirectory(targets.parent);
    const fresh = observeRepairDirectory(targets.source);
    const freshTarget = observeRepairDirectory(targets.target);
    if (
      !parent.identity ||
      fresh.state !== "present" ||
      !fresh.identity ||
      !sameDirectoryIdentity(fresh.identity, targets.identity) ||
      freshTarget.state !== "confirmed_absent"
    )
      return unknown;
    const parentAgain = observeRepairDirectory(targets.parent);
    if (
      !parentAgain.identity ||
      !sameDirectoryIdentity(parent.identity, parentAgain.identity)
    )
      return unknown;
    fs.renameSync(targets.source, targets.target);
    const after = observeRepairDirectory(targets.target);
    const original = observeRepairDirectory(targets.source);
    const parentAfter = observeRepairDirectory(targets.parent);
    const confirmed =
      after.state === "present" &&
      after.identity !== null &&
      sameDirectoryIdentity(after.identity, targets.identity) &&
      original.state === "confirmed_absent" &&
      parentAfter.identity !== null &&
      sameDirectoryIdentity(parent.identity, parentAfter.identity);
    return Object.freeze({
      issued: true,
      confirmation: confirmed ? "confirmed" : "unknown",
      staleState: confirmed ? "retained" : "unknown",
    });
  } catch {
    return unknown;
  }
}

/**
 * 初回Docker run Directoryを固定名へ退避する。
 * @responsibility 任意Pathを受けず、同一退避先既存時だけ未発行retainedを維持する。
 * @trace ARCH-000008
 * @input localAppData、operationId、expectedIdentity: 修復Ownerの固定値。
 * @returns 発行・確認・保持の観測。
 * @precondition 上位の意図保存・実効排他・取消確認が成立している。
 * @postcondition 保持物を削除せず、修復完了を返さない。
 * @effect 固定runから同親の固定退避名へのrenameのみ。
 * @failure 不正入力・観測不明はunknown。
 * @invariant 元不存在を既退避成功へ昇格しない。
 * @boundary 内部修復compositionとDirectory操作。
 * @security 公開Rootからは提供しない用途限定処理。
 * @concurrency 直前・直後の実体を照合する。
 */
export function retainDockerDesktopRepairRunDirectory(
  localAppData: unknown,
  operationId: unknown,
  expectedIdentity: unknown,
): RepairDirectoryRetention {
  return retainRepairDirectory(
    repairDirectoryTargets(
      localAppData,
      operationId,
      expectedIdentity,
      "initial_run",
    ),
    true,
  );
}

/**
 * 失敗起動後のrunまたはSecrets Engineを固定名へ退避する。
 * @responsibility 閉じた二用途を固定Pathへ変換し、初回の既退避分類を流用しない。
 * @trace ARCH-000008
 * @input localAppData、operationId、purpose、expectedIdentity: 同じ修復の固定入力。
 * @returns 発行・確認・保持の観測。
 * @precondition 上位が同じ修復の先行退避と意図保存・境界・取消を確認している。
 * @postcondition 退避先既存は同一実体でもunknownのまま返す。
 * @effect 固定二用途のうち一Directoryのrenameのみ。
 * @failure 用途外・不正入力・観測不明はunknown。
 * @invariant 別操作の退避物を採用・削除しない。
 * @boundary 内部修復compositionとDirectory操作。
 * @security 任意source／target・削除を提供しない。
 * @concurrency 前後実体を照合し、保存は上位Ownerに委ねる。
 */
export function retainDockerDesktopRepairContinuationDirectory(
  localAppData: unknown,
  operationId: unknown,
  purpose: "failed_launch_run" | "secrets_engine",
  expectedIdentity: unknown,
): RepairDirectoryRetention {
  if (purpose !== "failed_launch_run" && purpose !== "secrets_engine")
    return Object.freeze({
      issued: null,
      confirmation: "unknown",
      staleState: "unknown",
    });
  return retainRepairDirectory(
    repairDirectoryTargets(
      localAppData,
      operationId,
      expectedIdentity,
      purpose,
    ),
    false,
  );
}
const knownSocketErrorCodes = Object.freeze(
  new Set(["EACCES", "EBUSY", "EPERM"]),
);
const MAXIMUM_RUNTIME_DIRECTORY_ENTRIES = 64;
/**
 * Docker Runtime Directoryの実体識別子。
 * @responsibility Directoryの前後の実体を比較する最小値を定義する。
 * @trace ARCH-000008
 * @shape dev・ino・birthtimeNsは実lstatから得た正の十進文字列。
 * @invariant 識別子自体を操作許可として扱わない。
 * @boundary ファイルシステムの観測値。
 * @security 秘密値・Authorityを含まない。
 * @compatibility 上位記録の識別値と構造的に一致する。
 */
type DockerRuntimeDirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * directoryIdentityを決定する。
 *
 * @responsibility directoryIdentityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input metadata: fs.BigIntStats
 * @returns DockerRuntimeDirectoryIdentity | nullを返す。
 * @precondition 「metadata: fs.BigIntStats」がdirectoryIdentityの入力契約を満たす。
 * @postcondition directoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: directoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: directoryIdentityは独自の失敗分岐を所有しない。
 * @invariant directoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: directoryIdentityはProcess内の同一Subsystemで完結する。
 * @security directoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: directoryIdentityは共有非同期状態を持たない同期処理である。
 */
function directoryIdentity(
  metadata: fs.BigIntStats,
): DockerRuntimeDirectoryIdentity | null {
  return metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    metadata.dev > 0n &&
    metadata.ino > 0n &&
    metadata.birthtimeNs > 0n
    ? Object.freeze({
        dev: String(metadata.dev),
        ino: String(metadata.ino),
        birthtimeNs: String(metadata.birthtimeNs),
      })
    : null;
}

/**
 * Identityが同一かを判定する。
 *
 * @responsibility Identityの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input left: DockerRuntimeDirectoryIdentity、right: DockerRuntimeDirectoryIdentity
 * @returns sameDirectoryIdentityの計算結果を返す。
 * @precondition 「left: DockerRuntimeDirectoryIdentity、right: DockerRuntimeDirectoryIdentity」がsameDirectoryIdentityの入力契約を満たす。
 * @postcondition sameDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameDirectoryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameDirectoryIdentityは独自の失敗分岐を所有しない。
 * @invariant sameDirectoryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameDirectoryIdentityはProcess内の同一Subsystemで完結する。
 * @security sameDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function sameDirectoryIdentity(
  left: DockerRuntimeDirectoryIdentity,
  right: DockerRuntimeDirectoryIdentity,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * docker-desktop-runtime-repairで使用するRuntime Directory Entry Observationの値契約を定義する。
 *
 * @responsibility Runtime Directory Entry ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDirectoryEntryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDirectoryEntryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDirectoryEntryObservationの宣言は外部境界を開かない。
 * @security RuntimeDirectoryEntryObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDirectoryEntryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDirectoryEntryObservation = Readonly<{
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
}>;

/**
 * docker-desktop-runtime-repairで使用するRuntime Directory Lock Observation Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime Directory Lock Observation DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDirectoryLockObservationDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDirectoryLockObservationDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDirectoryLockObservationDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDirectoryLockObservationDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDirectoryLockObservationDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDirectoryLockObservationDependencies = Readonly<{
  identityAt: (target: string) => DockerRuntimeDirectoryIdentity | null;
  readEntries: (
    directory: string,
  ) => readonly RuntimeDirectoryEntryObservation[];
  probeEntry: (target: string) => void;
}>;

/**
 * Runtime Directory Entriesが同一かを判定する。
 *
 * @responsibility Runtime Directory Entriesの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000008
 * @input beforeEntries: readonly RuntimeDirectoryEntryObservation[]、afterEntries: readonly RuntimeDirectoryEntryObservation[]
 * @returns sameRuntimeDirectoryEntriesの計算結果を返す。
 * @precondition 「beforeEntries: readonly RuntimeDirectoryEntryObservation[]、afterEntries: readonly RuntimeDirectoryEntryObservation[]」がsameRuntimeDirectoryEntriesの入力契約を満たす。
 * @postcondition sameRuntimeDirectoryEntriesの責務を完了した結果だけを返す。
 * @effect N/A: sameRuntimeDirectoryEntriesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRuntimeDirectoryEntriesは独自の失敗分岐を所有しない。
 * @invariant sameRuntimeDirectoryEntriesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameRuntimeDirectoryEntriesはProcess内の同一Subsystemで完結する。
 * @security sameRuntimeDirectoryEntriesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRuntimeDirectoryEntriesは共有非同期状態を持たない同期処理である。
 */
function sameRuntimeDirectoryEntries(
  beforeEntries: readonly RuntimeDirectoryEntryObservation[],
  afterEntries: readonly RuntimeDirectoryEntryObservation[],
) {
  if (beforeEntries.length !== afterEntries.length) return false;
  return beforeEntries.every(
    (entry, index) =>
      entry.name === afterEntries[index]?.name &&
      entry.isDirectory === afterEntries[index]?.isDirectory &&
      entry.isSymbolicLink === afterEntries[index]?.isSymbolicLink,
  );
}

/**
 * Runtime Directory Entryが有効か判定する。
 *
 * @responsibility Runtime Directory Entryの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input entry: RuntimeDirectoryEntryObservation
 * @returns validRuntimeDirectoryEntryの計算結果を返す。
 * @precondition 「entry: RuntimeDirectoryEntryObservation」がvalidRuntimeDirectoryEntryの入力契約を満たす。
 * @postcondition validRuntimeDirectoryEntryの責務を完了した結果だけを返す。
 * @effect N/A: validRuntimeDirectoryEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRuntimeDirectoryEntryは独自の失敗分岐を所有しない。
 * @invariant validRuntimeDirectoryEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRuntimeDirectoryEntryはProcess内の同一Subsystemで完結する。
 * @security validRuntimeDirectoryEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRuntimeDirectoryEntryは共有非同期状態を持たない同期処理である。
 */
function validRuntimeDirectoryEntry(entry: RuntimeDirectoryEntryObservation) {
  return (
    entry.name.length > 0 &&
    entry.name.length <= 255 &&
    entry.name !== "." &&
    entry.name !== ".." &&
    !entry.name.includes("/") &&
    !entry.name.includes("\\") &&
    !entry.isDirectory
  );
}

/**
 * Docker Desktop Runtime Directory Lock Using Dependenciesを観測する。
 *
 * @responsibility Docker Desktop Runtime Directory Lock Using Dependenciesの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、dependencies: RuntimeDirectoryLockObservationDependencies
 * @returns observeDockerRuntimeDirectoryLockUsingDependenciesの計算結果を返す。
 * @precondition 「directory: string、dependencies: RuntimeDirectoryLockObservationDependencies」がobserveDockerRuntimeDirectoryLockUsingDependenciesの入力契約を満たす。
 * @postcondition observeDockerRuntimeDirectoryLockUsingDependenciesの責務を完了した結果だけを返す。
 * @effect 固定依存のDirectory識別・entry列挙・entry読取り観測を前後で呼ぶ。変更操作は行わない。
 * @failure 空集合、上限超過、未知エラー、親実体・entry差はnullを返す。
 * @invariant observeDockerRuntimeDirectoryLockUsingDependenciesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Directoryの前後観測とentryへのアクセス拒否。依存差替えはPackage内試験だけに使う。
 * @security observeDockerRuntimeDirectoryLockUsingDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeDockerRuntimeDirectoryLockUsingDependenciesは共有非同期状態を持たない同期処理である。
 */
export function observeDockerRuntimeDirectoryLockUsingDependencies(
  directory: string,
  dependencies: RuntimeDirectoryLockObservationDependencies,
) {
  try {
    const beforeIdentity = dependencies.identityAt(directory);
    if (!beforeIdentity) return null;
    const beforeEntries = [...dependencies.readEntries(directory)]
      .map((entry) => Object.freeze({ ...entry }))
      .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
    if (
      beforeEntries.length === 0 ||
      beforeEntries.length > MAXIMUM_RUNTIME_DIRECTORY_ENTRIES ||
      beforeEntries.some((entry) => !validRuntimeDirectoryEntry(entry))
    )
      return null;
    let wasLockObserved = false;
    for (const entry of beforeEntries) {
      try {
        dependencies.probeEntry(path.win32.join(directory, entry.name));
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (!knownSocketErrorCodes.has(code)) return null;
        wasLockObserved = true;
      }
    }
    const afterEntries = [...dependencies.readEntries(directory)]
      .map((entry) => Object.freeze({ ...entry }))
      .sort((left, right) => left.name.localeCompare(right.name, "en-US"));
    const afterIdentity = dependencies.identityAt(directory);
    return wasLockObserved &&
      afterIdentity &&
      sameDirectoryIdentity(beforeIdentity, afterIdentity) &&
      sameRuntimeDirectoryEntries(beforeEntries, afterEntries)
      ? beforeIdentity
      : null;
  } catch {
    return null;
  }
}

/**
 * 検証済み修復境界のRuntime Directoryを読み取り観測する。
 * @responsibility 実ファイルシステムの観測を固定依存へ接続する。
 * @trace ARCH-000008
 * @input directory: 上位が検証済み修復境界から得たDirectory。
 * @returns 親実体が安定した既知ロックの識別子、またはnull。
 * @precondition 呼出し元が対象Directoryの用途を確認している。
 * @postcondition nullを不存在・解放済みと解釈しない。
 * @effect lstat・readdir・entryのopen／closeだけを行い、変更・削除しない。
 * @failure 不在、読取不能、親／entry変化、未知エラーはnull。
 * @invariant 64件上限と既知3エラーだけのロック根拠を維持する。
 * @boundary Windows AF_UNIX相当のentryと親Directory。
 * @security 任意コマンド・依存差替え・操作Authorityを公開しない。
 * @concurrency 前後照合はatomic snapshotではなく、同一Userを信頼する現在観測である。
 */
export function observeDockerRuntimeDirectoryLock(directory: string) {
  if (process.platform !== "win32") return null;
  return observeDockerRuntimeDirectoryLockUsingDependencies(directory, {
    identityAt: (target) => {
      try {
        return directoryIdentity(fs.lstatSync(target, { bigint: true }));
      } catch {
        return null;
      }
    },
    readEntries: (target) =>
      fs.readdirSync(target, { withFileTypes: true }).map((entry) =>
        Object.freeze({
          name: entry.name,
          isDirectory: entry.isDirectory(),
          isSymbolicLink: entry.isSymbolicLink(),
        }),
      ),
    probeEntry: (target) => {
      const handle = fs.openSync(target, "r");
      try {
        fs.closeSync(handle);
      } catch {
        throw new Error("docker_runtime_directory_entry_close_unconfirmed");
      }
    },
  });
}
