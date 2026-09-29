# Phase 5 実Provider E2Eの契約整合

## 結論

署名済み実Provider E2Eは17件の不一致で停止した。調査の結果、17件を独立した障害として扱わず、次の3つの契約ずれへ集約した。

1. Provider境界の設定・Process開始・終了診断を、検証Observerが同じ閉じたLifecycle Event集合として認識していなかった。
2. Integration Record Adapterが正規Candidate Identityより狭い128文字制限を持ち、`candidate.<64hex>.<64hex>`を拒否していた。
3. 検証契約がTask完了・候補採用をObjective／Milestone受入済みと期待し、現行Architectureの人間受入Authority分離と一致していなかった。

Source、ArchitectureおよびQualityの候補を是正し、型・Lint・生成契約、局所契約33件、Portable全回帰2,120件、および実環境Host Windows 93件を確認した。独立実装レビュー、文書監査およびGap影響確認に阻害指摘はない。再署名後の実Provider E2Eと四経路E2Eは未実施であり、本EvidenceからProduction Closureを主張しない。

## 署名済み実境界の観測

| 項目 | 観測結果 |
|---|---|
| 結果契約 | `crdd-coordinator/project-runtime-real-provider-verification` revision 8 |
| 状態 | `blocked` |
| 理由 | `project_runtime_public_mcp_verification_incomplete` |
| 不一致数 | 17 |
| cleanup | `confirmed` |
| 手動回復要求 | `false` |
| Process再起動要求 | `false` |
| Docker Task Recovery Inventory | 署名済み公開入口で収束後、空を確認済み |

17件には、正常Run、取消、親Process喪失、再入場およびsettlementに関する派生不一致が含まれた。Lifecycle Eventを違反へ誤分類すると、検証Callbackが抑止され、取消や親喪失自体が発火しないため、派生件数を原因数として扱わない。

## 原因と是正

| 原因 | 期待する正しい状態 | 是正候補 | 変更しない範囲 |
|---|---|---|---|
| Provider境界診断のSchema drift | 設定、OS Process開始、終了・cleanupを別Eventとして同じOperationへ相関する | Observerが`coordinator_provider_boundary_configured`、`coordinator_provider_process_started`、`coordinator_provider_boundary_settled`を閉集合として検証する | 未知Event、欠測、余分、順序差、Identity差を成功へ補正しない |
| Candidate IdentityのConsumer縮退 | Candidate Storeが発行した正規IdentityをIntegration Recordまで完全保持する | Adapterの識別子契約をCanonical Contractと同じ上限へ整合し、139文字の正規IDを直接試験する | 不正文字、Path逸脱、Identity collisionの拒否を維持する |
| 受入Authorityの期待値ずれ | Provider実行・候補採用後は`integration_pending`で停止し、人間の明示受入を別Capabilityとして待つ | E2Eの正常終端を`project_runtime_acceptance_decision_required`として検証する | Task完了や候補採用からObjective／Milestone受入Authorityを生成しない |

## Docker Desktop socket障害との分離

同じ時間帯にDocker Desktop内部のIngest ServerおよびSecrets Engineが、既存socketを`.stale`へrenameできず終了した。Docker Desktop関連Processは存在しており、一部内部サービスのsocket世代更新またはhandle競合が疑われる。

CRDDのrestart／repair／recoveryが近接していたためLifecycle競合は有力な原因仮説である。ただし、CRDDが直接故障を生成したこと、Docker Desktop自身の競合、または別Processによるhandle保持は識別できていない。この時間的相関を確定因果へ昇格しない。保持済みRecovery EvidenceやRuntime Directoryを削除・改名せず、追加のDocker restart／repairを局所契約確認の代わりに実行しない。

## 検証結果

| 検証 | 結果 |
|---|---|
| Formatter | 680 files、差分整形済み |
| TypeScript型検査 | Pass |
| Integration Record／実Provider検証局所契約 | 33件中33件Pass |
| Project Runtime／Coordinator関連統合 | 116件中114件Pass、Sandbox内Host Windows 2件のみProcess-tree終了観測が猶予超過 |
| Host Windows実環境再実行 | 93件中93件Pass。該当2件は約0.55秒で終了観測成立 |
| Coordinator Portable全回帰 | 2,120件中2,112件Pass、0件Fail、8件明示Skip |
| Formatter／型／Lint | 680 files format確認、681 files lint確認、型検査を含めPass |
| Runtime Capability Graph | `accepted`。Source 27、外部Process呼出し6、Runtime外部Process呼出し23 |
| Runtime Traceability | `accepted`。資源10、状態32、遷移31、不変条件12 |
| Project Runtime Design Traceability | `accepted`。Interface 9、遷移54、不変条件33、実装結合9、検証結合23 |
| Repository Checker | 内容検査は完走したが、公開済み`v0.21.0`のStable宣言を保持したfeature開発HEADであるため、`stable-release-tag-identity-mismatch` 1件で停止。v0.22 Candidate遷移後に再実行する |

Sandbox内の2件を実装失敗へ畳まず、実環境PassをHost限定Evidenceとして分離する。反対に、Portable試験の失敗をHost環境差として除外しない。最終Portable全回帰では、先に検出したTraceability期待件数のずれを是正した後、同じ2,120件を0 Failで再実行した。

## 独立確認

| 確認 | 結果 | 主な確認内容 |
|---|---|---|
| 独立実装レビュー | Finding 0 | 人間受入Authorityを生成せず、Provider境界診断を閉集合で相関し、正規Candidate Identityを縮退させない |
| 文書監査 | Finding 0 | Architecture、Quality、Registry、CHGおよびEvidenceが同じ責務境界を示す |
| Gap影響確認 | Finding 0 | Source、試験、Traceabilityおよび利用側に未接続の直接伝播を残していない |

確認は現在候補を対象に別Passとして実施した。試験Passを意味妥当性の代替にせず、受入Authority、外部送信範囲、Provider HomeおよびDocker Recovery契約を変更していないことを確認した。

## 残るGate

- Source Commitを固定し、同じTreeからCoordinator Runtimeを再署名する。
- v0.22 Candidate遷移後、Repository CheckerのStable release tag検査を再評価する。
- 署名拒否試験、署名staging直接起動、Codex／Claude実Provider E2Eを実行する。
- 同じRelease Identityで必要な四経路E2Eを実行する。

## Checklist

- [x] 17件を独立障害として水増しせず、3つの原因へ集約した。
- [x] Production Contractを弱めず、ObserverとConsumerをCanonical Contractへ合わせた。
- [x] Task完了と人間受入を分離した。
- [x] Docker socket障害の事実、原因仮説および未確認範囲を分けた。
- [x] 局所試験とHost限定試験を分けた。
- [x] Portable全回帰、静的検査、Traceabilityおよび独立確認を現在候補で完了した。
- [ ] OPEN: 再署名後の実Provider E2Eと四経路E2Eは、同じRelease Identityで再実行する。
