import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
  type ProjectRuntimeIntegrationRecordPort,
  type ProjectRuntimePortResult,
} from "../../../project-runtime/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";

type IntegrationRecordBinding = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
}>;

const recordIdentity = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const bindingIdentity = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

function completed(): ProjectRuntimePortResult<Readonly<{ written: true }>> {
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_integration_record_written",
    value: Object.freeze({ written: true as const }),
  });
}

function blocked(): ProjectRuntimePortResult<Readonly<{ written: true }>> {
  return Object.freeze({
    status: "blocked",
    reason: "project_runtime_integration_record_unknown",
    value: null,
    manualRecoveryRequired: true,
    recoveryId: null,
  });
}

/** Bind Repository paths and immutable publication mechanics outside the Application Core. */
export function createProjectRuntimeIntegrationRecordAdapter(
  binding: IntegrationRecordBinding,
): ProjectRuntimeIntegrationRecordPort {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    binding.workingDirectory,
  );
  return Object.freeze({
    write: (record) => {
      try {
        if (
          (record.kind !== "integration" && record.kind !== "adoption") ||
          !recordIdentity.test(record.identity) ||
          !bindingIdentity.test(binding.repositoryBindingId) ||
          !bindingIdentity.test(binding.projectId) ||
          !bindingIdentity.test(binding.milestoneId) ||
          !bindingIdentity.test(binding.queueId)
        )
          return blocked();
        const directory = path.join(
          repositoryRoot,
          ".crdd",
          "project-runtime",
          record.kind,
          binding.projectId,
        );
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        const payload = `${JSON.stringify({
          contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
          kind: record.kind,
          repositoryBindingId: binding.repositoryBindingId,
          projectId: binding.projectId,
          milestoneId: binding.milestoneId,
          queueId: binding.queueId,
          identity: record.identity,
          contentHash: createHash("sha256")
            .update(JSON.stringify(record.value))
            .digest("hex"),
          value: record.value,
        })}\n`;
        const target = path.join(directory, `${record.identity}.json`);
        if (fs.existsSync(target))
          return fs.readFileSync(target, "utf8") === payload
            ? completed()
            : blocked();
        const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
        const descriptor = fs.openSync(
          temporary,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
        try {
          fs.writeFileSync(descriptor, payload, "utf8");
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        try {
          fs.renameSync(temporary, target);
        } catch (error) {
          fs.rmSync(temporary, { force: true });
          if (
            !fs.existsSync(target) ||
            fs.readFileSync(target, "utf8") !== payload
          )
            throw error;
        }
        return fs.readFileSync(target, "utf8") === payload
          ? completed()
          : blocked();
      } catch {
        return blocked();
      }
    },
  });
}
