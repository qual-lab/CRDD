/**
 * CROS Credential Registry File Adapterの不変publishと再読取りを検証する。
 *
 * @packageDocumentation
 * @responsibility OS管理Runtime RootにCredential Snapshotを保存し、再起動相当の別Adapterとrevision競合を安全に処理することを検証する。
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、credential、runtime-data、filesystem、registry
 * @boundary RFD-IT-013=Direct Boundary: Credential Application→Runtime Data Resolver→Filesystem Registry。
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  authenticateConnectionCredential,
  createCredentialRegistryFileAdapter,
  issueConnectionCredential,
  type CredentialRandomBytes,
  type RequestAccessContext,
} from "../../src/index.ts";

const administrator: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  registryRevision: 0,
});

/**
 * File Adapter試験用の決定論的乱数Providerを作成する。
 *
 * @responsibility 発行結果を再現可能にしつつ各乱数要求へ異なるbyte列を返す。
 * @trace RFD-IT-013
 * @input N/A: counterを1で初期化する。
 * @returns CredentialRandomBytes関数。
 * @precondition 本Providerを本番へ使用しない。
 * @postcondition 呼出しごとにcounterを一つ進める。
 * @effect 試験Process内counterだけを更新する。
 * @failure N/A: 正のbyte数に必ず応答する。
 * @invariant 同じ呼出し順では同じbyte列になる。
 * @boundary 試験とCredential乱数Portの境界。
 * @security 本番Secretを生成しない。
 * @concurrency 一つの試験内で直列利用する。
 */
function deterministicRandom(): CredentialRandomBytes {
  let counter = 1;
  return (size: number) => {
    const result = Buffer.alloc(size, counter);
    counter += 1;
    return result;
  };
}

/**
 * 同じTrust Domainの別AdapterからCredentialを再観測できることを検証する。
 *
 * @responsibility 不変Snapshot、Token非保存およびProcess再構成相当の読取りを観測する。
 * @trace RFD-IT-013
 * @precondition OS一時Rootと有効なCROS Root入力を用意する。
 * @stimulus 一つ目のAdapterで発行し、二つ目のAdapterで認証する。
 * @observation Snapshot file、保存本文、Registry revisionおよび認証結果を観測する。
 * @oracle revision 1を再読取りでき、保存本文に生Tokenがなく、同じTokenがavailableになる。
 * @cleanup 試験用OS一時Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: Application→Runtime Root→Filesystem→再構成Application。
 */
test("不変Snapshotを別Adapterから再観測し生Tokenを保存しない", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-registry-"));
  try {
    const input = {
      platform: "win32" as const,
      trustDomainId: "test-domain",
      publisher: "qual-lab",
      application: "cros" as const,
      localAppData: root,
    };
    const first = createCredentialRegistryFileAdapter(input);
    assert.equal(first.status, "ready");
    if (first.status !== "ready") assert.fail("file adapter must be ready");
    const issued = issueConnectionCredential(
      first.registry,
      administrator,
      { profile: "developer" },
      deterministicRandom(),
    );
    if (issued.status !== "completed") assert.fail("credential must be issued");

    const registryDirectory = path.win32.join(
      root,
      "qual-lab",
      "cros",
      "test-domain",
      "credential-registry",
    );
    const files = readdirSync(registryDirectory);
    assert.deepEqual(files, ["registry-0000000001.json"]);
    assert.equal(
      readFileSync(
        path.win32.join(registryDirectory, files[0] ?? ""),
        "utf8",
      ).includes(issued.token),
      false,
    );

    const second = createCredentialRegistryFileAdapter(input);
    if (second.status !== "ready") assert.fail("second adapter must be ready");
    assert.equal(second.registry.inspect().revision, 1);
    assert.equal(
      authenticateConnectionCredential(second.registry, issued.token).status,
      "available",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 二つのWriterが同じ次revisionを公開する競合を検証する。
 *
 * @responsibility 排他的publishで一方だけが成功し、自動上書きしないことを観測する。
 * @trace RFD-IT-013
 * @precondition 同じ空Trust Domainへ接続した二Adapterを用意する。
 * @stimulus 両Adapterが観測したrevision 0から別の空Snapshotを順にpublishする。
 * @observation boolean結果と最終revisionを観測する。
 * @oracle 最初だけtrue、二つ目はfalse、最終revisionは1となる。
 * @cleanup 試験用OS一時Rootを再帰削除する。
 * @boundary RFD-IT-013=Direct Boundary: 並行Writer→排他的Filesystem publish。
 */
test("同じ次revisionの二重publishを競合として拒否する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-registry-conflict-"));
  try {
    const input = {
      platform: "win32" as const,
      trustDomainId: "conflict-domain",
      publisher: "qual-lab",
      application: "cros" as const,
      localAppData: root,
    };
    const left = createCredentialRegistryFileAdapter(input);
    const right = createCredentialRegistryFileAdapter(input);
    if (left.status !== "ready" || right.status !== "ready")
      assert.fail("both adapters must be ready");
    assert.equal(left.registry.publish(0, []), true);
    assert.equal(right.registry.publish(0, []), false);
    assert.equal(right.registry.inspect().revision, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 不正Runtime Root入力をFilesystem Effect 0で拒否することを検証する。
 *
 * @responsibility 任意相対Pathや不正Trust DomainをRegistry保存先として受理しない。
 * @trace RFD-IT-013
 * @precondition 相対localAppDataと不正Trust Domainを用意する。
 * @stimulus File Adapter生成を要求する。
 * @observation status、reasonおよびregistryを観測する。
 * @oracle blocked、固定reason、registry=nullとなる。
 * @cleanup N/A: Filesystem Effectは発生しない。
 * @boundary RFD-IT-013=Direct Boundary: 外部構成→Runtime Data Resolver。
 */
test("不正Runtime RootをEffect 0で拒否する", () => {
  assert.deepEqual(
    createCredentialRegistryFileAdapter({
      platform: "win32",
      trustDomainId: "../escape",
      publisher: "qual-lab",
      application: "cros",
      localAppData: "relative",
    }),
    {
      status: "blocked",
      reason: "credential_registry_runtime_root_invalid",
      registry: null,
    },
  );
});
