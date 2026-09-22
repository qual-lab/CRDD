/**
 * 公式素材判断をAuthority Adapterと耐久Storeへ接続する。
 *
 * @packageDocumentation
 * @responsibility 判断Authority、Domain遷移およびRecord比較交換を一つのApplication境界で実行する。
 * @trace ARCH-000017
 * @boundary 判断主体→Authority Port→Official Asset Store。
 * @effect 許可済みかつRevision一致の判断だけをStoreへ一回反映する。
 * @security Authority未確認ではStoreを変更しない。
 */
import fs from "node:fs";
import path from "node:path";

import {
  resolveFilesystemStorePath,
  withFilesystemStoreLock,
  type FilesystemStoreRoot,
} from "../../crdd-domain-library/src/filesystem-store-root/index.ts";

import {
  applyOfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetDecisionResult,
  type OfficialAssetRecord,
} from "./official-asset-governance.ts";

/**
 * 公式素材判断のAuthority確認Portを定義する。
 *
 * @responsibility 判断入力を、外部で管理された判断Authorityへ照合する。
 * @trace ARCH-000017
 * @shape 判断入力を受け取る検証関数だけを持つ。
 * @invariant trueは当該判断入力に対するAuthority確認だけを表す。
 * @boundary Official Asset Applicationと判断Authorityの境界。
 * @security 判断内容や呼出し元IdentityからAuthorityを推測しない。
 * @compatibility 実Authority方式を公開型へ固定しない。
 */
export type OfficialAssetAuthorityPort = Readonly<{
  verify(input: OfficialAssetDecisionInput): boolean;
}>;

/**
 * 公式素材Recordの耐久Store契約を定義する。
 *
 * @responsibility 現行Recordの読取りとRevision付き比較交換を提供する。
 * @trace ARCH-000017
 * @shape readとcompareAndSetだけを持つ。
 * @invariant 比較交換は期待Revision一致時だけ成功する。
 * @boundary Official Asset Applicationと耐久Storeの境界。
 * @security Authority判定をStore内部で生成しない。
 * @compatibility Filesystem等の保存方式を公開契約へ固定しない。
 */
export type OfficialAssetStore = Readonly<{
  read(): OfficialAssetRecord;
  compareAndSet(expectedRevision: number, next: OfficialAssetRecord): boolean;
}>;

/**
 * File-backedな公式素材Storeを作成する。
 *
 * @responsibility 一つの素材Recordを通常Fileへ保存しRevision比較交換を所有する。
 * @trace ARCH-000017
 * @input file: Store File、initial: 初期素材Record。
 * @returns 読取りと比較交換を持つOfficialAssetStore。
 * @precondition fileは許可済みTest／Runtime Root内である。
 * @postcondition 初回だけinitialを作成し、以後は同じFileを利用する。
 * @effect compareAndSet成功時だけFileを置換する。
 * @failure Link、不正File、JSONまたはRevision競合を例外またはfalseで拒否する。
 * @invariant recordRevisionはStoreで再観測した値と一致するときだけ進む。
 * @boundary Official Asset Application→Filesystem Store。
 * @security Symbolic LinkをStoreとして利用しない。
 * @concurrency 更新直前の再読取りにより古いRevisionを拒否する。
 */
export function createFileOfficialAssetStore(
  storeRoot: FilesystemStoreRoot,
  relativePath: string,
  initial: OfficialAssetRecord,
): OfficialAssetStore {
  const file = resolveFilesystemStorePath(storeRoot, relativePath);
  const lockRelativePath = `${relativePath}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(file))
    fs.writeFileSync(file, `${JSON.stringify(initial)}\n`, {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  const read = () => {
    const metadata = fs.lstatSync(file);
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error("official_asset_store_invalid");
    return JSON.parse(fs.readFileSync(file, "utf8")) as OfficialAssetRecord;
  };
  return Object.freeze({
    read,
    /**
     * 期待Revisionに一致する公式素材Recordを置換する。
     *
     * @responsibility 跨Process排他区間でread-check-writeを一回実行する。
     * @trace ARCH-000017
     * @input 期待Revisionと次の公式素材Record。
     * @returns 更新成功時true、競合またはLock未取得時false。
     * @precondition 次RecordはDomain判断済みである。
     * @postcondition true時は再読取りで次Recordを観測できる。
     * @effect true時だけStore Fileを一回置換する。
     * @failure 競合またはLock未取得をfalseで拒否する。
     * @invariant read-check-write全体を同じKernel Lock内で行う。
     * @boundary Application RecordとFilesystem Storeの境界。
     * @security Root Capability外へ書き込まない。
     * @concurrency 跨Process Lockにより同時更新を直列化する。
     */
    compareAndSet(expectedRevision, next) {
      const locked = withFilesystemStoreLock(
        storeRoot,
        lockRelativePath,
        () => {
          if (read().recordRevision !== expectedRevision) return false;
          const temporary = `${file}.${process.pid}.tmp`;
          fs.writeFileSync(temporary, `${JSON.stringify(next)}\n`, {
            encoding: "utf8",
            flag: "wx",
            mode: 0o600,
          });
          fs.renameSync(temporary, file);
          return true;
        },
      );
      return locked.acquired ? locked.value : false;
    },
  });
}

/**
 * 公式素材判断をAuthority確認後に耐久Storeへ反映する。
 *
 * @responsibility Authority、完全入力、Domain遷移およびRevision比較交換を順に実行する。
 * @trace ARCH-000017
 * @input store: 公式素材Store、authority: 判断Authority Port、input: 判断入力。
 * @returns Domain結果またはAuthority／Store競合拒否。
 * @precondition StoreとAuthorityは同じ素材判断境界へ構成されている。
 * @postcondition completed時はStore再読取りで更新Recordを確認できる。
 * @effect Authority確認済みかつ比較交換成功時だけStoreを一回更新する。
 * @failure Authority不足または競合をEffect 0で拒否する。
 * @invariant 判断値だけからAuthorityを推定しない。
 * @boundary Decision Request→Authority Port→Domain→Store Writer。
 * @security 未許可判断ではRecord内容を変更しない。
 * @concurrency Store比較交換で後着の古い判断を拒否する。
 */
export function executeOfficialAssetDecision(
  store: OfficialAssetStore,
  authority: OfficialAssetAuthorityPort,
  input: OfficialAssetDecisionInput,
): OfficialAssetDecisionResult {
  const current = store.read();
  if (!authority.verify(input))
    return Object.freeze({
      status: "blocked" as const,
      reason: "official_asset_decision_authority_invalid" as const,
      currentRecordRevision: current.recordRevision,
      storeEffectIssued: false as const,
    });
  const decision = applyOfficialAssetDecision(current, input);
  if (decision.status !== "completed") return decision;
  if (!store.compareAndSet(current.recordRevision, decision.record))
    return Object.freeze({
      status: "blocked" as const,
      reason: "official_asset_decision_revision_conflict" as const,
      currentRecordRevision: store.read().recordRevision,
      storeEffectIssued: false as const,
    });
  return decision;
}
