import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { deflateSync } from "node:zlib";

import { parseUnambiguousJsonDocument } from "../../src/security/claude-structured-result.ts";
import {
  compileExternalSendPolicyCandidate,
  describeExternalSendPolicyRuntimeContract,
  EXTERNAL_SEND_POLICY_FILE,
  resolveRuntimeOwnedExternalSendPolicy,
} from "../../src/security/external-send-policy-runtime.ts";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
} from "../../src/security/execution-environment.ts";
import { bindRuntimeOwnedRepositoryOperation } from "../../src/security/repository-operation-runtime.ts";

const revision = "1".repeat(40);
const fileHash = "2".repeat(64);

function policy() {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
  return parseUnambiguousJsonDocument(
    fs.readFileSync(
      path.join(repositoryRoot, EXTERNAL_SEND_POLICY_FILE),
      "utf8",
    ),
  );
}

function writeObject(commonDirectory: string, type: string, bytes: Buffer) {
  const framed = Buffer.concat([
    Buffer.from(`${type} ${bytes.byteLength}\0`),
    bytes,
  ]);
  const id = createHash("sha1").update(framed).digest("hex");
  const target = path.join(
    commonDirectory,
    "objects",
    id.slice(0, 2),
    id.slice(2),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deflateSync(framed));
  return id;
}

function repository(
  t: TestContext,
  policyText: string | null,
  options: Readonly<{
    includeUnrelatedGitlink?: boolean;
    policyMode?: "100644" | "160000";
  }> = {},
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-policy-repo-"));
  const git = path.join(root, ".git");
  fs.mkdirSync(path.join(git, "refs", "heads"), { recursive: true });
  fs.writeFileSync(path.join(git, "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const treeBytes = policyText
    ? (() => {
        const policyObject =
          options.policyMode === "160000"
            ? writeObject(
                git,
                "commit",
                Buffer.from(
                  "tree 0000000000000000000000000000000000000000\n\npolicy gitlink\n",
                ),
              )
            : writeObject(git, "blob", Buffer.from(policyText));
        const crddTree = writeObject(
          git,
          "tree",
          Buffer.concat([
            Buffer.from(
              `${options.policyMode ?? "100644"} external-send-policy.json\0`,
            ),
            Buffer.from(policyObject, "hex"),
          ]),
        );
        const entries = [
          Buffer.from("40000 .crdd\0"),
          Buffer.from(crddTree, "hex"),
        ];
        if (options.includeUnrelatedGitlink) {
          const submoduleCommit = writeObject(
            git,
            "commit",
            Buffer.from(
              "tree 0000000000000000000000000000000000000000\n\nsubmodule\n",
            ),
          );
          entries.push(
            Buffer.from("160000 00_CRDD\0"),
            Buffer.from(submoduleCommit, "hex"),
          );
        }
        return Buffer.concat(entries);
      })()
    : Buffer.alloc(0);
  const tree = writeObject(git, "tree", treeBytes);
  const commit = writeObject(
    git,
    "commit",
    Buffer.from(`tree ${tree}\n\nfixture\n`),
  );
  fs.writeFileSync(path.join(git, "refs", "heads", "main"), `${commit}\n`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function resolve(t: TestContext, root: string) {
  const owned = createOwnedOperationDirectories();
  t.after(() => cleanupOwnedOperationDirectories(owned));
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  const bound = bindRuntimeOwnedRepositoryOperation(management, root);
  assert.ok(bound);
  return resolveRuntimeOwnedExternalSendPolicy(
    management,
    bound.repositoryBindingCapability,
  );
}

test("Repository所有Policyへ分類・Provider別処理境界・Candidate保持を固定する", () => {
  const compiled = compileExternalSendPolicyCandidate(
    policy(),
    revision,
    fileHash,
  );
  assert.ok(compiled);
  assert.equal(compiled.sourceRevision, revision);
  assert.equal(compiled.sourceFileHash, fileHash);
  assert.equal(compiled.informationClassification, "public");
  assert.equal(compiled.decisionAuthority, "authenticated_local_user");
  assert.equal(compiled.candidatePersistenceAllowed, true);
  assert.equal(compiled.enabled, true);
  assert.equal(
    compiled.candidatePhysicalDeletion,
    "next_safe_runtime_entry_after_expiry_or_explicit_discard",
  );
  assert.equal(compiled.destinations.length, 2);
  assert.match(compiled.policyHash, /^[0-9a-f]{64}$/u);
});

test("未知field・Provider欠落・不正保持期間・順序差をPolicyへ昇格しない", () => {
  const valid = policy() as Record<string, unknown>;
  for (const invalid of [
    { ...valid, unknown: true },
    { ...valid, candidateRetentionHours: 0 },
    {
      ...valid,
      destinations: (valid.destinations as Record<string, unknown>[]).map(
        (destination, index) =>
          index === 0
            ? { ...destination, retentionDeletion: "unknown" }
            : destination,
      ),
    },
    {
      ...valid,
      destinations: [
        ...(valid.destinations as unknown[]).slice(1),
        (valid.destinations as unknown[])[0],
      ],
    },
    { ...valid, destinations: (valid.destinations as unknown[]).slice(0, 1) },
  ]) {
    assert.equal(
      compileExternalSendPolicyCandidate(invalid, revision, fileHash),
      null,
    );
  }
});

test("公開契約は開始Commitの固定Policy fileと不明時停止を保持する", () => {
  const contract = describeExternalSendPolicyRuntimeContract();
  assert.equal(contract.contractRevision, 3);
  assert.equal(contract.fixedRepositoryFile, EXTERNAL_SEND_POLICY_FILE);
  assert.equal(contract.source, "exact_bound_repository_commit");
  assert.equal(contract.unknownPolicy, "blocked");
  assert.equal(contract.legalTermsRuntimeVerified, false);
  assert.equal(contract.hostPathReported, false);
});

test("別RepositoryのPolicy欠落・不正・disabled・承認済みを開始Commitから区別する", (t) => {
  assert.equal(resolve(t, repository(t, null)), null);
  assert.equal(resolve(t, repository(t, "{}\n")), null);
  const disabled = { ...(policy() as Record<string, unknown>), enabled: false };
  assert.equal(
    resolve(t, repository(t, `${JSON.stringify(disabled)}\n`))?.status,
    "disabled",
  );
  assert.equal(
    resolve(t, repository(t, `${JSON.stringify(policy())}\n`))?.status,
    "resolved",
  );
  const parentWithSubmodule = resolve(
    t,
    repository(t, `${JSON.stringify(policy())}\n`, {
      includeUnrelatedGitlink: true,
    }),
  );
  assert.equal(parentWithSubmodule?.status, "resolved");
  assert.ok(parentWithSubmodule?.capability);
  assert.match(parentWithSubmodule?.sourceRevision ?? "", /^[0-9a-f]{40}$/u);
  assert.match(parentWithSubmodule?.policyHash ?? "", /^[0-9a-f]{64}$/u);
  assert.equal(
    resolve(
      t,
      repository(t, `${JSON.stringify(policy())}\n`, {
        policyMode: "160000",
      }),
    ),
    null,
  );
});
