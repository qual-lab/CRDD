/**
 * Docker restart handoff chainを別Processで構築する固定Test Worker。
 *
 * @packageDocumentation
 * @responsibility origin、intermediate handoffおよびdestination closureを別Processと耐久Fileへ分離する。
 * @trace ERB-ST-011
 * @boundary Test Parent→Worker Process→Durable Handoff Files。
 * @effect 指定されたTest一時Directory内だけへJSONを作成する。
 * @security Credential、Host PathまたはDocker Effectを入力・出力しない。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  createDockerRestartContinuationRecord,
  createDockerRestartMigratedPhase,
  createDockerRestartMigrationRecord,
  resolveDockerRestartHistory,
} from "../../src/security/docker-restart-continuation-record.ts";
import { createDockerRestartRecord } from "../../src/security/docker-restart-record.ts";

const [command, root, rawBinding] = process.argv.slice(2);
if (!command || !root || !rawBinding)
  throw new Error("docker_handoff_worker_arguments_invalid");
const binding = JSON.parse(rawBinding);
const write = (name: string, value: unknown) =>
  fs.writeFileSync(path.join(root, name), `${JSON.stringify(value)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
const read = <T>(name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, name), "utf8")) as T;
const encode = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
const decode = (value: string) => Buffer.from(value, "base64");

if (command === "origin") {
  const originRecords = [createDockerRestartRecord(binding, "stop_intent")];
  write("origin.json", originRecords.map(encode));
  process.stdout.write(
    JSON.stringify({ pid: process.pid, effectIssued: false, resources: 0 }),
  );
} else if (command === "intermediate") {
  const originRecords = read<string[]>("origin.json").map(decode);
  const handoff = createDockerRestartMigrationRecord(
    originRecords,
    binding,
    [],
    [],
  );
  const phase = createDockerRestartRecord(binding, "stop_intent");
  const continuation = createDockerRestartContinuationRecord(
    phase,
    createHash("sha256").update(handoff).digest("hex"),
  );
  write("handoff-b.json", encode(handoff));
  write("continuation-b.json", encode(continuation));
  process.stdout.write(
    JSON.stringify({ pid: process.pid, effectIssued: false, resources: 0 }),
  );
} else if (command === "destination") {
  const originRecords = read<string[]>("origin.json").map(decode);
  const handoffB = decode(read<string>("handoff-b.json"));
  const continuationB = decode(read<string>("continuation-b.json"));
  const handoffC = createDockerRestartMigrationRecord(
    originRecords,
    binding,
    [handoffB],
    [continuationB],
  );
  const continuations: Uint8Array[] = [continuationB];
  let previous: Uint8Array = createDockerRestartRecord(
    { ...binding, runtimeExecutionIdentitySha256: "b".repeat(64) },
    "stop_intent",
  );
  for (const phase of [
    "stopped",
    "start_intent",
    "ready",
    "settled",
  ] as const) {
    previous = createDockerRestartMigratedPhase(binding, phase, previous);
    continuations.push(
      createDockerRestartContinuationRecord(
        previous,
        createHash("sha256").update(handoffC).digest("hex"),
      ),
    );
  }
  const resolved = resolveDockerRestartHistory(
    originRecords,
    binding,
    [handoffB, handoffC],
    continuations,
  );
  write("closure.json", resolved);
  process.stdout.write(
    JSON.stringify({
      pid: process.pid,
      effectIssued: false,
      resources: 0,
      currentPhase: resolved?.currentPhase ?? null,
      recordCount: resolved?.records.length ?? 0,
    }),
  );
} else {
  throw new Error("docker_handoff_worker_command_invalid");
}
