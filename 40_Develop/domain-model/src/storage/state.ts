/**
 * 現在状態の固定ファイルに対する低水準I/Oを所有する。
 * @packageDocumentation
 * @responsibility 同じ取引の実体記録、通常ファイル検査、排他的作成と読戻しを提供する。
 * @trace ARCH-000008
 * @boundary 保存Ownerが検証した領域だけを受け、Root・認可・CAS・状態遷移を決定しない。
 * @security 呼出しごとに現在Ownerの照合を実行する。任意Snapshot保存APIではない。
 */
import fs from "node:fs";
import path from "node:path";
import {
  readStableBoundedFileSnapshot,
  sameStableFileIdentity,
  type StableFileIdentity,
} from "./bounded-file-snapshot.ts";

/**
 * Coordinator現在状態の保存途中から予定できる次処置を分類する。
 *
 * @responsibility 元版・次版のexact内容結合と初回条件を照合し、不明な状態を停止へ分類する。
 * @trace ARCH-000008
 * @input current: 正規Fileの閉じた観測、pending: 検証済みSnapshotの版・結合・exact bytes Hash、repositoryBinding: 期待するRepository結合、rootState: 初回Root条件の観測。
 * @returns publish_pending、remove_pendingまたはblockedという処置候補を返す。
 * @precondition 呼出し側がSnapshot全体を検証し、Hashをexact UTF-8 bytesから取得している。
 * @postcondition 元版結合または確定済み同内容の確認なしに処置候補を返さない。
 * @effect N/A: File、Lock、Process、Dockerを操作しない純粋な判定である。
 * @failure 不正な版、結合差、同版異内容、既知元版喪失、観測不能はblockedへ分類する。
 * @invariant 正規Fileの観測不能を不存在へ変換せず、履歴から旧状態を復元しない。
 * @boundary 検証済みSnapshotのIdentityと再入場処置候補の境界。全Snapshotの妥当性検証は所有しない。
 * @security 返却値は保存・削除・次EffectのAuthorityでも、cleanup成立の証明でもない。
 * @concurrency N/A: 排他を取得しない。利用側が同じ短期排他内でfresh観測と実処置を所有する。
 */
export function classifyRuntimeSnapshotReentry(
  current:
    | Readonly<{
        status: "present";
        revision: number;
        repositoryBinding: string;
        payloadSha256: string;
      }>
    | Readonly<{ status: "absent" }>
    | Readonly<{ status: "unknown" }>,
  pending: Readonly<{
    revision: number;
    previous: Readonly<{ revision: number; payloadSha256: string }> | null;
    repositoryBinding: string;
    payloadSha256: string;
  }>,
  repositoryBinding: string,
  rootState: "new" | "existing" | "unknown",
) {
  if (
    repositoryBinding.length === 0 ||
    pending.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(pending.revision) ||
    pending.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(pending.payloadSha256) ||
    (pending.previous === null
      ? pending.revision !== 1
      : !Number.isSafeInteger(pending.previous.revision) ||
        pending.previous.revision < 1 ||
        pending.previous.revision >= Number.MAX_SAFE_INTEGER ||
        pending.revision !== pending.previous.revision + 1 ||
        !/^[a-f0-9]{64}$/.test(pending.previous.payloadSha256))
  )
    return "blocked" as const;
  if (current.status === "unknown" || rootState === "unknown")
    return "blocked" as const;
  if (current.status === "absent")
    return pending.previous === null && rootState === "new"
      ? ("publish_pending" as const)
      : ("blocked" as const);
  if (
    current.repositoryBinding !== repositoryBinding ||
    !Number.isSafeInteger(current.revision) ||
    current.revision < 1 ||
    !/^[a-f0-9]{64}$/.test(current.payloadSha256)
  )
    return "blocked" as const;
  if (
    current.revision === pending.revision &&
    current.payloadSha256 === pending.payloadSha256
  )
    return "remove_pending" as const;
  if (
    pending.previous !== null &&
    current.revision === pending.previous.revision &&
    current.payloadSha256 === pending.previous.payloadSha256
  )
    return "publish_pending" as const;
  return "blocked" as const;
}

/** 固定保存ファイルの閉集合。 */
export type RuntimeStateFileName =
  | "state.json"
  | "state.pending.json"
  | "state.lock"
  | "history.jsonl"
  | "history.pending.jsonl";

/** 確定前の排他的作成を許す閉集合。 */
export type RuntimeStatePendingFileName =
  | "state.pending.json"
  | "state.lock"
  | "history.pending.jsonl";

/**
 * 同じ取引で観測した固定ファイルの実体と本文を読む。
 * @responsibility 観測不能と明示不存在、置換と同一実体を区別する。
 * @trace ARCH-000008
 * @input 検証済みdirectory、固定name、同じ取引のidentities、容量上限と現在Owner照合。
 * @returns 安定したbyte又は初回の明示不存在null。
 * @precondition 呼出し側が短期排他を保持し、Mapを取引全体で共有する。
 * @postcondition 同名置換・既観測ファイルの消失を拒否する。
 * @effect metadataと本文を読み、既存Mapへ実体を記録する。
 * @failure 不正名・link・過大・置換・I/O故障は例外。nullへ畳まない。
 * @invariant 元の照合順序・例外・容量を保持する。
 * @boundary 保存OwnerとFilesystem。領域を作成しない。
 * @security nameは型だけでなく実行時にも検査する。
 * @concurrency 呼出し前後のassertBoundaryを省略・キャッシュしない。
 */
export function readRuntimeStateFile(
  directory: string,
  name: RuntimeStateFileName,
  identities: Map<string, StableFileIdentity>,
  maximumBytes: number,
  assertBoundary: () => void,
): Buffer | null {
  if (
    ![
      "state.json",
      "state.pending.json",
      "state.lock",
      "history.jsonl",
      "history.pending.jsonl",
    ].includes(name)
  )
    throw new Error("state_file_name_invalid");
  assertBoundary();
  const file = path.join(directory, name);
  let metadata: fs.Stats;
  try {
    metadata = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (identities.has(name)) throw new Error("file_disappeared");
    assertBoundary();
    return null;
  }
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1)
    throw new Error("file");
  const observed = readStableBoundedFileSnapshot(file, maximumBytes);
  const expected = identities.get(name);
  if (expected && !sameStableFileIdentity(expected, observed.identity))
    throw new Error("file_replaced");
  identities.set(name, observed.identity);
  if (fs.lstatSync(file).nlink !== 1) throw new Error("links");
  assertBoundary();
  return observed.bytes;
}

/**
 * 固定された確定前ファイルを排他的に作成・flush・読戻しする。
 * @responsibility Effect発行前記録、wx、fsync、closeとexact byte確認を保持する。
 * @trace ARCH-000008
 * @input 同じ検証済み領域・Map・Owner照合と作成本文、Effect記録callback。
 * @returns 成功時はvoid。保存全体の成立・CAS成立は宣言しない。
 * @precondition 同じ短期排他を保持し、上位が失敗時の元回復参照を保全する。
 * @postcondition 既存ファイルを上書きせず、同じReaderで本文を再確認する。
 * @effect markEffect後にwx作成・書込み・flush・closeを行う。
 * @failure open・write・fsync・close・読戻し失敗を伝播し、残存を自動削除しない。
 * @invariant 作成失敗時も発行済みEffect記録を戻さない。
 * @boundary 保存OwnerとFilesystem。業務Schema・Authorityは解釈しない。
 * @security 任意ファイル名・正本の直接上書きを受け付けない。
 * @concurrency 同じMapと動的なassertBoundaryを読戻しにも使用する。
 */
export function createRuntimeStatePendingFile(
  directory: string,
  name: RuntimeStatePendingFileName,
  content: Buffer,
  identities: Map<string, StableFileIdentity>,
  maximumBytes: number,
  assertBoundary: () => void,
  markEffect: () => void,
): void {
  if (
    !["state.pending.json", "state.lock", "history.pending.jsonl"].includes(
      name,
    )
  )
    throw new Error("state_pending_file_name_invalid");
  assertBoundary();
  markEffect();
  const fd = fs.openSync(path.join(directory, name), "wx", 0o600);
  try {
    fs.writeFileSync(fd, content);
    fs.fsyncSync(fd);
    identities.set(name, fs.fstatSync(fd, { bigint: true }));
  } finally {
    fs.closeSync(fd);
  }
  const saved = readRuntimeStateFile(
    directory,
    name,
    identities,
    maximumBytes,
    assertBoundary,
  );
  if (!saved?.equals(content)) throw new Error("readback");
}

/**
 * 出版直前の固定ファイルを同じ実体のdescriptorでflushする。
 * @responsibility 三つの既存出版箇所の照合・発行記録・closeの順序を保持する。
 * @trace ARCH-000008
 * @input 検証済み領域、固定対象名、同じ取引の実体Mapと既存Ownerの照合・発行記録。
 * @returns 成功時void。Snapshot確定や履歴成立は宣言しない。
 * @precondition 呼出し側が短期排他を保持し、本文と出版条件を確認済みである。
 * @postcondition 同じ実体をflushし、open成功時は必ずcloseを試みる。
 * @effect 履歴はfsync直前に発行記録する。状態pendingは既存作成時の記録を利用する。
 * @failure 欠測・置換・Owner失効とI/O例外を伝播し、自動清掃・再試行しない。
 * @invariant 対象ごとの期待Identity取得時点とOwner照合時点を変更しない。
 * @boundary 物理保存のみ。状態判断・CAS・一回使用証拠を解釈しない。
 * @security 対象名は実行時にも閉集合として検査する。
 * @concurrency 現在取引のMapとOwnerを使い、事前観測をキャッシュしない。
 */
export function flushRuntimeStateFile(
  directory: string,
  name: "history.pending.jsonl" | "history.jsonl" | "state.pending.json",
  identities: Map<string, StableFileIdentity>,
  assertBoundary: () => void,
  markEffect: () => void,
): void {
  if (
    name !== "history.pending.jsonl" &&
    name !== "history.jsonl" &&
    name !== "state.pending.json"
  )
    throw new Error("state_flush_file_name_invalid");
  // 正本履歴だけは従来どおりopen前の期待実体を固定する。
  const canonicalIdentity =
    name === "history.jsonl" ? identities.get(name) : undefined;
  if (name !== "history.jsonl") assertBoundary();
  const descriptor = fs.openSync(path.join(directory, name), "r+");
  try {
    const expected =
      name === "history.jsonl" ? canonicalIdentity : identities.get(name);
    if (
      !expected ||
      !sameStableFileIdentity(
        expected,
        fs.fstatSync(descriptor, { bigint: true }),
      )
    )
      throw new Error(
        name === "history.jsonl"
          ? "history_canonical_replaced"
          : name === "history.pending.jsonl"
            ? "history_pending_replaced"
            : "pending_replaced",
      );
    if (name === "history.jsonl") assertBoundary();
    if (name !== "state.pending.json") markEffect();
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}
