/**
 * Runtime保存の用途別Repository観測を検証する。
 * @responsibility 元の検証済みRoot、操作相関と同期現在性を保存の内部結合へ変換する。
 * @trace ARCH-000008
 * @boundary Hostが構成する有限の観測だけを受け、HTTP入力や保存JSONからOwnerを復元しない。
 */
import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  gitRepositoryRevisionAdapter,
  observeRepositoryRevision,
  observeRepositoryStorageIdentity,
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

/**
 * 同じ操作Ownerが構成する通常保存の有限入力。
 * @responsibility 既存の操作相関キーとfresh Repository借用を別に保持する。
 * @trace ARCH-000008
 * @shape opaque相関キー、通常Repository観測、元の未発行通知照合。
 * @invariant identityだけをOwner証明とせず、観測と候補検査を別に行う。
 * @boundary 信頼したHost構成だけ。外部JSONへ搬送しない。
 * @security 観測callbackを登録・永続化せず、生WriterやKernelを渡さない。
 * @compatibility 元の操作Mapと六値の通知相関を維持する。
 */
export type RuntimeExecutionStorageAccess = Readonly<{
  identity: object;
  observeRepository: () => Readonly<{
    purpose: "execution";
    root: VerifiedRepositoryRoot;
    operationId: string;
    revalidate: () => boolean;
  }> | null;
  verifyNotIssued: (
    notice: unknown,
    recoveryCapability: unknown,
    purpose: string,
    operationId: unknown,
    recoveryId: string,
  ) => boolean;
}>;

/**
 * 同じ実体に限る終端保存のHost観測。
 * @responsibility 終了済みの実行Ownerを復活させず、終端保存先の実体だけを再確認する。
 * @trace ARCH-000008
 * @shape 元Root、operationId、終端用途と同期再検証。
 * @invariant 通常実行・業務保存・回復読取りのContextと混用しない。
 * @boundary 元の回復又は終了Ownerから固定終端入口だけ。
 * @security この値自体から実行・回復Authorityを発行しない。
 * @compatibility 元の終端処理と一回使用証拠を別に要求する。
 */
export type RuntimeSettlementStorageAccess = Readonly<{
  purpose: "settlement";
  root: VerifiedRepositoryRoot;
  operationId: string;
  revalidate: () => boolean;
}>;

/**
 * own data propertyだけを読む。
 * @responsibility Proxyとaccessorを評価せずHost入力を取り出す。
 * @trace ARCH-000008
 * @input value: 候補、name: 固定field。
 * @returns data値、又はundefined。
 * @precondition N/A: 不正入力の拒否を所有する。
 * @postcondition Getterやthenを呼ばない。
 * @effect N/A: 値の構造検査だけ。
 * @failure Proxy・非object・accessorはundefined。
 * @invariant 構造の一致をAuthority証明にしない。
 * @boundary 保存内部のHost入力。
 * @security 未検証Propertyを直接評価しない。
 * @concurrency N/A: 同期の局所検査。
 */
function data(value: unknown, name: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value))
    return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, name);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}

/**
 * 同期観測の返却値を限定して得る。
 * @responsibility 非同期値を待たず拒否し、通常関数が返した拒否Promiseも未処理にしない。
 * @trace ARCH-000008
 * @input callback: 用途固定観測、args: 元の有限引数。
 * @returns 同期値、又はundefined。
 * @precondition 呼出し側が結果の用途と値を再検査する。
 * @postcondition then getterを読まず、Promiseの完了を成功へ扱わない。
 * @effect 既存の同期観測を一回呼ぶ。
 * @failure throw・Proxy関数・async関数・Promiseはundefined。
 * @invariant 観測の失敗を不存在へ変換しない。
 * @boundary Host現在性と保存検査。
 * @security callbackを保存又は登録しない。
 * @concurrency 待機・新Worker・Queueを作らない。
 */
function synchronous(callback: unknown, ...args: unknown[]): unknown {
  if (
    typeof callback !== "function" ||
    types.isProxy(callback) ||
    types.isAsyncFunction(callback)
  )
    return undefined;
  try {
    const value: unknown = callback(...args);
    if (types.isPromise(value)) {
      Promise.prototype.then.call(value, undefined, () => undefined);
      return undefined;
    }
    if (value && typeof value === "object") {
      if (types.isProxy(value)) return undefined;
      const prototype = Object.getPrototypeOf(value);
      if (
        (prototype !== Object.prototype && prototype !== null) ||
        "then" in value
      )
        return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

/**
 * 検証済みRootの保存実体結合を導く。
 * @responsibility Rootの私有Capabilityと現在Storage Identityだけから元のHashを再現する。
 * @trace ARCH-000008
 * @input root: 既存Version Controlの検証済みRoot。
 * @returns 保存Root、結合、実体観測と再検証、又はnull。
 * @precondition この観測だけを実行Ownerの証明にしない。
 * @postcondition 元のdomainと符号化順を維持する。
 * @effect Repository配置とStorage Identityの読取り。
 * @failure 不正Root・実体観測不能はnull。
 * @invariant Path又はHashからCapabilityを再発行しない。
 * @boundary Version Controlと保存内部。
 * @security Root Capabilityを返却DTO・JSONへ複製しない。
 * @concurrency 再検証は元のI/O境界で呼ぶ。
 */
export function observeRuntimeStorageRepository(root: VerifiedRepositoryRoot) {
  try {
    const repositoryRoot = resolveVerifiedRepositoryRoot(root);
    const observed = observeRepositoryStorageIdentity(root);
    if (!repositoryRoot || !observed) return null;
    return Object.freeze({
      repositoryRoot,
      repositoryBinding: createHash("sha256")
        .update("crdd-coordinator-repository-state-binding-v1\0")
        .update(
          JSON.stringify([
            repositoryRoot,
            observed.repositoryIdentity,
            observed.repositoryInstanceIdentity,
          ]),
          "utf8",
        )
        .digest("hex"),
      revalidate() {
        const fresh = observeRepositoryStorageIdentity(root);
        return (
          fresh !== null &&
          fresh.repositoryForm === observed.repositoryForm &&
          fresh.repositoryIdentity === observed.repositoryIdentity &&
          fresh.repositoryInstanceIdentity ===
            observed.repositoryInstanceIdentity
        );
      },
    });
  } catch {
    return null;
  }
}

/**
 * 通常実行のfresh借用を保存内部へ変換する。
 * @responsibility 元の操作Owner観測を呼び、真正Rootから同じ物理結合を導く。
 * @trace ARCH-000008
 * @input access: Host構成の通常実行保存入力。
 * @returns 元operationIdと再検証を保つ内部結合、又はnull。
 * @precondition identityは元のopaque相関キーとして別に使用する。
 * @postcondition 回復・業務・終端用途を通常用途へ昇格しない。
 * @effect 既存Owner観測とRoot実体の読取り。
 * @failure 不正Context・用途・Root・非同期観測はnull。
 * @invariant 現在性callback単独をAuthorityにしない。
 * @boundary 元の操作Ownerと単一Writer。
 * @security 生Path・任意bindingをCallerから受けない。
 * @concurrency 借用を呼出し間でcacheしない。
 */
export function observeRuntimeExecutionRepository(access: unknown) {
  const context = synchronous(data(access, "observeRepository"));
  const root = data(context, "root") as VerifiedRepositoryRoot;
  const operationId = data(context, "operationId");
  const revalidate = data(context, "revalidate");
  if (
    data(context, "purpose") !== "execution" ||
    typeof operationId !== "string" ||
    !operationId ||
    typeof revalidate !== "function"
  )
    return null;
  const repository = observeRuntimeStorageRepository(root);
  return repository
    ? Object.freeze({
        ...repository,
        operationId,
        revalidate: () =>
          repository.revalidate() && synchronous(revalidate) === true,
      })
    : null;
}

/**
 * 通常保存の元相関キーを取り出す。
 * @responsibility 毎回のHost Contextを新しい一回証拠のkeyにしない。
 * @trace ARCH-000008
 * @input access: 通常実行のHost入力。
 * @returns 元object、又はnull。
 * @precondition 現在性と用途は通常借用が別に検査する。
 * @postcondition 新しいMap・資格を発行しない。
 * @effect N/A: own data値だけを取得する。
 * @failure 不正値はnull。
 * @invariant keyの存在だけを保存許可としない。
 * @boundary 既存一回MapとHost入力。
 * @security 元Capabilityを保存JSONへ含めない。
 * @concurrency 元keyの取得・消費順を変更しない。
 */
export function runtimeStorageOperationIdentity(access: unknown) {
  const value = data(access, "identity");
  return value && typeof value === "object" && !types.isProxy(value)
    ? value
    : null;
}

/**
 * 未発行通知の元六値をfresh差分から再照合する。
 * @responsibility intent_savedからnot_issuedへの処置点で元Ownerの照合を呼ぶ。
 * @trace ARCH-000008
 * @input notice、recovery、access: 元通知とOwner、purpose、operationId、recoveryId: Writerが確認した対象。
 * @returns 同期trueだけを成立とする。
 * @precondition 呼出し側がfresh差分と対象一致を先に検査する。
 * @postcondition 事前計算したbooleanや別Ownerを使用しない。
 * @effect 元の通知検証を一回呼ぶ。
 * @failure throw・Promise・true以外はfalse。
 * @invariant 新しい処置Authorityを発行しない。
 * @boundary 固定差分と元の通知Owner。
 * @security 通知を保存・複製・登録しない。
 * @concurrency 同期処置中だけ使用する。
 */
export function verifyRuntimeStorageUnissuedNotice(
  notice: unknown,
  recovery: unknown,
  access: unknown,
  purpose: string,
  operationId: unknown,
  recoveryId: string,
): boolean {
  return (
    synchronous(
      data(access, "verifyNotIssued"),
      notice,
      recovery,
      purpose,
      operationId,
      recoveryId,
    ) === true
  );
}

/**
 * 検証済みRootの現在Revisionを回復読取りへ固定する。
 * @responsibility 操作Authorityを復元せず、同じ実体と捕捉RevisionをReaderへ結合する。
 * @trace ARCH-000008
 * @input root: Version Controlが発行したRoot。
 * @returns 再入場読取り用の内部結合、又はnull。
 * @precondition 固定読取り入口からだけ使用する。
 * @postcondition 書込み・回復Authorityを発行しない。
 * @effect Root配置とGit Revisionを読む。
 * @failure 偽Root・実体又はRevision差・観測不能はnull又はfalse。
 * @invariant 記録からRootや旧Ownerを復元しない。
 * @boundary Root検証と回復Reader。
 * @security 元の未知を不存在へ補完しない。
 * @concurrency Readerの元の前後観測点で再検証する。
 */
export function observeRuntimeRecoveryRepository(input: unknown) {
  const root = input as VerifiedRepositoryRoot;
  try {
    const repositoryRoot = resolveVerifiedRepositoryRoot(root);
    const initial = observeRepositoryRevision(
      root,
      gitRepositoryRevisionAdapter,
    );
    if (!repositoryRoot || !initial) return null;
    return Object.freeze({
      repositoryRoot,
      repositoryBinding: createHash("sha256")
        .update("crdd-coordinator-repository-state-binding-v1\0")
        .update(
          JSON.stringify([
            repositoryRoot,
            initial.repositoryIdentity,
            initial.repositoryInstanceIdentity,
          ]),
          "utf8",
        )
        .digest("hex"),
      revalidate() {
        try {
          if (resolveVerifiedRepositoryRoot(root) !== repositoryRoot)
            return false;
          const fresh = observeRepositoryRevision(
            root,
            gitRepositoryRevisionAdapter,
          );
          return (
            fresh !== null &&
            fresh.repositoryForm === initial.repositoryForm &&
            fresh.repositoryIdentity === initial.repositoryIdentity &&
            fresh.repositoryInstanceIdentity ===
              initial.repositoryInstanceIdentity &&
            fresh.revisionIdentity === initial.revisionIdentity
          );
        } catch {
          return false;
        }
      },
    });
  } catch {
    return null;
  }
}

/**
 * 元実体に限る終端保存の借用を検証する。
 * @responsibility 終了後の現在性を通常実行のRevision条件へ戻さない。
 * @trace ARCH-000008
 * @input access: Hostが元Ownerへ結合した終端用途。
 * @returns operationIdと元の同期現在性を保つ内部結合、又はnull。
 * @precondition 用途別の一回証拠・assertOwnerをWriterが別に検査する。
 * @postcondition 通常用途・回復読取り・業務保存を終端保存へ昇格しない。
 * @effect Root実体の読取りだけ。
 * @failure 用途・Root・操作相関・同期観測の不正は拒否する。
 * @invariant Contextの形だけで処置許可を成立させない。
 * @boundary 元終了Ownerと固定終端保存入口。
 * @security Path・binding・生Kernelを入力にしない。
 * @concurrency 元のI/O前後の照合位置を維持する。
 */
export function observeRuntimeSettlementRepository(access: unknown) {
  const root = data(access, "root") as VerifiedRepositoryRoot;
  const operationId = data(access, "operationId");
  const revalidate = data(access, "revalidate");
  if (
    data(access, "purpose") !== "settlement" ||
    typeof operationId !== "string" ||
    !operationId ||
    typeof revalidate !== "function"
  )
    return null;
  const repository = observeRuntimeStorageRepository(root);
  return repository
    ? Object.freeze({
        ...repository,
        operationId,
        revalidate: () =>
          repository.revalidate() && synchronous(revalidate) === true,
      })
    : null;
}
/**
 * 同じ実行Ownerが照合した有限の終端観測を表す。
 * @responsibility Docker型への依存なしに元の終了事実だけを保存へ渡す。
 * @trace ARCH-000008
 * @shape 資源観測、一次失敗、Home・Mount・回復の終了観測。
 * @invariant この構造自体を実終了の証明にしない。
 * @boundary 元の観測Ownerと保存内の相関検査。
 * @security 実行又は回復Authorityを含めない。
 * @compatibility 元のWriterが検査するfieldを維持する。
 */
export type RuntimeTerminalStorageObservation = Readonly<{
  resources: readonly unknown[];
  primaryFailure: unknown;
  homeLeaseReleased: boolean;
  mountLeaseReleased: boolean;
  recoveryCompleted: boolean;
}>;
/**
 * 通常Ownerが固定した終端用途Rootを照合する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input access: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function observeRuntimeSettlementStorageAccess(access: unknown) {
  const context = synchronous(data(access, "observeSettlementRepository"));
  return observeRuntimeSettlementRepository(context);
}

/**
 * 元の清掃Owner照合を同期の有限観測として捕捉する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input access: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function captureRuntimeCleanupVerification(access: unknown) {
  const verify = synchronous(data(access, "captureCleanupVerification"));
  if (typeof verify !== "function" || types.isProxy(verify)) return null;
  return (outcome: unknown) => {
    const value = synchronous(verify, outcome);
    return typeof value === "string" ? value : null;
  };
}

/**
 * 元の終端観測Ownerへ結果とexact相関を照合する。
 * @responsibility 実資源観測を捏造せず元のHost照合を保存へ接続する。
 * @trace ARCH-000008
 * @input result、access、operationId、recoveryId: 元の有限観測入力。
 * @returns 固定用途の同期観測、又はnull。
 * @precondition Hostは既存Ownerの照合だけを渡す。
 * @postcondition 型一致だけを終了Authorityとしない。
 * @effect 元の同期照合だけ。
 * @failure 不正Context・非同期・例外・Proxyを拒否する。
 * @invariant 元の相関とunknownを維持する。
 * @boundary Domain保存と実行Owner。
 * @security 観測を登録・永続化しない。
 * @concurrency 新しい待機・Map・排他を作らない。
 */
export function observeRuntimeTerminalForStorage(
  result: unknown,
  access: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  const value = synchronous(
    data(access, "observeTerminal"),
    result,
    operationId,
    recoveryId,
  );
  const resources = data(value, "resources");
  if (
    !Array.isArray(resources) ||
    types.isProxy(resources) ||
    ["homeLeaseReleased", "mountLeaseReleased", "recoveryCompleted"].some(
      (key) => typeof data(value, key) !== "boolean",
    )
  )
    return null;
  return value as RuntimeTerminalStorageObservation;
}
/**
 * 一般CRUDのRootと既存内容認可を現在の保存実体へ結合する。
 * @responsibility 入口と各I/O境界で同期認可を再照合する。
 * @trace ARCH-000008
 * @input access: Host接続、operation: 固定用途、target: 対象ID。
 * @returns 現在の認可済み保存観測、又はnull。
 * @precondition 呼出し元は用途を固定し外部要求から操作名を生成しない。
 * @postcondition 非同期・例外・不正Rootを拒否する。
 * @effect 現在Rootと既存の同期認可だけ。
 * @failure 拒否・不明はnull。
 * @invariant 新しい主体・権限・Registryを作らない。
 * @boundary Host認可と一般保存。
 * @security 生Pathや任意HashからContextを発行しない。
 * @concurrency この呼出し限り。callbackを登録しない。
 */
export function observeRuntimeContentRepository(
  access: unknown,
  operation: Parameters<
    import("../state/types.ts").RuntimeAccess["revalidate"]
  >[0],
  target: Readonly<{ projectId: string; milestoneId: string }>,
) {
  const root = data(access, "root") as VerifiedRepositoryRoot;
  const principal = data(access, "principalId");
  const revalidate = data(access, "revalidate");
  if (
    typeof principal !== "string" ||
    !principal ||
    synchronous(revalidate, operation, target) !== true
  )
    return null;
  const repository = observeRuntimeStorageRepository(root);
  return repository
    ? Object.freeze({
        ...repository,
        revalidate: () =>
          repository.revalidate() &&
          synchronous(revalidate, operation, target) === true,
      })
    : null;
}
