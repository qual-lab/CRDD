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
import path from "node:path";

import type {
  CanonicalOperationOwner,
  DelegatedResult,
} from "./application-contract.ts";
import { settleDelegatedResult } from "./application-contract.ts";
import type { CrosHandoff } from "./runtime.ts";
import { resumeHandoff } from "./runtime.ts";

type CanonicalRecord = Readonly<{
  revision: string;
  value: string | null;
  writes: number;
}>;

function readRegularJson<T>(file: string): T {
  const metadata = fs.lstatSync(file);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("cros_durable_store_file_invalid");
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

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
  file: string,
  initialRevision: string,
): CanonicalOperationOwner {
  if (!fs.existsSync(file))
    replaceJson(file, { revision: initialRevision, value: null, writes: 0 });
  return Object.freeze({
    inspect() {
      return readRegularJson<CanonicalRecord>(file);
    },
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
export function writeDurableHandoff(file: string, handoff: CrosHandoff): void {
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
  handoffFile: string,
  settlementFile: string,
  destination: Parameters<typeof resumeHandoff>[1],
) {
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
  originFile: string,
  settlementDirectory: string,
) {
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
