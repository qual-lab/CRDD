/**
 * 診断Probeの構成観測、実ID限定削除と三軸不存在を所有する。
 * @packageDocumentation
 * @responsibility 固定Docker要求の同期順序を閉じ、Host保存や回復Authorityを所有しない。
 * @trace ARCH-000008
 * @boundary 上位の固定技術投影とDocker CLI／mount実体観測。
 */
import { types as utilTypes } from "node:util";
import { executeDockerProbeCommand } from "./probe-command.ts";
import {
  dockerProbeConfigurationMatches,
  type DockerProbeConfigurationExpectation,
} from "./probe-configuration.ts";
import { normalizeContainerAbsence } from "./probe-result.ts";

/**
 * 既存CLI確認・環境投影だけを借用する同期実行Binding。
 * @responsibility 上位のHost能力・保存状態を下位へ持ち込まない。
 * @trace ARCH-000008
 * @shape 既存executeDockerProbeCommandの第一引数と同じ閉じた形。
 * @invariant 任意argv、非同期通知、永続Ownerを追加しない。
 * @boundary 固定技術操作の実行直前確認。
 * @security この型自体は実行許可を発行しない。
 * @compatibility 既存CLI再確認・限定環境を維持する。
 */
type ProbeBinding = Parameters<typeof executeDockerProbeCommand>[0];

/**
 * 診断入力のown data fieldを一度だけ捕捉する。
 * @responsibility getter・Proxy・余分なfieldをEffect前に拒否する。
 * @trace ARCH-000008
 * @input value: 技術投影、keys: 固定field集合。
 * @returns 捕捉済みの局所Record。
 * @precondition field集合はこのModuleが固定する。
 * @postcondition 入力のaccessorを実行しない。
 * @effect N/A: 局所値だけ。
 * @failure 不正形は例外として要求前に停止する。
 * @invariant 入力を保持せず値をコピーする。
 * @boundary 公開技術入力と内部操作。
 * @security 呼出し元の任意fieldを搬送しない。
 * @concurrency 同期捕捉のみ。
 */
function captureFields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new Error("docker_probe_projection_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actual = Reflect.ownKeys(descriptors);
  if (
    actual.length !== keys.length ||
    actual.some((key) => typeof key !== "string" || !keys.includes(key))
  )
    throw new Error("docker_probe_projection_invalid");
  const captured: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const descriptor = descriptors[key];
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      descriptor.enumerable !== true
    )
      throw new Error("docker_probe_projection_invalid");
    captured[key] = descriptor.value;
  }
  return captured;
}

/**
 * ContainerとProbe相関を要求前に固定する。
 * @responsibility 実IDと既存Probe名の構文を保持する。
 * @trace ARCH-000008
 * @input value: id／probeIdの二field。
 * @returns 凍結した二識別値。
 * @precondition IDは作成応答または所有記録で確認済み。
 * @postcondition IDを推定・短縮しない。
 * @effect N/A: 値検査だけ。
 * @failure 不正IDは要求0で例外。
 * @invariant 名前・labelだけでは削除しない。
 * @boundary 上位相関と固定Docker操作。
 * @security RootやHost tokenを受け取らない。
 * @concurrency 一回捕捉して後発変更を読まない。
 */
function captureIdentity(value: unknown) {
  const captured = captureFields(value, ["id", "probeId"]);
  if (
    typeof captured.id !== "string" ||
    !/^[a-f0-9]{64}$/u.test(captured.id) ||
    typeof captured.probeId !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/u.test(captured.probeId)
  )
    throw new Error("docker_probe_projection_invalid");
  return Object.freeze({ id: captured.id, probeId: captured.probeId });
}

/**
 * 選択済み構成と三mountを入力から固定する。
 * @responsibility 候補を拡張せず、配列／Pathの後発変更を搬送しない。
 * @trace ARCH-000008
 * @input value: id、probeId、sourceCandidates、mounts。
 * @returns 凍結した期待構成。
 * @precondition 候補選択と所在利用許可は上位の責務。
 * @postcondition 非空・重複なし候補と三Pathだけをコピーする。
 * @effect N/A: 実Filesystem照合はinspect構成検査時に行う。
 * @failure 不正形はDocker要求前に例外。
 * @invariant payloadを実行・再解釈しない。
 * @boundary 上位選択と下位照合。
 * @security 任意argvや追加mountを受けない。
 * @concurrency 同期snapshotだけ。
 */
function captureExpectation(
  value: unknown,
): DockerProbeConfigurationExpectation {
  const fields = captureFields(value, [
    "id",
    "probeId",
    "sourceCandidates",
    "mounts",
  ]);
  const identity = captureIdentity({ id: fields.id, probeId: fields.probeId });
  const candidates = fields.sourceCandidates;
  if (
    !Array.isArray(candidates) ||
    utilTypes.isProxy(candidates) ||
    candidates.length === 0 ||
    candidates.length > 64
  )
    throw new Error("docker_probe_projection_invalid");
  const descriptors = Object.getOwnPropertyDescriptors(candidates);
  if (Reflect.ownKeys(descriptors).length !== candidates.length + 1)
    throw new Error("docker_probe_projection_invalid");
  const sources: string[] = [];
  for (let index = 0; index < candidates.length; index++) {
    const descriptor = descriptors[String(index)];
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      typeof descriptor.value !== "string" ||
      descriptor.value.length === 0
    )
      throw new Error("docker_probe_projection_invalid");
    sources.push(descriptor.value);
  }
  if (new Set(sources).size !== sources.length)
    throw new Error("docker_probe_projection_invalid");
  const mounts = captureFields(fields.mounts, [
    "workspace",
    "providerHome",
    "tmp",
  ]);
  const { workspace, providerHome, tmp } = mounts;
  if (
    typeof workspace !== "string" ||
    typeof providerHome !== "string" ||
    typeof tmp !== "string" ||
    [workspace, providerHome, tmp].some(
      (value) => value.length === 0 || value.includes("\0"),
    )
  )
    throw new Error("docker_probe_projection_invalid");
  return Object.freeze({
    ...identity,
    sourceCandidates: Object.freeze(sources),
    mounts: Object.freeze({
      workspace,
      providerHome,
      tmp,
    }),
  });
}

/**
 * 実IDの現在構成とRunning肯定だけを観測する。
 * @responsibility 過去の観測値を受け取らずfresh inspectと固定構成照合を行う。
 * @trace ARCH-000008
 * @input binding: 既存CLI確認、expected: 所有者が選択済みの構成。
 * @returns 構成一致時のrunningConfirmed、またはnull。
 * @precondition 上位が私有参照を照合済みである。
 * @postcondition falseを停止・不存在の確認へ変換しない。
 * @effect 固定CLI inspect一回とmount realpath読取り。
 * @failure 不正応答・構成差・上限超過はnull。
 * @invariant raw inspectやHost能力を上位へ返さない。
 * @boundary Docker観測と上位の閉じた事実。
 * @security 固定実IDだけを照合する。
 * @concurrency 同期完了後にだけ返す。
 */
export function inspectDockerProbeContainer(
  binding: ProbeBinding,
  expected: DockerProbeConfigurationExpectation,
): Readonly<{ runningConfirmed: boolean }> | null {
  const captured = captureExpectation(expected);
  const execution = executeDockerProbeCommand(
    binding,
    { purpose: "inspect", containerId: captured.id },
    10_000,
  );
  if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > 64 * 1024
  )
    return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(execution.stdout);
  } catch {
    return null;
  }
  const inspect: unknown =
    Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  if (
    !dockerProbeConfigurationMatches(inspect, captured) ||
    !inspect ||
    typeof inspect !== "object"
  )
    return null;
  const state: unknown = Object.getOwnPropertyDescriptor(
    inspect,
    "State",
  )?.value;
  return Object.freeze({
    runningConfirmed:
      !!state &&
      typeof state === "object" &&
      Object.getOwnPropertyDescriptor(state, "Running")?.value === true,
  });
}

/**
 * ID・名前・label三軸の現在不存在を観測する。
 * @responsibility 空出力の明示成功と失敗・残存・観測不能を区別する。
 * @trace ARCH-000008
 * @input binding: 既存実行Binding、identity: 実IDとProbe相関。
 * @returns 既存のconfirmed／blockedと固定理由。
 * @precondition 上位が所有相関を確認済みである。
 * @postcondition 全三軸の確認なしにconfirmedを返さない。
 * @effect 固定一覧要求三回。
 * @failure 例外は伝播し、不正応答はblocked。
 * @invariant この操作は削除を発行しない。
 * @boundary Engine一覧と上位Host遷移。
 * @security 回復参照・保存本文を受けない。
 * @concurrency 同じ捕捉相関で順次観測する。
 */
export function observeDockerProbeContainerAbsence(
  binding: ProbeBinding,
  identity: Readonly<{ id: string; probeId: string }>,
) {
  const captured = captureIdentity(identity);
  const id = executeDockerProbeCommand(
    binding,
    { purpose: "list_id", containerId: captured.id },
    10_000,
  );
  const name = executeDockerProbeCommand(
    binding,
    { purpose: "list_name", probeId: captured.probeId },
    10_000,
  );
  const label = executeDockerProbeCommand(
    binding,
    { purpose: "list_label", probeId: captured.probeId },
    10_000,
  );
  return Object.freeze(normalizeContainerAbsence(id, name, label));
}

/**
 * fresh構成一致した実IDを削除し三軸不存在まで確認する。
 * @responsibility 古いinspect成功を再利用せず要求順と既存理由を保持する。
 * @trace ARCH-000008
 * @input binding: 既存実行Binding、expected: 固定期待構成。
 * @returns confirmedと既存cleanup理由。
 * @precondition 上位が真正な私有Container参照を確認する。
 * @postcondition inspect→remove→ID→名前→labelの共同成功だけを肯定する。
 * @effect 所有構成照合後の限定removeと不存在観測。
 * @failure inspect差・remove失敗・三軸不明ではconfirmed=false。
 * @invariant Host記録や排他は所有しない。
 * @boundary Docker資源の処置と上位の保存判断。
 * @security 名前・labelだけの削除を行わない。
 * @concurrency 同期一呼出しで完結する。
 */
export function cleanupDockerProbeContainer(
  binding: ProbeBinding,
  expected: DockerProbeConfigurationExpectation,
) {
  const captured = captureExpectation(expected);
  if (!inspectDockerProbeContainer(binding, captured))
    return Object.freeze({
      confirmed: false,
      reason: "docker_container_identity_mismatch",
    });
  const removal = executeDockerProbeCommand(
    binding,
    { purpose: "remove", containerId: captured.id },
    10_000,
  );
  if (removal.error || removal.status !== 0)
    return Object.freeze({
      confirmed: false,
      reason: "docker_probe_cleanup_failed",
    });
  const absence = observeDockerProbeContainerAbsence(binding, {
    id: captured.id,
    probeId: captured.probeId,
  });
  return absence.status === "confirmed"
    ? Object.freeze({
        confirmed: true,
        reason: "docker_probe_absence_confirmed",
      })
    : Object.freeze({
        confirmed: false,
        reason: "docker_probe_cleanup_failed",
      });
}
