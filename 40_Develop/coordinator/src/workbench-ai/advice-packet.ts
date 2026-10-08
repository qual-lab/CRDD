/**
 * Workbench助言を署名Provider Runtimeへ一回だけ搬送するPacketを所有する。
 *
 * @packageDocumentation
 * @responsibility 検証済みPrompt、Task Identity、ProfileおよびProvider Command Identityを一回消費Capabilityへ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Workbench助言Executorと署名Provider Runtime lifecycleの間。
 * @effect Packet発行・消費・取消はProcess内の一時状態だけを変更し、Provider Effectを発行しない。
 * @security Repository内容や任意Commandを追加せず、受理済みPromptと固定Command Hashだけを搬送する。
 */
import { createHash, randomBytes } from "node:crypto";

import type { WorkbenchAiAdviceProviderCommand } from "../../../ai-adapter/src/index.ts";

export const WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-runtime-packet";
export const WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION = 1;

const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const MAXIMUM_PROMPT_BYTES = 512 * 1024;
const COMMAND_KEYS = Object.freeze([
  "argv",
  "command",
  "contract",
  "contractRevision",
  "environment",
  "exactModelId",
  "fixedImageDigest",
  "promptTransport",
  "provider",
  "providerHomeMountRequired",
  "reasoningEffort",
  "repositoryMounted",
  "resultTransport",
  "sessionPersistenceAllowed",
  "toolsAllowed",
  "workspaceMountRequired",
] as const);

/**
 * 署名Runtimeへ一回搬送するWorkbench助言Packetを表す。
 *
 * @responsibility PromptとProvider Commandを同じTask・Projection・Profile・Operationへ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape 固定Contract、Identity、Prompt、Command Hashおよび非共有境界からなる読取り専用値である。
 * @invariant Repository／Workspace共有、Tool、SessionおよびFallbackを許可しない。
 * @boundary Provider非依存Executorと署名Runtime Adapterの間。
 * @security Prompt本文以外のRepository情報や任意Pathを含めない。
 * @compatibility contractRevision 1だけを受理する。
 */
export type WorkbenchAiAdviceRuntimePacket = Readonly<{
  contract: typeof WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT;
  contractRevision: typeof WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION;
  packetRef: string;
  operationId: string;
  profileId: string;
  provider: "codex" | "claude";
  taskHash: string;
  projectionHash: string;
  commandHash: string;
  packetHash: string;
  providerCommand: WorkbenchAiAdviceProviderCommand;
  providerPrompt: string;
  repositoryMounted: false;
  workspaceMounted: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
}>;

/**
 * Workbench助言Runtime Packetの発行入力を表す。
 *
 * @responsibility 上位で検証済みのIdentity、PromptおよびProvider Commandを発行境界へ渡す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @shape Operation、Profile、Task、Projection、Promptおよび固定Commandからなる読取り専用値である。
 * @invariant Provider Commandとproviderは一致する。
 * @boundary Workbench助言計画と一回消費Packet発行の間。
 * @security Repository Path、Workspace PathおよびCredentialを入力へ含めない。
 * @compatibility revision 1のPacket発行だけで使用する。
 */
export type WorkbenchAiAdviceRuntimePacketInput = Readonly<{
  operationId: string;
  profileId: string;
  provider: "codex" | "claude";
  taskHash: string;
  projectionHash: string;
  providerPrompt: string;
  providerCommand: WorkbenchAiAdviceProviderCommand;
}>;

/**
 * Workbench助言Runtime Packetの一回消費境界で使用するPacketRecordの構造を固定する。
 *
 * @responsibility Workbench助言Runtime Packetの一回消費境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type PacketRecord = Readonly<{
  ownerCapability: object;
  useCapability: object;
  packet: WorkbenchAiAdviceRuntimePacket;
}>;

/**
 * Workbench助言Runtime Packetの一回消費境界で使用するRuntimeStateの構造を固定する。
 *
 * @responsibility Workbench助言Runtime Packetの一回消費境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type RuntimeState = Readonly<{
  owners: WeakMap<object, PacketRecord>;
  uses: WeakMap<object, PacketRecord>;
  randomHex: (bytes: number) => string;
}>;

/**
 * Workbench助言Runtime Packet状態を生成する。
 *
 * @responsibility 所有Capabilityと一回消費Capabilityの対応を閉じたメモリ状態へ保持する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input randomHex: Packet参照用の暗号学的乱数生成関数。
 * @returns 発行・消費・取消に使用するRuntime状態を返す。
 * @precondition randomHexは指定Byte数に対応する小文字16進文字列を返す。
 * @postcondition 生成直後のCapability集合は空である。
 * @effect N/A: 空のWeakMapを生成するだけで外部Effectを発行しない。
 * @failure N/A: 呼出し時の入力検査は発行処理が所有する。
 * @invariant 所有記録と利用記録は同じPacketRecordを参照する。
 * @boundary Process内の一時Authority状態境界。
 * @security Capability Objectを外部識別子の代用として公開しない。
 * @concurrency 発行・消費・取消は各同期呼出し内で完了する。
 */
function createState(randomHex: (bytes: number) => string): RuntimeState {
  return Object.freeze({
    owners: new WeakMap(),
    uses: new WeakMap(),
    randomHex,
  });
}

const productionState = createState((bytes) =>
  randomBytes(bytes).toString("hex"),
);

/**
 * Workbench助言Runtime Packetを発行する。
 *
 * @responsibility 検証済み助言入力をCommand Hash付きの一回消費Packetへ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: 助言計画由来のOperation、Profile、Task、Projection、PromptおよびProvider Command。
 * @returns 発行成功時はPacket参照、所有Capability、利用Capabilityを返し、不正時はEffect 0でblockedを返す。
 * @precondition 上位ExecutorはProfile Catalogと実行計画の整合を確認済みである。
 * @postcondition issuedの場合、同じuseCapabilityは最大一回だけPacketへ交換できる。
 * @effect Process内WeakMapへ一つのPacketRecordを登録する。
 * @failure Identity、Prompt、Commandまたは非共有境界が不正なら記録を作らない。
 * @invariant Provider Effect、Filesystem Effectおよび外部送信Authorityをこの発行だけで生成しない。
 * @boundary 検証済み実行計画と署名Runtimeの一回消費入力境界。
 * @security Promptを公開結果へ含めず、固定Commandの完全性をHashで結合する。
 * @concurrency Capability生成と二つのWeakMap登録を同じ同期呼出しで完了する。
 */
export function issueRuntimeOwnedWorkbenchAiAdvicePacket(
  input: WorkbenchAiAdviceRuntimePacketInput,
) {
  return issue(productionState, input);
}

/**
 * Workbench助言Runtime Packetを一回消費する。
 *
 * @responsibility 未消費の利用Capabilityと所有Capabilityが同じ記録を指す場合だけPacketを返す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input useCapability: 一回消費Capability、ownerCapability: 発行側の所有Capability。
 * @returns 成立時はPacket、再利用・Identity不一致・未知Capabilityではnullを返す。
 * @precondition Capabilityは同じProcess内の発行結果から取得する。
 * @postcondition 成立時は所有・利用の両記録を削除し再消費できない。
 * @effect Process内WeakMapから対応記録を削除する。
 * @failure 不正または消費済みCapabilityをnullへ閉じる。
 * @invariant 別の所有CapabilityでPacketを消費できない。
 * @boundary 一回消費Authorityと署名Runtime Adapterの入力境界。
 * @security Packet参照文字列だけではPromptを取得できない。
 * @concurrency 照合と削除を同じ同期呼出しで完了する。
 */
export function consumeRuntimeOwnedWorkbenchAiAdvicePacket(
  useCapability: unknown,
  ownerCapability: unknown,
) {
  return consume(productionState, useCapability, ownerCapability);
}

/**
 * 未消費のWorkbench助言Runtime Packetを取り消す。
 *
 * @responsibility 発行側が保持する所有Capabilityで未使用Packetを失効させる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input ownerCapability: 発行結果の所有Capability。
 * @returns 今回の取消が成立した場合だけtrueを返す。
 * @precondition Provider Effect開始後の取消は実行Lifecycleが所有する。
 * @postcondition trueの場合、対応useCapabilityからPacketを取得できない。
 * @effect Process内WeakMapから対応記録を削除する。
 * @failure 未知・消費済みCapabilityはfalseを返す。
 * @invariant Provider Processや外部資源を操作しない。
 * @boundary Packet未使用状態とProvider Runtime実行状態の間。
 * @security Promptを取消結果へ含めない。
 * @concurrency 照合と削除を同じ同期呼出しで完了する。
 */
export function revokeRuntimeOwnedWorkbenchAiAdvicePacket(
  ownerCapability: unknown,
) {
  return revoke(productionState, ownerCapability);
}

/**
 * Workbench助言Runtime Packetの公開契約を返す。
 *
 * @responsibility 一回消費、非共有境界、Prompt上限およびEffect 0を利用側へ示す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定契約だけを参照する。
 * @returns revision 1の固定契約を返す。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition 実装と試験が同じPacket境界を参照できる。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Packet発行をProvider Effect Authorityと表現しない。
 * @boundary 公開契約とRuntime利用側の間。
 * @security Prompt、Command引数およびCapabilityを含めない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
export function describeWorkbenchAiAdviceRuntimePacketContract() {
  return Object.freeze({
    contract: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION,
    maximumPromptBytes: MAXIMUM_PROMPT_BYTES,
    singleUse: true,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    providerEffectIssuedByPacket: false,
  });
}

/**
 * 指定状態へWorkbench助言Runtime Packetを登録する。
 *
 * @responsibility 公開発行処理と試験可能な状態操作の共通実装を所有する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input state: Packet Runtime状態、input: 発行候補。
 * @returns issuedまたはEffect 0のblocked結果を返す。
 * @precondition stateはcreateStateで生成されている。
 * @postcondition issuedの場合だけ所有・利用の両Mapに同じ記録が存在する。
 * @effect Process内WeakMapへ記録を追加する。
 * @failure 不正入力または不正乱数をblockedへ閉じる。
 * @invariant 外部Effectを発行しない。
 * @boundary 発行候補と一回消費Capabilityの間。
 * @security Promptを戻り値へ含めない。
 * @concurrency 登録を単一同期呼出しで完了する。
 */
function issue(
  state: RuntimeState,
  input: WorkbenchAiAdviceRuntimePacketInput,
) {
  let providerCommand: WorkbenchAiAdviceProviderCommand | null = null;
  let commandHash: string | null = null;
  let token: string | null = null;
  try {
    providerCommand = snapshotCommand(input.providerCommand);
    commandHash = providerCommand ? hashCommand(providerCommand) : null;
    token = state.randomHex(16);
  } catch {
    providerCommand = null;
  }
  if (
    !providerCommand ||
    !validInput(input, providerCommand) ||
    !commandHash ||
    !token ||
    !/^[a-f0-9]{32}$/u.test(token)
  )
    return Object.freeze({
      status: "blocked" as const,
      reason: "workbench_ai_advice_runtime_packet_invalid" as const,
      packetRef: null,
      ownerCapability: null,
      useCapability: null,
      providerEffectIssued: false as const,
    });
  const ownerCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const packetRef = `ADVICEPKT-${token.toUpperCase()}`;
  const packetHash = createHash("sha256")
    .update(
      JSON.stringify({
        contract: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT,
        contractRevision: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION,
        packetRef,
        operationId: input.operationId,
        profileId: input.profileId,
        provider: input.provider,
        taskHash: input.taskHash,
        projectionHash: input.projectionHash,
        commandHash,
        providerPromptSha256: createHash("sha256")
          .update(input.providerPrompt, "utf8")
          .digest("hex"),
        repositoryMounted: false,
        workspaceMounted: false,
        toolsAllowed: false,
        sessionPersistenceAllowed: false,
      }),
      "utf8",
    )
    .digest("hex");
  const packet = Object.freeze({
    contract: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_RUNTIME_PACKET_CONTRACT_REVISION,
    packetRef,
    operationId: input.operationId,
    profileId: input.profileId,
    provider: input.provider,
    taskHash: input.taskHash,
    projectionHash: input.projectionHash,
    commandHash,
    packetHash,
    providerCommand,
    providerPrompt: input.providerPrompt,
    repositoryMounted: false as const,
    workspaceMounted: false as const,
    toolsAllowed: false as const,
    sessionPersistenceAllowed: false as const,
  }) satisfies WorkbenchAiAdviceRuntimePacket;
  const record = Object.freeze({ ownerCapability, useCapability, packet });
  state.owners.set(ownerCapability, record);
  state.uses.set(useCapability, record);
  return Object.freeze({
    status: "issued" as const,
    reason: null,
    packetRef,
    ownerCapability,
    useCapability,
    providerEffectIssued: false as const,
  });
}

/**
 * 指定状態からWorkbench助言Runtime Packetを一回消費する。
 *
 * @responsibility 所有・利用Capabilityの同一記録照合と不可逆な消費を共通実装する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input state: Packet Runtime状態、useCapability: 利用Capability、ownerCapability: 所有Capability。
 * @returns 成立時はPacket、不成立時はnullを返す。
 * @precondition CapabilityはObject Identityで比較する。
 * @postcondition Packet返却後は同じ記録が両Mapに残らない。
 * @effect Process内WeakMapから記録を削除する。
 * @failure 未知・不一致・消費済みCapabilityをnullへ閉じる。
 * @invariant 片側だけ一致する記録を返さない。
 * @boundary 一回消費CapabilityとRuntime Packetの間。
 * @security 文字列Identityだけで消費を許可しない。
 * @concurrency 照合と削除を単一同期呼出しで完了する。
 */
function consume(
  state: RuntimeState,
  useCapability: unknown,
  ownerCapability: unknown,
) {
  if (
    !useCapability ||
    typeof useCapability !== "object" ||
    !ownerCapability ||
    typeof ownerCapability !== "object"
  )
    return null;
  const byUse = state.uses.get(useCapability);
  const byOwner = state.owners.get(ownerCapability);
  if (!byUse || byUse !== byOwner) return null;
  state.uses.delete(byUse.useCapability);
  state.owners.delete(byUse.ownerCapability);
  return byUse.packet;
}

/**
 * 指定状態の未消費Packetを失効させる。
 *
 * @responsibility 所有Capabilityによる未使用Packet取消を共通実装する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input state: Packet Runtime状態、ownerCapability: 所有Capability。
 * @returns 今回削除した場合だけtrueを返す。
 * @precondition ownerCapabilityを信頼済みとは仮定しない。
 * @postcondition trueの場合は対応記録が両Mapに残らない。
 * @effect Process内WeakMapから記録を削除する。
 * @failure 未知・消費済みCapabilityをfalseへ閉じる。
 * @invariant 外部資源を操作しない。
 * @boundary Packet所有状態と失効状態の間。
 * @security Promptを結果へ含めない。
 * @concurrency 照合と削除を単一同期呼出しで完了する。
 */
function revoke(state: RuntimeState, ownerCapability: unknown) {
  if (!ownerCapability || typeof ownerCapability !== "object") return false;
  const record = state.owners.get(ownerCapability);
  if (!record) return false;
  state.owners.delete(record.ownerCapability);
  state.uses.delete(record.useCapability);
  return true;
}

/**
 * Workbench助言Runtime Packet発行入力を検証する。
 *
 * @responsibility Identity、上限およびProvider Commandの非共有条件を一括評価する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Packet発行候補。
 * @returns 固定条件をすべて満たす場合だけtrueを返す。
 * @precondition inputの型宣言だけを信頼せず実値を検査する。
 * @postcondition trueの場合はPromptとCommandをPacketへ固定できる。
 * @effect N/A: 値の読取りだけを行う。
 * @failure 不正値をfalseへ閉じる。
 * @invariant Repository／Workspace共有、Tool、Sessionを許可しない。
 * @boundary 型付き入力と実行可能Packetの間。
 * @security PathやCredentialを補完しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function validInput(
  input: WorkbenchAiAdviceRuntimePacketInput,
  providerCommand: WorkbenchAiAdviceProviderCommand,
) {
  return (
    OPERATION_ID.test(input.operationId) &&
    PROFILE_ID.test(input.profileId) &&
    SHA256.test(input.taskHash) &&
    SHA256.test(input.projectionHash) &&
    input.providerPrompt.trim() === input.providerPrompt &&
    input.providerPrompt.length > 0 &&
    !input.providerPrompt.includes("\0") &&
    Buffer.byteLength(input.providerPrompt, "utf8") <= MAXIMUM_PROMPT_BYTES &&
    providerCommand.provider === input.provider &&
    providerCommand.promptTransport === "stdin_only" &&
    providerCommand.repositoryMounted === false &&
    providerCommand.workspaceMountRequired === false &&
    providerCommand.toolsAllowed === false &&
    providerCommand.sessionPersistenceAllowed === false
  );
}

/**
 * Provider Commandをexactな不変Snapshotへ変換する。
 *
 * @responsibility 未知Property、getter、可変配列および可変Environment参照をPacketへ持ち込まない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: Provider Command候補。
 * @returns exact Schemaを満たす不変Snapshot、不正時はnullを返す。
 * @precondition 型宣言やObject凍結状態を信頼しない。
 * @postcondition 戻り値のargv、environmentおよび外側Objectは凍結されている。
 * @effect N/A: 値を検査して複製するだけである。
 * @failure 未知Key、custom prototype、getter、非文字列引数または環境値をnullへ閉じる。
 * @invariant 元Objectを変更してもSnapshotは変化しない。
 * @boundary 上位計画のCommand ObjectとRuntime Packetの間。
 * @security 任意Propertyや遅延getterをEffect直前境界へ持ち込まない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
function snapshotCommand(command: WorkbenchAiAdviceProviderCommand) {
  if (
    !plainExactRecord(command, COMMAND_KEYS) ||
    !Array.isArray(command.argv) ||
    command.argv.length === 0 ||
    !command.argv.every(
      (value) =>
        typeof value === "string" && value.length > 0 && !value.includes("\0"),
    ) ||
    !plainStringRecord(command.environment)
  )
    return null;
  return Object.freeze({
    contract: command.contract,
    contractRevision: command.contractRevision,
    provider: command.provider,
    command: command.command,
    argv: Object.freeze([...command.argv]),
    environment: Object.freeze({ ...command.environment }),
    fixedImageDigest: command.fixedImageDigest,
    exactModelId: command.exactModelId,
    reasoningEffort: command.reasoningEffort,
    promptTransport: command.promptTransport,
    resultTransport: command.resultTransport,
    providerHomeMountRequired: command.providerHomeMountRequired,
    repositoryMounted: command.repositoryMounted,
    workspaceMountRequired: command.workspaceMountRequired,
    toolsAllowed: command.toolsAllowed,
    sessionPersistenceAllowed: command.sessionPersistenceAllowed,
  }) as WorkbenchAiAdviceProviderCommand;
}

/**
 * 候補Objectが指定Keyだけをdata propertyとして持つか判定する。
 *
 * @responsibility custom prototype、余分Key、欠落Keyおよびgetterを拒否する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input value: Object候補、keys: 許可Key集合。
 * @returns exactな通常Objectの場合だけtrueを返す。
 * @precondition keysは重複しない固定配列である。
 * @postcondition trueの場合は全Keyがenumerableなdata propertyである。
 * @effect N/A: Property Descriptorを観測するだけである。
 * @failure 不正Objectをfalseへ閉じる。
 * @invariant getterを評価しない。
 * @boundary 未信頼ObjectとPacket Snapshotの間。
 * @security prototype汚染や副作用getterを受理しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function plainExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Object.keys(descriptors).sort();
  const expectedKeys = [...keys].sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    expectedKeys.every((key) => {
      const descriptor = descriptors[key];
      return (
        descriptor !== undefined &&
        Object.hasOwn(descriptor, "value") &&
        descriptor.get === undefined &&
        descriptor.set === undefined &&
        descriptor.enumerable === true
      );
    })
  );
}

/**
 * Environment候補を通常文字列Recordとして判定する。
 *
 * @responsibility Environmentのprototype、data propertyおよび文字列値だけを許可する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input value: Environment候補。
 * @returns 通常Objectの全enumerable data propertyが安全な文字列ならtrueを返す。
 * @precondition 任意のunknown値を受け取る。
 * @postcondition trueの場合はspreadで副作用なくSnapshot化できる。
 * @effect N/A: Property Descriptorを観測するだけである。
 * @failure getter、custom prototype、NULまたは非文字列値をfalseへ閉じる。
 * @invariant Environment名や値を補正しない。
 * @boundary Provider Command環境とRuntime Packetの間。
 * @security 遅延getterおよびNULを受理しない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function plainStringRecord(value: unknown): value is Record<string, string> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) =>
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      descriptor.enumerable === true &&
      typeof descriptor.value === "string" &&
      !descriptor.value.includes("\0"),
  );
}

/**
 * Provider Commandの完全性Hashを生成する。
 *
 * @responsibility Provider実行に影響する全宣言値を決定論的SHA-256へ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 検証対象のProvider Command。
 * @returns 小文字16進SHA-256、直列化不能時はnullを返す。
 * @precondition commandは上位計画から渡されるが完全性は未確定である。
 * @postcondition 同じ宣言値には同じHashを返す。
 * @effect N/A: 局所計算だけを行う。
 * @failure 直列化失敗をnullへ閉じる。
 * @invariant Prompt本文をCommand Hashへ含めない。
 * @boundary Provider Command宣言とRuntime Packet Identityの間。
 * @security 任意Objectのgetter例外を外へ公開しない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
function hashCommand(command: WorkbenchAiAdviceProviderCommand) {
  try {
    return createHash("sha256")
      .update(
        JSON.stringify({
          contract: command.contract,
          contractRevision: command.contractRevision,
          provider: command.provider,
          command: command.command,
          argv: command.argv,
          environment: command.environment,
          fixedImageDigest: command.fixedImageDigest,
          exactModelId: command.exactModelId,
          reasoningEffort: command.reasoningEffort,
          promptTransport: command.promptTransport,
          resultTransport: command.resultTransport,
          providerHomeMountRequired: command.providerHomeMountRequired,
          repositoryMounted: command.repositoryMounted,
          workspaceMountRequired: command.workspaceMountRequired,
          toolsAllowed: command.toolsAllowed,
          sessionPersistenceAllowed: command.sessionPersistenceAllowed,
        }),
        "utf8",
      )
      .digest("hex");
  } catch {
    return null;
  }
}
