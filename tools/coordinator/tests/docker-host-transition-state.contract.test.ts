import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { validateDockerHostTransitionLineage } from "../src/security/docker-host-transition-state.ts";

const ROOT_NAME = "crdd-coordinator-doctor-fixture";
const NONCE = "01234567-89ab-cdef-0123-456789abcdef";

function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

function token(record: unknown) {
  const hash = createHash("sha256").update(canonical(record)).digest("hex");
  return `host.${ROOT_NAME}.${NONCE}.${hash}`;
}

function intent() {
  const recordBefore = Object.freeze({
    schema: "crdd-coordinator-host-recovery/v1",
    rootName: ROOT_NAME,
    state: "docker_submission_started",
    childIdentities: Object.freeze({}),
  });
  const successor = Object.freeze({ ...recordBefore, state: "host_only" });
  return Object.freeze({
    currentToken: token(recordBefore),
    expectedToken: token(successor),
    rootName: ROOT_NAME,
    nonce: NONCE,
    currentState: "docker_submission_started",
    nextState: "host_only",
    recordBefore,
  });
}

test("Host intentはcurrent recordから決定論的successor tokenだけを受理する", () => {
  const accepted = validateDockerHostTransitionLineage(intent(), "host_only");
  assert.equal(accepted.current.nonce, NONCE);
  assert.equal(
    accepted.expected.recordHash,
    token({
      ...intent().recordBefore,
      state: "host_only",
    })
      .split(".")
      .at(-1),
  );
});

test("同nonce別state、偽currentState、誤nextStateを第三状態として拒否する", () => {
  const valid = intent();
  const alternate = Object.freeze({
    ...valid.recordBefore,
    state: "docker_absent_confirmed",
  });
  for (const candidate of [
    { ...valid, expectedToken: token(alternate) },
    { ...valid, currentState: "host_only" },
    { ...valid, nextState: "docker_absent_confirmed" },
    { ...valid, recordBefore: { ...valid.recordBefore, extra: true } },
  ])
    assert.throws(
      () => validateDockerHostTransitionLineage(candidate, "host_only"),
      /docker_task_recovery_host_transition_mismatch/u,
    );
});
