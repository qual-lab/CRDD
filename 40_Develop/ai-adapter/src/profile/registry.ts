/**
 * AI Profile Catalogの採用済みSnapshotと改訂競合を管理する。
 *
 * @responsibility 検証済みCatalogだけを現在値へ採用し、Candidateと採用済み構成を分ける。
 * @trace ARCH-000010
 * @boundary 設定OwnerのAdapterとAI Runtimeの不変Catalog Snapshotの境界。
 * @effect Process内の採用済みSnapshotだけを更新する。永続化とAuthority判定は呼出し側Adapterが所有する。
 * @security Catalogから秘密値、任意実行Pathおよび任意引数を受理しない。
 */
import { validateAiProfileCatalog } from "../catalog/catalog.ts";
import type {
  AiProfileCatalogRegistry,
  AiProfileCatalogSnapshot,
} from "../catalog/types.ts";

/**
 * 検証済み初期Catalogから改訂競合を拒否するRegistryを構築する。
 *
 * @responsibility Candidate検証、期待Revision照合、不可分な現在Snapshot置換を所有する。
 * @trace ARCH-000010
 * @input initialCandidate: Registryの初期Catalog候補。
 * @returns Snapshot読取りと採用操作を持つProcess内Registry。
 * @precondition initialCandidateを信頼済みCatalogと仮定しない。
 * @postcondition 採用成功時だけRevisionを1増やし、検証済みSnapshotを公開する。
 * @effect Process内のRegistry状態を更新する。Filesystem、Network、Provider Effectは発行しない。
 * @failure 初期Catalog不正は例外、更新Candidate不正またはRevision競合はEffect 0の拒否結果とする。
 * @invariant Candidateは採用前に現在Snapshotとして公開されない。
 * @boundary 設定Owner AdapterとAI Runtime Catalogの境界。
 * @security 採用Authorityは呼出し側Adapterが確認し、Registry自身はAuthorityを生成しない。
 * @concurrency JavaScript Event Loop上の同期操作としてRevision照合と置換を分離しない。
 */
export function createAiProfileCatalogRegistry(
  initialCandidate: unknown,
): AiProfileCatalogRegistry {
  const initialCatalog = validateAiProfileCatalog(initialCandidate);
  if (!initialCatalog) throw new Error("ai_profile_catalog_initial_invalid");
  let current: AiProfileCatalogSnapshot = Object.freeze({
    revision: 1,
    catalog: initialCatalog,
  });
  return Object.freeze({
    snapshot: () => current,
    adopt: (request) => {
      if (request.expectedRevision !== current.revision)
        return Object.freeze({
          status: "rejected" as const,
          reason: "revision_conflict" as const,
          revision: current.revision,
          snapshot: current,
        });
      const validated = validateAiProfileCatalog(request.candidate);
      if (!validated)
        return Object.freeze({
          status: "rejected" as const,
          reason: "catalog_invalid" as const,
          revision: current.revision,
          snapshot: current,
        });
      current = Object.freeze({
        revision: current.revision + 1,
        catalog: validated,
      });
      return Object.freeze({
        status: "adopted" as const,
        revision: current.revision,
        snapshot: current,
      });
    },
  });
}
