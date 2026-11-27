/**
 * 検証済みの外部主体と既存のCRDD利用者の紐付けを管理する。
 * @responsibility 認証結果の現在照合と、Hostで明示確定した紐付けの保存。
 * @trace ARCH-000013
 * @boundary OIDCやセッションの検証は受付側。通常の管理Writerには公開しない。
 */
import { randomUUID } from "node:crypto";
import type { FilesystemStoreRoot } from "../initialization/root.ts";
import { evaluateManagementPermission } from "../permission/validation.ts";
import { locked } from "../storage/lock.ts";
import {
  isAccountIssuer,
  isAccountSubject,
  isInvitationDigest,
  isInvitationEmail,
  parseAccessManagementState,
  UUID_V4,
} from "../storage/parse.ts";
import {
  PENDING,
  present,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";

type AccountIdentity = Readonly<{ issuer: string; subject: string }>;
type AccountBinding = Readonly<{ userId: string; bindingId: string }>;

function sameIdentity(a: AccountIdentity, b: AccountIdentity) {
  return a.issuer === b.issuer && a.subject === b.subject;
}

/**
 * 検証済みの外部本人確認で、事前登録済みの招待を一度だけ引き受ける。
 * @precondition OIDC応答、招待の要求相関、トークンからの照合値はServerで確定済み。
 * @effect 既存の管理保存。利用者・ロール・接続鍵は新規作成しない。
 */
export function acceptInvitation(
  root: FilesystemStoreRoot,
  proof: AccountIdentity & Readonly<{ email: string; emailVerified: true }>,
  digest: string,
) {
  const rejected = { status: "rejected" as const };
  const unavailable = { status: "unavailable" as const };
  if (
    !isAccountIssuer(proof.issuer) ||
    !isAccountSubject(proof.subject) ||
    proof.emailVerified !== true ||
    !isInvitationEmail(proof.email) ||
    !isInvitationDigest(digest)
  )
    return rejected;
  const result = locked(root, () => {
    const current = readCurrent(root);
    const found = current.state.users.find(
      (user) => user.invitation?.digest === digest,
    );
    const invitation = found?.invitation;
    if (
      current.state.initialization.stage !== "completed" ||
      !found ||
      !invitation ||
      invitation.email !== proof.email ||
      invitation.expiresAt <= Date.now() ||
      current.state.users.some((user) =>
        user.accountLinks?.some((link) => sameIdentity(link, proof)),
      )
    ) {
      return {
        status: "completed" as const,
        value: null,
        revision: current.state.revision,
        cleanupConfirmed: true as const,
        publication: "not_attempted" as const,
      };
    }
    if (settlePending(root, current, () => {}) !== "none")
      throw new Error("account_invitation_unavailable");
    const next = structuredClone(current.state);
    const user = next.users.find(
      (candidate) => candidate.userId === found.userId,
    );
    if (!user) throw new Error("account_invitation_unavailable");
    delete user.invitation;
    user.accountLinks = [
      {
        issuer: proof.issuer,
        subject: proof.subject,
        bindingId: randomUUID(),
      },
    ];
    next.revision += 1;
    next.operationId = randomUUID();
    const parsed = parseAccessManagementState(serialize(next));
    if (
      parsed.status !== "parsed" ||
      next.operationId === current.state.operationId
    )
      throw new Error("account_invitation_unavailable");
    const account = resolveAccount(parsed.state, proof);
    if (!account) throw new Error("account_invitation_unavailable");
    const published = publishState(
      root,
      current,
      parsed.state,
      "account-invitation",
      user.userId,
    );
    return published.status === "completed"
      ? { ...published, value: account }
      : published;
  });
  if (result.status !== "completed") return unavailable;
  return result.value
    ? { status: "completed" as const, account: result.value }
    : rejected;
}

/** トークンから復元した紐付けが、現在の同じ利用者に残っているかを照合する。 @trace ARCH-000013 */
export function resolveAccountBinding(
  state: AccessManagementState,
  binding: AccountBinding,
) {
  const current = state.users
    .find((user) => user.userId === binding.userId)
    ?.accountLinks?.find((link) => link.bindingId === binding.bindingId);
  return current ? resolveAccount(state, current, binding) : null;
}

/**
 * 検証済みの外部主体を、同じ現在状態の利用者とロールへ結ぶ。
 * @precondition 呼出し前にOIDC応答または発行済みサーバーセッションを検証済み。
 * @security 紐付けを解除・再設定すると旧セッションの結合IDは一致しない。
 */
function resolveAccount(
  state: AccessManagementState,
  identity: AccountIdentity,
  session?: AccountBinding,
) {
  if (
    state.initialization.stage !== "completed" ||
    !isAccountIssuer(identity.issuer) ||
    !isAccountSubject(identity.subject)
  )
    return null;
  const user = state.users.find((candidate) =>
    candidate.accountLinks?.some((link) => sameIdentity(link, identity)),
  );
  const link = user?.accountLinks?.find((entry) =>
    sameIdentity(entry, identity),
  );
  if (
    !user ||
    !link ||
    (session &&
      (session.userId !== user.userId || session.bindingId !== link.bindingId))
  )
    return null;
  return Object.freeze({
    revision: state.revision,
    userId: user.userId,
    bindingId: link.bindingId,
    username: user.username,
    role: user.role,
  });
}

/**
 * 現在の紐付けを読み取る。本人の再ログインでは公開済み招待の後片付けを続けられる。
 * @effect 既存Lockと状態読取り、公開済みの照合済み材料の清掃だけ。利用者・紐付けは保存しない。
 */
export function readAccount(
  root: FilesystemStoreRoot,
  identity: AccountIdentity,
  session?: AccountBinding,
) {
  const result = locked(root, () => {
    const current = readCurrent(root);
    const { state } = current;
    const account = resolveAccount(state, identity, session);
    if (present(root, PENDING)) {
      if (!account || session) throw new Error("account_link_unavailable");
      settlePending(
        root,
        current,
        () => {},
        (userId) => {
          const target = state.users.find((user) => user.userId === userId);
          if (!target) return false;
          if (target.accountLinks) return userId === account.userId;
          return (
            target.invitation !== undefined &&
            evaluateManagementPermission(account.role, {
              operation: "registerUser",
              plannedRole: target.role,
            }) === "allowed"
          );
        },
      );
    }
    return {
      status: "completed" as const,
      value: account,
      revision: state.revision,
      cleanupConfirmed: true as const,
      publication: "not_attempted" as const,
    };
  });
  return result.status === "completed"
    ? result.value === null
      ? { status: "rejected" as const }
      : { status: "completed" as const, account: result.value }
    : { status: "unavailable" as const };
}

/** Hostの初回・再紐付け先となる既存管理者を読み取る。 @trace ARCH-000013 */
export function readAdministratorFromHost(
  root: FilesystemStoreRoot,
  userId: string,
) {
  if (!UUID_V4.test(userId)) return null;
  const result = locked(root, () => {
    if (present(root, PENDING)) throw new Error("account_link_unavailable");
    const { state } = readCurrent(root);
    const user =
      state.initialization.stage === "completed" &&
      state.users.find(
        (item) => item.userId === userId && item.role === "administrator",
      );
    return {
      status: "completed" as const,
      value: user
        ? {
            userId: user.userId,
            username: user.username,
            revision: state.revision,
          }
        : null,
      revision: state.revision,
      cleanupConfirmed: true as const,
      publication: "not_attempted" as const,
    };
  });
  return result.status === "completed" ? result.value : null;
}

/**
 * Hostで確認済みの操作で、対象利用者の指定発行者の紐付けだけを設定する。
 * @precondition Host対話の権限、対象と操作の明示確認、設定時の外部本人確認は呼出側の責務。
 * @effect 既存状態を同じLock内で照合して既存Writerへ渡す。
 * @security HTTP／MCPへ登録しない。subjectがnullなら指定発行者の紐付けだけを解除。
 */
export function linkAccountFromHost(
  root: FilesystemStoreRoot,
  userId: string,
  identity: Readonly<{ issuer: string; subject: string | null }>,
  expectedRevision: number,
) {
  return locked(root, () => {
    const current = readCurrent(root);
    const rejected = {
      status: "unavailable" as const,
      reason: "account_link_change_rejected",
      revision: current.state.revision,
      cleanupConfirmed: true,
      publication: "not_attempted" as const,
    };
    if (
      current.state.initialization.stage !== "completed" ||
      current.state.revision !== expectedRevision ||
      !UUID_V4.test(userId) ||
      !identity ||
      !isAccountIssuer(identity.issuer) ||
      (identity.subject !== null &&
        (!isAccountSubject(identity.subject) ||
          current.state.users.some(
            (user) =>
              user.userId !== userId &&
              user.accountLinks?.some(
                (link) =>
                  link.issuer === identity.issuer &&
                  link.subject === identity.subject,
              ),
          )))
    )
      return rejected;
    const next = structuredClone(current.state);
    const user = next.users.find((candidate) => candidate.userId === userId);
    if (!user) return rejected;
    const retained = (user.accountLinks ?? []).filter(
      (link) => link.issuer !== identity.issuer,
    );
    if (
      identity.subject === null &&
      retained.length === (user.accountLinks?.length ?? 0)
    )
      return rejected;
    if (settlePending(root, current, () => {}) !== "none")
      return { ...rejected, reason: "state_store_previous_pending_settled" };
    if (identity.subject !== null) {
      delete user.invitation;
      user.accountLinks = [
        ...retained,
        {
          issuer: identity.issuer,
          subject: identity.subject,
          bindingId: randomUUID(),
        },
      ];
    } else if (retained.length) user.accountLinks = retained;
    else delete user.accountLinks;
    next.revision += 1;
    next.operationId = randomUUID();
    const parsed = parseAccessManagementState(serialize(next));
    if (
      parsed.status !== "parsed" ||
      next.operationId === current.state.operationId
    )
      return rejected;
    return publishState(root, current, parsed.state, "management");
  });
}
