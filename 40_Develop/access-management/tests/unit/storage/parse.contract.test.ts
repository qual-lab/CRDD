/**
 * 現行の管理保存形式と旧方式の拒否を確認する。
 * @trace RFD-UT-028
 */
import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { deriveRepositoryBindingId } from "../../../src/repository/binding.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";

const initial = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const bindingId = "00000000-0000-4000-8000-000000000003";
function fresh(): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 4,
    revision: 1,
    operationId: initial,
    users: [
      {
        userId,
        username: "管理者",
        role: "administrator",
        accountLinks: [
          {
            issuer: "https://login.example.test",
            subject: "fixture",
            bindingId,
          },
        ],
      },
    ],
    registeredRepositories: [],
    initialization: {
      stage: "completed",
      attemptId: initial,
      initialUserId: userId,
      connection: "account_confirmed",
    },
  };
}
const parse = (value: unknown) =>
  parseAccessManagementState(Buffer.from(JSON.stringify(value)));

test("第4版は旧版・旧鍵項目・不正な初回状態を受理しない", () => {
  const value = fresh();
  assert.deepEqual(parse(value), { status: "parsed", state: value });
  for (const schemaRevision of [1, 2, 3, 5])
    assert.equal(parse({ ...value, schemaRevision }).status, "invalid");
  for (const field of [
    "credentials",
    "unresolvedKeyExchanges",
    "roleContentAccess",
    "exposure",
  ])
    assert.equal(parse({ ...value, [field]: [] }).status, "invalid");
  for (const initialization of [
    { ...value.initialization, stage: "credential_stored" },
    { ...value.initialization, connection: "confirmed" },
    { ...value.initialization, confirmationCredentialId: "0".repeat(24) },
    { ...value.initialization, initialUserId: bindingId },
  ])
    assert.equal(parse({ ...value, initialization }).status, "invalid");
  assert.equal(parse({ ...value, operationId: bindingId }).status, "invalid");
  assert.equal(
    parse({ ...value, users: [{ ...value.users[0], accountLinks: [] }] })
      .status,
    "invalid",
  );
  assert.equal(
    parse({ ...value, users: [{ ...value.users[0], role: "manager" }] }).status,
    "invalid",
  );
});

test("現在の利用者・本人紐付け・登録参照を閉形式で保つ", () => {
  const value = fresh();
  value.revision = 2;
  value.operationId = bindingId;
  const repositoryRoot = path.resolve("fixture");
  const repositoryId = "repository.fixture";
  value.registeredRepositories = [
    {
      repositoryId,
      repositoryRoot,
      bindingId: deriveRepositoryBindingId(repositoryId, repositoryRoot),
      hostedRepository: {
        provider: "github",
        host: "github.com",
        repositoryId: "92",
        providerData: { installationId: "24" },
      },
    },
  ];
  assert.equal(parse(value).status, "parsed");
  const duplicate = structuredClone(value);
  const duplicateUser = duplicate.users[0];
  assert.ok(duplicateUser);
  duplicate.users.push({ ...duplicateUser, userId: initial });
  assert.equal(parse(duplicate).status, "invalid");
  const wrong = structuredClone(value);
  const wrongRegistration = wrong.registeredRepositories[0];
  assert.ok(wrongRegistration);
  wrongRegistration.bindingId = "binding-invalid";
  assert.equal(parse(wrong).status, "invalid");
  const unknownHostField = structuredClone(value);
  const host = unknownHostField.registeredRepositories[0]?.hostedRepository;
  assert.ok(host);
  Object.assign(host, {
    installationId: "24",
  });
  assert.equal(parse(unknownHostField).status, "invalid");
});

test("不正UTF-8を拒否し、旧容量上限を超える正規JSONを受け付ける", () => {
  assert.equal(
    parseAccessManagementState(Uint8Array.from([0xc3, 0x28])).status,
    "invalid",
  );
  const text = JSON.stringify(fresh()) + " ".repeat(17 * 1024 * 1024);
  assert.equal(parseAccessManagementState(Buffer.from(text)).status, "parsed");
});
