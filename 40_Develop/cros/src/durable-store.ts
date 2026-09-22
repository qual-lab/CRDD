/**
 * CROSの公開操作、Handoffおよび結果帰還を耐久境界へ接続する。
 *
 * @packageDocumentation
 * @responsibility 複数Processが共有する一回性、Revision競合および結果相関のFilesystem Ownerを提供する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary CROS Application ContractとRepository／OS管理の耐久Store境界。
 * @effect 明示されたStore Root内のJSONだけを作成または置換する。
 * @security Secretを保存せず、Symbolic Linkおよび不正なStore形状を拒否する。
 */
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

import {
  resolveFilesystemStorePath,
  type FilesystemStoreRoot,
} from "../../crdd-domain-library/src/filesystem-store-root/index.ts";

import type {
  CanonicalOperationOwner,
  DelegatedResult,
} from "./application-contract.ts";
import { settleDelegatedResult } from "./application-contract.ts";
import type {
  ContextPackage,
  ContextItem,
  CrosCredential,
  CrosExposure,
  CrosHandoff,
  CrosRepository,
  CrosSession,
} from "./runtime.ts";
import {
  closeCrosSession,
  createContextPackage,
  createCrosSession,
  resolveRepository,
  resumeHandoff,
} from "./runtime.ts";

/**
 * 耐久Federationで取得する一つのSource要求を定義する。
 *
 * @responsibility Context key、Scope、Repositoryおよび取得Propertyを同じ要求へ結合する。
 * @trace ARCH-000013
 * @shape 論理key、許可Scope、Repository Identity、相対Pathおよびcontent keyを持つ。
 * @invariant Repository Identityと物理相対Pathを推測で相互変換しない。
 * @boundary Federation要求とRepository Resolverの境界。
 * @security 絶対PathまたはCredentialを保持しない。
 * @compatibility Property追加時も既存要求の意味を変更しない。
 */
export type DurableContextSourceRequest = Readonly<{
  key: string;
  scope: string;
  repositoryId: string;
  repositoryRelativePath: string;
  contentKey: string;
}>;

/**
 * 四Surfaceが共有するCanonical Ownerの耐久Recordを定義する。
 *
 * @responsibility Revision、値および書込み回数を一つのOwner Snapshotへ閉じる。
 * @trace ARCH-000010
 * @shape Revision、nullable valueおよびwrite countを持つ。
 * @invariant 一回の正常更新でRevisionとwritesを一つだけ進める。
 * @boundary Application ContractとFilesystem Owner Recordの境界。
 * @security Surface固有値またはCredentialを保持しない。
 * @compatibility 既存fieldの意味を変更しない。
 */
type CanonicalRecord = Readonly<{
  revision: string;
  value: string | null;
  writes: number;
}>;

/**
 * 耐久Credential Registryの認証Recordを定義する。
 *
 * @responsibility Grant情報、Token verifierおよび期限を同じCredential Identityへ結合する。
 * @trace ARCH-000013
 * @shape CrosCredential、SHA-256 verifierおよびISO期限を持つ。
 * @invariant 生Tokenを保存せず、GrantはCredential Recordだけから取得する。
 * @boundary Credential発行とSession認証の境界。
 * @security 生Tokenまたは復号可能なSecretを保持しない。
 * @compatibility verifier変更は明示した契約改訂を必要とする。
 */
export type DurableCrosCredentialRecord = Readonly<{
  credential: CrosCredential;
  tokenSha256: string;
  expiresAt: string;
}>;

/**
 * 通常FileだけからJSON Recordを読み取る。
 *
 * @responsibility Store Record読取り前にFile種別とLink不存在を確認する。
 * @trace ARCH-000013
 * @input Root Capabilityから解決済みの絶対File Path。
 * @returns Parseした型付きRecord。
 * @precondition PathはresolveFilesystemStorePathで解決済みである。
 * @postcondition 通常Fileの内容だけを返す。
 * @effect File metadataと本文を読取る。
 * @failure 非File、Link、不正JSONまたはFilesystem失敗を例外で返す。
 * @invariant 不正な対象を空Recordへ畳まない。
 * @boundary CROS StoreとFilesystem Recordの境界。
 * @security Link先をCredentialまたはRepository Recordとして読まない。
 * @concurrency Revision整合は呼出し側のSnapshot契約で確認する。
 */
function readRegularJson<T>(file: string): T {
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("cros_durable_store_file_invalid");
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

/**
 * JSON Recordを同一Directoryの一時Fileから置換する。
 *
 * @responsibility 不完全な本文を正式Fileへ公開せず一回のrenameで置換する。
 * @trace ARCH-000013
 * @input 解決済みFile PathとJSON化可能な値。
 * @returns N/A: 置換成功時に復帰する。
 * @precondition File Pathは用途限定Root内にある。
 * @postcondition 正式Fileは完全なJSONと末尾改行を持つ。
 * @effect 親Directory、一時Fileおよび正式Fileを作成または置換する。
 * @failure 一時File競合、JSON化不能またはFilesystem失敗を例外で返す。
 * @invariant 一時Fileを正式Recordとして読ませない。
 * @boundary CROS Store WriterとFilesystem rename境界。
 * @security 解決済みPath以外へ書き込まない。
 * @concurrency 複数WriterがあるRecordは上位LockまたはRevision Gateで直列化する。
 */
function replaceJson(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  fs.renameSync(temporary, file);
}

/**
 * 検証済みCredentialから耐久Sessionを一度だけ開始する。
 *
 * @responsibility Credential、Registry RevisionおよびSession Identityを別Processから再読取りできるRecordへ閉じる。
 * @trace ARCH-000013
 * @input credentialFile: Credential Record、sessionFile: Session Record、sessionId: 新Identity、registryRevision: Registry Revision。
 * @returns 作成したCrosSession、または失効Credentialによるnull。
 * @precondition Credential Fileは許可済みStore内の通常Fileで、Session Fileは未作成である。
 * @postcondition 正常時だけactiveなSession Fileを一つ作成する。
 * @effect Session Fileを排他的に作成する。
 * @failure 不正File、既存Session、失効Credentialまたは不正入力を拒否する。
 * @invariant Credential SecretをSessionへ複製せずGrant Snapshotだけを保存する。
 * @boundary Credential Store→Session Process→Durable Session Store。
 * @security systemAdminからContent Accessを追加しない。
 * @concurrency wxによって同じSession Identityの二重発行を拒否する。
 */
export function createDurableCrosSession(
  storeRoot: FilesystemStoreRoot,
  credentialRelativePath: string,
  sessionRelativePath: string,
  sessionId: string,
  registryRevision: string,
  presentedToken: string,
): CrosSession | null {
  const credentialFile = resolveFilesystemStorePath(
    storeRoot,
    credentialRelativePath,
  );
  const sessionFile = resolveFilesystemStorePath(
    storeRoot,
    sessionRelativePath,
  );
  const record = readRegularJson<DurableCrosCredentialRecord>(credentialFile);
  const expiresAt = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const presentedDigest = crypto
    .createHash("sha256")
    .update(presentedToken, "utf8")
    .digest();
  const expectedDigest = Buffer.from(record.tokenSha256, "hex");
  if (
    expectedDigest.length !== presentedDigest.length ||
    !crypto.timingSafeEqual(expectedDigest, presentedDigest)
  )
    return null;
  const session = createCrosSession(
    sessionId,
    record.credential,
    registryRevision,
  );
  if (!session) return null;
  fs.mkdirSync(path.dirname(sessionFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(sessionFile, `${JSON.stringify(session)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return session;
}

/**
 * 耐久SessionとRegistry SnapshotからRepositoryを解決する。
 *
 * @responsibility 別Processで保存されたSession、ExposureおよびRepositoryを同じRevision境界で照合する。
 * @trace ARCH-000013
 * @input sessionFile: Session Record、repositoryId: 要求Identity、exposureFile: Exposure集合、repositoryFile: Repository集合。
 * @returns availableなRepositoryまたは非開示のrestricted結果。
 * @precondition 入力Fileは同じ固定Registry Snapshotに属する通常Fileである。
 * @postcondition 許可済みRepositoryだけを返しStoreを変更しない。
 * @effect N/A: 耐久Recordを読取るだけである。
 * @failure 不正File、inactive、Grant外、古いRevisionまたは未登録を拒否する。
 * @invariant 拒否結果へRepository Identityや存在を含めない。
 * @boundary Durable Session Store→Exposure Registry→Repository Projection。
 * @security 管理能力をContent Accessへ昇格しない。
 * @concurrency 入力FileのRevisionをSession Snapshotと照合する。
 */
export function resolveDurableRepository(
  storeRoot: FilesystemStoreRoot,
  sessionRelativePath: string,
  repositoryId: string,
  exposureRelativePath: string,
  repositoryRelativePath: string,
) {
  const sessionFile = resolveFilesystemStorePath(
    storeRoot,
    sessionRelativePath,
  );
  const exposureFile = resolveFilesystemStorePath(
    storeRoot,
    exposureRelativePath,
  );
  const session = readRegularJson<CrosSession>(sessionFile);
  const exposures = readRegularJson<readonly CrosExposure[]>(exposureFile);
  const isAuthorized =
    session.active &&
    exposures.some(
      (entry) =>
        entry.active &&
        entry.repositoryId === repositoryId &&
        entry.registryRevision === session.registryRevision &&
        session.workspaceIds.includes(entry.workspaceId),
    );
  if (!isAuthorized) return Object.freeze({ status: "restricted" as const });
  const repositoryFile = resolveFilesystemStorePath(
    storeRoot,
    repositoryRelativePath,
  );
  return resolveRepository(
    session,
    repositoryId,
    exposures,
    readRegularJson<readonly CrosRepository[]>(repositoryFile),
  );
}

/**
 * 耐久Sessionから複数Repositoryを解決し、目的限定Context Packageを生成する。
 *
 * @responsibility 実Repository Projectionの値・Revision・部分アクセス・欠測・競合を推測せずPackageへ変換する。
 * @trace ARCH-000013
 * @trace ARCH-000015
 * @input Store Root、Session／Exposure Path、Package Identity、目的、許可ScopeおよびSource要求。
 * @returns 実Repository解決結果から生成したContextPackage。
 * @precondition 要求はRepositoryごとの独立Fileと取得するcontent keyを宣言する。
 * @postcondition Scope外を除き、同じkeyの異なる完全値はconflictingへ畳む。
 * @effect 許可判定後のRepository Fileだけを読取り、Storeを変更しない。
 * @failure 欠測File／keyはmissing、未許可はrestrictedとして保持する。
 * @invariant 欠測・制限・競合をcompleteへ変換せず、非開示Source Identityを返さない。
 * @boundary Session→Exposure→Repository Projection→Context Package。
 * @security Grant外Repository Fileを読まず、restricted項目のSourceと値をnullにする。
 * @concurrency SessionとExposureは同じRegistry RevisionのSnapshotとして評価する。
 */
export function createDurableFederatedContextPackage(
  storeRoot: FilesystemStoreRoot,
  sessionRelativePath: string,
  exposureRelativePath: string,
  packageId: string,
  purpose: string,
  allowedScopes: readonly string[],
  requests: readonly DurableContextSourceRequest[],
): ContextPackage {
  const items: ContextItem[] = requests
    .filter((request) => allowedScopes.includes(request.scope))
    .map((request) => {
      try {
        const resolved = resolveDurableRepository(
          storeRoot,
          sessionRelativePath,
          request.repositoryId,
          exposureRelativePath,
          request.repositoryRelativePath,
        );
        if (resolved.status !== "available")
          return Object.freeze({
            key: request.key,
            value: null,
            sourceId: null,
            revision: null,
            scope: request.scope,
            state: "restricted" as const,
          });
        const value = resolved.repository.content[request.contentKey];
        return Object.freeze({
          key: request.key,
          value: value ?? null,
          sourceId: resolved.repository.repositoryId,
          revision: resolved.repository.revision,
          scope: request.scope,
          state:
            value === undefined ? ("missing" as const) : ("complete" as const),
        });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return Object.freeze({
          key: request.key,
          value: null,
          sourceId: request.repositoryId,
          revision: null,
          scope: request.scope,
          state: "missing" as const,
        });
      }
    });
  const mergedItems: ContextItem[] = [
    ...new Set(items.map((item) => item.key)),
  ].map((key) => {
    const sameKeyItems = items.filter((item) => item.key === key);
    const first = sameKeyItems[0];
    if (!first) throw new Error("cros_context_package_group_invalid");
    const completeItems = sameKeyItems.filter(
      (item) => item.state === "complete",
    );
    if (
      completeItems.length > 1 &&
      new Set(completeItems.map((item) => JSON.stringify(item.value))).size > 1
    )
      return Object.freeze({
        key,
        value: null,
        sourceId: null,
        revision: null,
        scope: completeItems[0]?.scope ?? first.scope,
        state: "conflicting" as const,
      });
    return first;
  });
  return createContextPackage(packageId, purpose, allowedScopes, mergedItems);
}

/**
 * 耐久Sessionを同じIdentityのinactive状態へ置換する。
 *
 * @responsibility 切断を別Processが観測できるSession Storeの状態遷移として確定する。
 * @trace ARCH-000013
 * @input sessionFile: 現在のSession Record。
 * @returns active=falseのCrosSession。
 * @precondition Session Fileは通常Fileとして存在する。
 * @postcondition 同じSession Identityのactive=false Recordが保存される。
 * @effect Session Fileをinactive Snapshotへ置換する。
 * @failure 不正FileまたはFilesystem失敗を例外で拒否する。
 * @invariant Workspace Grantを変更せず利用可能性だけを失効する。
 * @boundary Session Process→Durable Session Store。
 * @security 切断後のContent Accessを再許可しない。
 * @concurrency Sessionを再読取りしてから置換し、呼出し側は単一Ownerとして実行する。
 */
export function closeDurableCrosSession(
  storeRoot: FilesystemStoreRoot,
  sessionRelativePath: string,
): CrosSession {
  const sessionFile = resolveFilesystemStorePath(
    storeRoot,
    sessionRelativePath,
  );
  const closed = closeCrosSession(readRegularJson<CrosSession>(sessionFile));
  replaceJson(sessionFile, closed);
  return closed;
}

/**
 * 一時Context PackageをConsumer用Fileへ一度だけ書き出す。
 *
 * @responsibility Package Identity、provenance、不完全状態および非正本属性をProcess境界越しに保持する。
 * @trace ARCH-000015
 * @input packageFile: 一時Package File、contextPackage: 目的限定Package。
 * @returns N/A: 作成成功時に復帰する。
 * @precondition PackageはretainedAsSourceOfTruth=falseで、出力Fileは未作成である。
 * @postcondition Consumerが再読取りできるPackage Fileを一つ作成する。
 * @effect 一時Package Fileを排他的に作成する。
 * @failure 正本化指定、既存FileまたはFilesystem失敗を拒否する。
 * @invariant Package項目とprovenanceを追加・補完しない。
 * @boundary Repository Projection Process→Context Package File。
 * @security 許可済み項目以外を追加しない。
 * @concurrency wxで同じPackageの重複発行を拒否する。
 */
export function writeDurableContextPackage(
  storeRoot: FilesystemStoreRoot,
  packageRelativePath: string,
  contextPackage: ContextPackage,
): void {
  const packageFile = resolveFilesystemStorePath(
    storeRoot,
    packageRelativePath,
  );
  if (contextPackage.retainedAsSourceOfTruth !== false)
    throw new Error("cros_context_package_source_of_truth_forbidden");
  fs.mkdirSync(path.dirname(packageFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(packageFile, `${JSON.stringify(contextPackage)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

/**
 * 一時Context Packageを一度だけ消費してReceiptを残す。
 *
 * @responsibility Consumer受領内容をPackage Identityと相関し、Package本体を正本として残さない。
 * @trace ARCH-000015
 * @input packageFile: 一時Package、receiptFile: 消費記録、consumerId: Consumer Identity。
 * @returns Consumerが受領したContextPackage。
 * @precondition Package Fileが通常Fileとして存在し、Receipt Fileは未作成である。
 * @postcondition Receiptを一つ作成しPackage Fileを削除する。
 * @effect Receipt Fileを排他的に作成し一時Package Fileを削除する。
 * @failure 不正File、空Consumer、重複消費またはFilesystem失敗を拒否する。
 * @invariant ReceiptへPackage内容を複製せずIdentityと件数だけを保存する。
 * @boundary Context Package File→Consumer Process→Receipt Store。
 * @security restricted値やSource IdentityをReceiptへ保存しない。
 * @concurrency Receiptのwx作成により二重消費を拒否する。
 */
export function consumeDurableContextPackage(
  storeRoot: FilesystemStoreRoot,
  packageRelativePath: string,
  receiptRelativePath: string,
  consumerId: string,
): ContextPackage {
  const packageFile = resolveFilesystemStorePath(
    storeRoot,
    packageRelativePath,
  );
  const receiptFile = resolveFilesystemStorePath(
    storeRoot,
    receiptRelativePath,
  );
  if (!consumerId) throw new Error("cros_context_consumer_invalid");
  const contextPackage = readRegularJson<ContextPackage>(packageFile);
  fs.mkdirSync(path.dirname(receiptFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    receiptFile,
    `${JSON.stringify({ packageId: contextPackage.packageId, consumerId, itemCount: contextPackage.items.length })}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
  fs.rmSync(packageFile);
  return contextPackage;
}

/**
 * File-backedなCanonical Operation Ownerを作成する。
 *
 * @responsibility 全Surfaceが共有する値、Revisionおよび書込み回数を一つの耐久Ownerへ閉じる。
 * @trace ARCH-000010
 * @input file: Store File、initialRevision: 初期Revision。
 * @returns CanonicalOperationOwner。
 * @precondition fileは許可済みStore Root内の正規Pathである。
 * @postcondition 初回だけ初期Recordを作成し、以後は同じRecordを利用する。
 * @effect inspectは読取り、applyはRevision一致時だけFileを一回置換する。
 * @failure 不正File、JSONまたはRevision競合を例外またはfalseで拒否する。
 * @invariant Surface別Storeを生成せず一つのFileを正本とする。
 * @boundary Application Contract→Filesystem Canonical Owner。
 * @security Symbolic LinkをOwner Fileとして利用しない。
 * @concurrency Revision一致を置換直前に再読取りして競合を拒否する。
 */
export function createFileCanonicalOperationOwner(
  storeRoot: FilesystemStoreRoot,
  relativePath: string,
  initialRevision: string,
): CanonicalOperationOwner {
  const file = resolveFilesystemStorePath(storeRoot, relativePath);
  if (!fs.existsSync(file))
    replaceJson(file, { revision: initialRevision, value: null, writes: 0 });
  return Object.freeze({
    /**
     * Canonical Ownerの現在Snapshotを読み取る。
     * @responsibility 四Surfaceが共有する現在Revisionと値を返す。
     * @trace ARCH-000010
     * @input N/A: 構築時にFileを固定済みである。
     * @returns 現在のCanonicalRecord。
     * @precondition Owner Fileが通常Fileとして存在する。
     * @postcondition Storeを変更せず同じSnapshotを返す。
     * @effect File metadataと本文を読取る。
     * @failure 不正FileまたはJSONを例外で拒否する。
     * @invariant Surface Identityによって返却値を変えない。
     * @boundary Canonical Owner Port→Filesystem Record。
     * @security Link先または別Rootを読まない。
     * @concurrency 呼出しごとに現在Fileを再読取りする。
     */
    inspect() {
      return readRegularJson<CanonicalRecord>(file);
    },
    /**
     * 期待Revision一致時だけCanonical Ownerを更新する。
     * @responsibility 値、Revisionおよびwrite countを一つの更新として確定する。
     * @trace ARCH-000010
     * @input 期待Revisionと新しい値。
     * @returns 更新成立ならtrue、競合ならfalse。
     * @precondition 入力Revisionは呼出し側が観測したSnapshotに由来する。
     * @postcondition true時だけRevisionとwritesが一つ進む。
     * @effect 成立時だけOwner Fileを置換する。
     * @failure Revision競合をfalse、不正Storeを例外で返す。
     * @invariant 競合時は既存値を変更しない。
     * @boundary Application Contract→Canonical Owner File。
     * @security Surface名から更新Authorityを生成しない。
     * @concurrency Revisionを更新直前に再読取りする。
     */
    apply(input: Readonly<{ revision: string; value: string }>) {
      const current = readRegularJson<CanonicalRecord>(file);
      if (current.revision !== input.revision) return false;
      replaceJson(file, {
        revision: `r${current.writes + 2}`,
        value: input.value,
        writes: current.writes + 1,
      });
      return true;
    },
  });
}

/**
 * Handoffを耐久Recordとして一度だけ保存する。
 *
 * @responsibility Source終了後にDestinationが同じIdentityを再観測できるRecordを作成する。
 * @trace ARCH-000015
 * @input file: Handoff File、handoff: Sourceが発行したRecord。
 * @returns N/A: 作成成功時に復帰する。
 * @precondition handoff.sourceActive=falseである。
 * @postcondition 同じFileを上書きせず、再読取り可能なJSONを一つ作成する。
 * @effect Handoff Fileを排他的に作成する。
 * @failure 既存FileまたはFilesystem失敗を例外で拒否する。
 * @invariant Handoff IdentityとAuthorityを変更しない。
 * @boundary Source Process→Durable Handoff File。
 * @security CredentialまたはHost環境値を追加しない。
 * @concurrency wxで重複発行を拒否する。
 */
export function writeDurableHandoff(
  storeRoot: FilesystemStoreRoot,
  relativePath: string,
  handoff: CrosHandoff,
): void {
  const file = resolveFilesystemStorePath(storeRoot, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(handoff)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
}

/**
 * 別ProcessでHandoffを一度だけ再開する。
 *
 * @responsibility 耐久Recordを読み、相関検証後にDestination Settlementを排他的に作成する。
 * @trace ARCH-000015
 * @input handoffFile: Record File、settlementFile: 一回性File、destination: 再開要求。
 * @returns resumeHandoffと同じ状態に重複拒否を加えた結果。
 * @precondition Source Processが終了しRecordを閉じている。
 * @postcondition resumed時だけSettlement Fileが一つ存在する。
 * @effect 正常再開時にSettlement Fileを排他的に作成する。
 * @failure 不一致、Authority拡大、重複または不正FileをEffect 0で拒否する。
 * @invariant Source Recordを変更せず同じhandoffIdを保持する。
 * @boundary Durable Handoff File→Destination Process→Settlement File。
 * @security SourceにないAuthorityを追加しない。
 * @concurrency wxによって同じHandoffの二重再開を拒否する。
 */
export function resumeDurableHandoff(
  storeRoot: FilesystemStoreRoot,
  handoffRelativePath: string,
  settlementRelativePath: string,
  destination: Parameters<typeof resumeHandoff>[1],
) {
  const handoffFile = resolveFilesystemStorePath(
    storeRoot,
    handoffRelativePath,
  );
  const settlementFile = resolveFilesystemStorePath(
    storeRoot,
    settlementRelativePath,
  );
  const handoff = readRegularJson<CrosHandoff>(handoffFile);
  const result = resumeHandoff(handoff, destination);
  if (result.status !== "resumed") return result;
  try {
    fs.writeFileSync(
      settlementFile,
      `${JSON.stringify({ handoffId: handoff.handoffId, settled: true })}\n`,
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    return result;
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      handoffId: handoff.handoffId,
      reason: "cros_handoff_context_mismatch" as const,
      destinationEffectIssued: false,
    });
  }
}

/**
 * 委譲結果を耐久Originへ一度だけ反映する。
 *
 * @responsibility 別Processから届いた結果をOrigin Snapshotと照合し、受入時だけSettlementを作成する。
 * @trace ARCH-000015
 * @input result: 委譲結果、originFile: Origin Snapshot、settlementDirectory: 適用済みResult領域。
 * @returns settleDelegatedResultの構造化結果。
 * @precondition Origin Snapshotは判断直前に読み取れる通常Fileである。
 * @postcondition accepted時だけResult IDに対応するSettlement Fileが一つ存在する。
 * @effect 正常な完成結果だけを排他的にSettlementへ記録する。
 * @failure 不正相関、競合、部分結果、再送または不正FileをEffect 0へ閉じる。
 * @invariant Resultを別Taskまたは別Revisionへ付け替えない。
 * @boundary Delegated Process→Durable Origin→Settlement Store。
 * @security 未許可のOrigin内容を結果へ複製しない。
 * @concurrency wxで同じResultの二重適用を拒否する。
 */
export function settleDurableDelegatedResult(
  result: DelegatedResult,
  storeRoot: FilesystemStoreRoot,
  originRelativePath: string,
  settlementDirectoryRelativePath: string,
) {
  const originFile = resolveFilesystemStorePath(storeRoot, originRelativePath);
  const settlementDirectory = resolveFilesystemStorePath(
    storeRoot,
    settlementDirectoryRelativePath,
  );
  const origin =
    readRegularJson<Parameters<typeof settleDelegatedResult>[1]>(originFile);
  fs.mkdirSync(settlementDirectory, { recursive: true, mode: 0o700 });
  const settlementFile = path.join(
    settlementDirectory,
    `${result.resultId}.json`,
  );
  const settled = new Set<string>();
  if (fs.existsSync(settlementFile)) settled.add(result.resultId);
  const resultState = settleDelegatedResult(result, origin, settled);
  if (resultState.status !== "accepted") return resultState;
  try {
    fs.writeFileSync(settlementFile, `${JSON.stringify(resultState)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    return resultState;
  } catch {
    return settleDelegatedResult(result, origin, new Set([result.resultId]));
  }
}
