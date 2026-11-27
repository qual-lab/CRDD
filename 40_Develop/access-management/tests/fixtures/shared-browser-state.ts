/** 合成の共有ブラウザー試験用に、AMが保存値と故障条件を準備する。 @trace RFD-ST-016 */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { linkAccountFromHost } from "@qual-lab/crdd-access-management";
import { createFilesystemStoreRoot } from "../../src/initialization/root.ts";
import { deriveRepositoryBindingId } from "../../src/repository/binding.ts";
import type { GitHostLinkedRepository } from "../../src/repository/types.ts";
import type { AccessManagementState } from "../../src/storage/types.ts";

/** 試験が作った専用Rootに限定し、保存の実型を利用側へ公開しない。 @trace RFD-ST-016 */
export function createSharedBrowserAccessFixture(
  directory: string,
  role: "administrator" | "manager" | "developer",
) {
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const adminId = "00000000-0000-4000-8000-000000000003";
  const current = path.join(directory, "access-management.json");
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 4,
    revision: 2,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      { userId: adminId, username: "管理者", role },
      {
        userId: "00000000-0000-4000-8000-000000000004",
        username: "開発者",
        role: "developer",
      },
    ],
    registeredRepositories: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: adminId,
      connection: "account_confirmed",
    },
  };
  if (role !== "administrator")
    state.users.push({
      userId: "00000000-0000-4000-8000-000000000005",
      username: "別管理者",
      role: "administrator",
    });

  const baseline = () => readFile(current);
  const decode = (bytes: Buffer) =>
    JSON.parse(bytes.toString("utf8")) as AccessManagementState;
  return {
    addRepository(
      repositoryId: string,
      repositoryRoot: string,
      hostedRepository: GitHostLinkedRepository,
    ) {
      state.registeredRepositories.push({
        repositoryId,
        repositoryRoot,
        bindingId: deriveRepositoryBindingId(repositoryId, repositoryRoot),
        hostedRepository,
      });
    },
    async initialize(account?: Readonly<{ issuer: string; subject: string }>) {
      await writeFile(current, JSON.stringify(state), { flag: "wx" });
      if (account)
        assert.equal(
          linkAccountFromHost(root, adminId, account, state.revision).status,
          "completed",
        );
      return root;
    },
    baseline,
    async registrations() {
      const observed = decode(await baseline());
      return {
        revision: observed.revision,
        repositories: observed.registeredRepositories.map(
          ({ repositoryId, hostedRepository }) => ({
            repositoryId,
            hostedRepository,
          }),
        ),
      };
    },
    users: async () =>
      decode(await baseline()).users.map(({ userId, username, role }) => ({
        userId,
        username,
        role,
      })),
    async setObservation(
      bytes: Buffer,
      variant: "unchanged" | "developer" | "unlinked",
    ) {
      if (variant === "unchanged") return writeFile(current, bytes);
      const synthetic = decode(bytes);
      const actor = synthetic.users.find(({ userId }) => userId === adminId);
      assert.ok(actor?.accountLinks);
      if (variant === "developer") actor.role = "developer";
      else delete actor.accountLinks;
      await writeFile(current, JSON.stringify(synthetic));
    },
  };
}
