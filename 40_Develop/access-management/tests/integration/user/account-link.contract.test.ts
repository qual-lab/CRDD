/**
 * Google主体の紐付けを実保存で照合する。
 * @trace ARCH-000013
 * @level IT
 * @scope 試験所有の保存Root。OIDC、Host端末、HTTP発行は対象外。
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { readCurrentAccess } from "../../../src/authorization/current.ts";
import { readManagementState } from "../../../src/authorization/management.ts";
import { readHostInitializationState } from "../../../src/initialization/state.ts";
import {
  registerRepository,
  registerUser,
  unregisterRepository,
  updateUserName,
  updateUserRole,
} from "../../../src/index.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import {
  ordinaryChange,
  readCurrent,
  serialize,
  updateAccessManagementState,
} from "../../../src/storage/store.ts";
import {
  acceptInvitation,
  readAccount,
  readAdministratorFromHost,
  linkAccountFromHost,
} from "../../../src/user/account-link.ts";
import {
  renewInvitation,
  saveUserRegistration,
} from "../../../src/user/crud.ts";
import { managementFixture } from "../storage/fixture.ts";

test("公開読取りは本人を保存から照合し、旧鍵では保存領域を開かない", (t) => {
  const { root, state, tokens } = managementFixture(t);
  const administrator = state.users.find(
    ({ role }) => role === "administrator",
  );
  assert.ok(administrator);
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "current-admin",
  };
  assert.equal(
    linkAccountFromHost(root, administrator.userId, identity, state.revision)
      .status,
    "completed",
  );
  const login = readAccount(root, identity);
  if (login.status !== "completed") assert.fail("administrator not linked");
  const principal = {
    kind: "account" as const,
    userId: login.account.userId,
    bindingId: login.account.bindingId,
    expiresAt: Date.now() + 60_000,
  };
  const open = fs.openSync;
  let opens = 0;
  t.mock.method(fs, "openSync", (...args: Parameters<typeof open>) => {
    opens++;
    return open(...args);
  });
  assert.equal(readCurrentAccess(root, principal).status, "completed");
  assert.ok(opens > 0);
  opens = 0;
  assert.equal(
    readManagementState(root, principal, "users").status,
    "completed",
  );
  assert.ok(opens > 0);
  opens = 0;
  assert.deepEqual(readCurrentAccess(root, tokens.administrator as never), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  assert.deepEqual(
    readManagementState(root, tokens.administrator as never, "users"),
    { status: "unavailable", reason: "management_read_rejected" },
  );
  assert.equal(opens, 0);
});

test("公開管理書込みは実保存先でも旧鍵を認可に使わない", (t) => {
  const { root, state, tokens } = managementFixture(t);
  const developer = state.users.find(({ role }) => role === "developer");
  assert.ok(developer);
  const key = tokens.administrator as never;
  const revision = state.revision;
  const operation = randomUUID();
  const before = readCurrent(root).bytes;
  const open = fs.openSync;
  let opens = 0;
  const hook = t.mock.method(
    fs,
    "openSync",
    (...args: Parameters<typeof open>) => {
      opens++;
      return open(...args);
    },
  );
  assert.deepEqual(readCurrent(root).bytes, before);
  assert.ok(opens > 0);
  opens = 0;
  const invitation = {
    email: "invitee@example.test",
    digest: "a".repeat(64),
    expiresAt: Date.now() + 60_000,
  };
  const rejected = [
    registerUser(
      root,
      key,
      revision,
      operation,
      "新規利用者",
      "developer",
      invitation,
    ),
    updateUserName(
      root,
      key,
      revision,
      operation,
      developer.userId,
      "新表示名",
    ),
    updateUserRole(
      root,
      key,
      revision,
      operation,
      developer.userId,
      "developer",
      "manager",
    ),
    renewInvitation(
      root,
      key,
      revision,
      operation,
      developer.userId,
      invitation,
    ),
    registerRepository(
      root,
      key,
      revision,
      operation,
      "repository.fixture",
      root.root,
      () => assert.fail("unauthorized_directory_observation"),
    ),
    unregisterRepository(root, key, revision, operation, "repository.fixture"),
  ];
  for (const result of rejected)
    assert.deepEqual(result, {
      status: "rejected",
      reason: "management_request_rejected",
    });
  assert.equal(opens, 0);
  hook.mock.restore();
  assert.deepEqual(readCurrent(root).bytes, before);
});

test("既存利用者の招待再発行は管理者に限り、保存直後に中断しても本人が再ログインできる", (t) => {
  const { root, state, principals } = managementFixture(t);
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "manager-account",
  };
  const manager = state.users[1];
  assert.ok(manager && manager.role === "manager");
  assert.equal(
    linkAccountFromHost(root, manager.userId, identity, 2).status,
    "completed",
  );
  const login = readAccount(root, identity);
  if (login.status !== "completed")
    assert.fail("fixture missing management account");
  const managerPrincipal = {
    kind: "account" as const,
    userId: manager.userId,
    bindingId: login.account.bindingId,
    expiresAt: Date.now() + 60_000,
  };
  const material = (value: string) => ({
    email: "user@example.test",
    digest: value.repeat(64),
    expiresAt: Date.now() + 60_000,
  });
  const registered = saveUserRegistration(
    root,
    principals.manager,
    3,
    randomUUID(),
    "一般利用者",
    "developer",
    material("a"),
  );
  if (registered.status !== "completed" || !registered.userId)
    assert.fail("fixture missing invited user");
  const before = readCurrent(root);
  assert.equal(
    renewInvitation(
      root,
      managerPrincipal,
      4,
      randomUUID(),
      registered.userId,
      { ...material("b"), email: "manager@example.test" },
    ).status,
    "rejected",
  );
  assert.deepEqual(readCurrent(root).bytes, before.bytes);
  const admin = state.users[0];
  assert.ok(admin && admin.role === "administrator");
  const adminIdentity = { ...identity, subject: "administrator-account" };
  assert.equal(
    linkAccountFromHost(root, admin.userId, adminIdentity, 4).status,
    "completed",
  );
  const adminLogin = readAccount(root, adminIdentity);
  if (adminLogin.status !== "completed")
    assert.fail("fixture missing administrator account");
  const principal = {
    ...managerPrincipal,
    userId: admin.userId,
    bindingId: adminLogin.account.bindingId,
  };
  const remove = fs.rmSync;
  const blocked = t.mock.method(fs, "rmSync", ((file, options) => {
    if (String(file).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return remove(file, options);
  }) satisfies typeof fs.rmSync);
  assert.equal(
    renewInvitation(
      root,
      principal,
      5,
      randomUUID(),
      registered.userId,
      material("b"),
    ).status,
    "unavailable",
  );
  blocked.mock.restore();
  const published = readCurrent(root);
  assert.equal(
    published.state.users.at(-1)?.invitation?.digest,
    "b".repeat(64),
  );
  assert.equal(
    readAccount(root, { ...identity, subject: "unrelated" }).status,
    "unavailable",
  );
  assert.equal(readAccount(root, adminIdentity).status, "completed");
  assert.deepEqual(readCurrent(root).bytes, published.bytes);
  assert.equal(
    renewInvitation(
      root,
      principal,
      6,
      randomUUID(),
      registered.userId,
      material("c"),
    ).status,
    "completed",
  );
});

test("招待保存後の清掃中断は本人の通常ログインだけが再入場できる", (t) => {
  const { root, principals, state } = managementFixture(t);
  const proof = {
    issuer: "https://accounts.google.com",
    subject: "published-user",
    email: "invite@example.test",
    emailVerified: true as const,
  };
  const other = { issuer: proof.issuer, subject: "another-bound-user" };
  const admin = state.users[0];
  assert.ok(admin);
  assert.equal(
    linkAccountFromHost(root, admin.userId, other, 2).status,
    "completed",
  );
  const digest = "d".repeat(64);
  assert.equal(
    saveUserRegistration(
      root,
      principals.manager,
      3,
      randomUUID(),
      "開発者",
      "developer",
      {
        email: proof.email,
        digest,
        expiresAt: Date.now() + 60_000,
      },
    ).status,
    "completed",
  );
  const remove = fs.rmSync;
  const blocked = t.mock.method(fs, "rmSync", ((file, options) => {
    if (String(file).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return remove(file, options);
  }) satisfies typeof fs.rmSync);
  assert.equal(acceptInvitation(root, proof, digest).status, "unavailable");
  blocked.mock.restore();
  const published = readCurrent(root);
  assert.equal(
    published.state.users.at(-1)?.accountLinks?.[0]?.subject,
    proof.subject,
  );
  assert.equal(readAccount(root, other).status, "unavailable");
  assert.equal(acceptInvitation(root, proof, digest).status, "rejected");
  assert.equal(readAccount(root, proof).status, "completed");
  assert.deepEqual(readCurrent(root).bytes, published.bytes);
  assert.equal(readAccount(root, other).status, "completed");
});

test("招待の出版中断は未成立の保存だけを整理し、次の受付で一度確定する", (t) => {
  const { root, principals } = managementFixture(t);
  const proof = {
    issuer: "https://accounts.google.com",
    subject: "interrupted-invitation",
    email: "invite@example.test",
    emailVerified: true as const,
  };
  const digest = "c".repeat(64);
  assert.equal(
    saveUserRegistration(
      root,
      principals.manager,
      2,
      randomUUID(),
      "開発者",
      "developer",
      {
        email: proof.email,
        digest,
        expiresAt: Date.now() + 60_000,
      },
    ).status,
    "completed",
  );
  const original = readCurrent(root).bytes;
  const blocked = t.mock.method(fs, "renameSync", () => {
    throw new Error("injected");
  });
  assert.equal(acceptInvitation(root, proof, digest).status, "unavailable");
  blocked.mock.restore();
  assert.deepEqual(readCurrent(root).bytes, original);
  assert.equal(acceptInvitation(root, proof, digest).status, "unavailable");
  assert.deepEqual(readCurrent(root).bytes, original);
  assert.equal(acceptInvitation(root, proof, digest).status, "completed");
  assert.equal(acceptInvitation(root, proof, digest).status, "rejected");
});

test("事前登録した招待だけが検証済みGoogle主体を一度だけ結び付ける", (t) => {
  const { root, state } = managementFixture(t);
  const digest = "a".repeat(64);
  const proof = {
    issuer: "https://accounts.google.com",
    subject: "invited-subject",
    email: "developer@example.test",
    emailVerified: true as const,
  };
  const invitation = {
    email: proof.email,
    digest,
    expiresAt: Date.now() + 60_000,
  };
  const manager = state.users.find(({ role }) => role === "manager");
  assert.ok(manager);
  const managerIdentity = { issuer: proof.issuer, subject: "inviting-manager" };
  assert.equal(
    linkAccountFromHost(root, manager.userId, managerIdentity, 2).status,
    "completed",
  );
  const managerLogin = readAccount(root, managerIdentity);
  if (managerLogin.status !== "completed") assert.fail("manager not linked");
  const managerPrincipal = {
    kind: "account" as const,
    userId: managerLogin.account.userId,
    bindingId: managerLogin.account.bindingId,
    expiresAt: Date.now() + 60_000,
  };
  const revision = readCurrent(root).state.revision;
  const before = readCurrent(root).bytes;
  assert.equal(acceptInvitation(root, proof, digest).status, "rejected");
  assert.equal(
    saveUserRegistration(
      root,
      managerPrincipal,
      revision,
      randomUUID(),
      "未許可の管理者",
      "administrator",
      invitation,
    ).status,
    "unavailable",
  );
  assert.deepEqual(readCurrent(root).bytes, before);
  const registration = saveUserRegistration(
    root,
    managerPrincipal,
    revision,
    randomUUID(),
    "開発者",
    "developer",
    invitation,
  );
  assert.equal(registration.status, "completed");
  if (registration.status !== "completed")
    assert.fail("registration unavailable");
  const pending = readCurrent(root);
  assert.equal(readAccount(root, proof).status, "rejected");
  assert.equal(
    acceptInvitation(root, { ...proof, email: "other@example.test" }, digest)
      .status,
    "rejected",
  );
  assert.equal(
    acceptInvitation(root, proof, "b".repeat(64)).status,
    "rejected",
  );
  const now = t.mock.method(Date, "now", () => invitation.expiresAt);
  assert.equal(acceptInvitation(root, proof, digest).status, "rejected");
  now.mock.restore();
  assert.deepEqual(readCurrent(root).bytes, pending.bytes);
  const visible = readManagementState(root, managerPrincipal, "users");
  assert.equal(visible.status, "completed");
  const listing = JSON.stringify(visible);
  assert.equal(
    listing.includes(proof.email) || listing.includes(digest),
    false,
  );

  const accepted = acceptInvitation(root, proof, digest);
  assert.equal(accepted.status, "completed");
  if (accepted.status !== "completed") assert.fail("invitation unavailable");
  assert.equal(accepted.account.userId, registration.userId);
  assert.equal(accepted.account.role, "developer");
  const current = readCurrent(root);
  assert.equal(current.state.users.length, state.users.length + 1);
  assert.deepEqual(current.state.initialization, state.initialization);
  assert.equal(current.state.users.at(-1)?.invitation, undefined);
  assert.equal(acceptInvitation(root, proof, digest).status, "rejected");
  assert.deepEqual(readCurrent(root).bytes, current.bytes);
  assert.equal(
    readAccount(root, { issuer: proof.issuer, subject: proof.subject }).status,
    "completed",
  );
});

test("既存利用者だけにGoogle主体を結び、再紐付けは旧セッションを無効にする", (t) => {
  const { root, state } = managementFixture(t);
  const admin = state.users[0];
  const manager = state.users[1];
  assert.ok(admin && manager);
  const identity = {
    issuer: "https://accounts.google.com",
    subject: "synthetic-google-user",
  };
  const current = () => readCurrent(root).state;
  const original = readCurrent(root).bytes;
  assert.deepEqual(readAdministratorFromHost(root, admin.userId), {
    userId: admin.userId,
    username: admin.username,
    revision: 2,
  });
  assert.equal(readAdministratorFromHost(root, manager.userId), null);
  const readReadiness = (acceptedIssuer = identity.issuer) =>
    readHostInitializationState(root, {
      acceptsAdministratorIssuer: (issuer) => issuer === acceptedIssuer,
    });
  assert.deepEqual(readReadiness(), {
    status: "existing",
    connection: "account_confirmed",
    administratorLinked: false,
  });
  assert.equal(readAccount(root, identity).status, "rejected");
  assert.equal(
    linkAccountFromHost(root, randomUUID(), identity, 2).status,
    "unavailable",
  );
  assert.deepEqual(readCurrent(root).bytes, original);

  assert.equal(
    linkAccountFromHost(root, admin.userId, identity, 2).status,
    "completed",
  );
  const first = readAccount(root, identity);
  assert.equal(first.status, "completed");
  if (first.status !== "completed") assert.fail("Google account unavailable");
  assert.equal(first.account.userId, admin.userId);
  assert.equal(first.account.role, "administrator");
  assert.deepEqual(readReadiness(), {
    status: "existing",
    connection: "account_confirmed",
    administratorLinked: true,
  });
  assert.deepEqual(readReadiness("https://login.example.test"), {
    status: "existing",
    connection: "account_confirmed",
    administratorLinked: false,
  });
  assert.deepEqual(current().initialization, state.initialization);
  const listing = readManagementState(
    root,
    {
      kind: "account",
      userId: first.account.userId,
      bindingId: first.account.bindingId,
      expiresAt: Date.now() + 60_000,
    },
    "users",
  );
  assert.equal(listing.status, "completed");
  assert.equal(JSON.stringify(listing).includes(identity.subject), false);
  assert.equal(
    JSON.stringify(listing).includes(first.account.bindingId),
    false,
  );
  assert.equal(
    readAccount(root, { ...identity, issuer: "https://other.example" }).status,
    "rejected",
  );

  const previouslyBound = readCurrent(root).bytes;
  assert.equal(
    linkAccountFromHost(root, manager.userId, identity, 3).status,
    "unavailable",
  );
  assert.equal(
    linkAccountFromHost(root, admin.userId, { ...identity, subject: null }, 1)
      .status,
    "unavailable",
  );
  const attempted = updateAccessManagementState(root, 3, (next) => {
    const user = next.users[0];
    assert.ok(user);
    delete user.accountLinks;
    next.revision++;
    next.operationId = randomUUID();
    return serialize(next);
  });
  assert.equal(attempted.status, "unavailable");
  assert.deepEqual(readCurrent(root).bytes, previouslyBound);

  const nameChange = updateAccessManagementState(root, 3, (next) => {
    const user = next.users[0];
    assert.ok(user);
    user.username = "変更後";
    next.revision++;
    next.operationId = randomUUID();
    return serialize(next);
  });
  assert.equal(nameChange.status, "completed");
  const renamed = readAccount(root, identity, first.account);
  assert.equal(
    renamed.status === "completed" && renamed.account.username,
    "変更後",
  );

  assert.equal(
    linkAccountFromHost(root, admin.userId, { ...identity, subject: null }, 4)
      .status,
    "completed",
  );
  assert.equal(readAccount(root, identity, first.account).status, "rejected");
  assert.equal(
    linkAccountFromHost(root, admin.userId, identity, 5).status,
    "completed",
  );
  assert.equal(readAccount(root, identity, first.account).status, "rejected");
  assert.equal(readAccount(root, identity).status, "completed");

  const bound = current();
  const invalid = structuredClone(bound);
  const a = invalid.users[0];
  const b = invalid.users[1];
  const link = a?.accountLinks?.[0];
  assert.ok(link && b);
  b.accountLinks = [{ ...link, bindingId: randomUUID() }];
  assert.equal(
    parseAccessManagementState(serialize(invalid)).status,
    "invalid",
  );
  b.accountLinks = [{ ...link, subject: "other-subject" }];
  assert.equal(
    parseAccessManagementState(serialize(invalid)).status,
    "invalid",
  );
  assert.equal(ordinaryChange(bound, invalid), false);

  const rebound = readAccount(root, identity);
  if (rebound.status !== "completed") assert.fail("Google account unavailable");
  const demotion = updateAccessManagementState(root, 6, (next) => {
    const user = next.users[0];
    assert.ok(user);
    user.role = "developer";
    next.revision++;
    next.operationId = randomUUID();
    return serialize(next);
  });
  assert.equal(demotion.status, "completed");
  assert.deepEqual(readReadiness(), {
    status: "existing",
    connection: "account_confirmed",
    administratorLinked: false,
  });
  const demoted = readAccount(root, identity, rebound.account);
  assert.equal(
    demoted.status === "completed" && demoted.account.role,
    "developer",
  );

  // 発行者が異なれば同じ主体文字列でも別の本人。別発行者の紐付けを追加・変更しても、
  // 元の紐付けと同じ結合IDを持つセッションは残る。
  const alternate = {
    ...identity,
    issuer: "https://login.example.test/tenant",
  };
  assert.equal(
    linkAccountFromHost(root, manager.userId, alternate, 7).status,
    "completed",
  );
  const other = readAccount(root, alternate);
  assert.equal(
    other.status === "completed" && other.account.userId,
    manager.userId,
  );
  assert.equal(
    readAccount(root, alternate, rebound.account).status,
    "rejected",
  );
  const secondIssuer = { ...identity, issuer: "https://login2.example.test" };
  assert.equal(
    linkAccountFromHost(root, admin.userId, secondIssuer, 8).status,
    "completed",
  );
  const second = readAccount(root, secondIssuer);
  if (second.status !== "completed")
    assert.fail("alternate account unavailable");
  assert.equal(
    readAccount(root, identity, rebound.account).status,
    "completed",
  );
  assert.equal(readAccount(root, identity, second.account).status, "rejected");
  assert.equal(
    linkAccountFromHost(
      root,
      admin.userId,
      { ...secondIssuer, subject: "changed" },
      9,
    ).status,
    "completed",
  );
  assert.equal(
    readAccount(root, secondIssuer, second.account).status,
    "rejected",
  );
  assert.equal(
    readAccount(root, identity, rebound.account).status,
    "completed",
  );
  assert.equal(
    linkAccountFromHost(
      root,
      admin.userId,
      { ...secondIssuer, subject: null },
      10,
    ).status,
    "completed",
  );
  assert.equal(
    readAccount(root, { ...secondIssuer, subject: "changed" }).status,
    "rejected",
  );
  assert.equal(
    readAccount(root, identity, rebound.account).status,
    "completed",
  );
  assert.deepEqual(readReadiness(alternate.issuer), {
    status: "existing",
    connection: "account_confirmed",
    administratorLinked: false,
  });

  const legacy = JSON.parse(readCurrent(root).bytes.toString("utf8"));
  const [oldLink] = legacy.users[0].accountLinks;
  legacy.users[0].googleAccount = {
    subject: oldLink.subject,
    bindingId: oldLink.bindingId,
  };
  delete legacy.users[0].accountLinks;
  assert.equal(parseAccessManagementState(serialize(legacy)).status, "invalid");
});
