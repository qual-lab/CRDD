# 変更トレース: Runtime Data ContractとTrust Domain

変更ID: `CHG-000066`
状態: `Ready for Release Handoff`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `feature`
最終更新日: 2026-09-12

## 1. 結論と現在状態

Repository-local `.crdd`を、そのRepositoryだけに属する設定、Runtime状態、Evidenceおよび一時物の境界として再構成する。複数Repositoryを扱うCROS状態は、配布主体、ApplicationおよびTrust Domainごとに分離したOS管理Rootへ置く。

現行Pathと物理残存の棚卸し、目標Architecture、共通Schema／Path Resolver、利用側移行、旧Path拒否、段階的結合試験およびCRDD公式Repository自身の物理清掃まで完了した。独立レビューで検出したConsumer閉包と`tmp`耐久回復を構造是正し、固定Commit `672a3e76`の独立再レビュー、全回帰、署名、正式4経路E2EおよびRecovery Matrixまで成立した。

| 項目 | 現在状態 |
|---|---|
| 現行Path棚卸し | 完了 |
| 目標Directory Taxonomy | 実装・検証完了 |
| `tmp/`の限定用途 | 実装・検証完了 |
| Recovery所有 | Component所有へ固定 |
| Repository Manifest／Trust Policy Schema | 実装・契約試験済み |
| 共通Path Resolver | 実装・Windows／Linux論理Path試験済み |
| Consumer移行・旧Path拒否 | 実装・本番Source、公開案内、SPEC、WorkflowのFocused Test済み |
| `tmp/`所有・清掃契約 | 外部制御面、呼出し前Identity、公開前staging、Canonical公開直後の同一file alias回収、`preparing`、Owner Process、caller-known次世代Identity、single-use再入場、正式Evidence Receipt、全終端、部分清掃・Lock削除失敗を実装・試験済み |
| 既存物理残存の清掃 | 現在の退役Path不存在を確認。削除前item単位Inventoryを欠くため、過去の移送完全性は未証明と明示 |
| 独立再レビュー | Critical／Major／Moderate／Minorすべて0で`Pass` |
| 全体Checker／回帰 | Repository全体Checker Error 0／Warning 0。Runtime Data 30/30、Execution Intelligence 41/41、Project Runtime 60/60、Coordinator 1981成功／5明示Skip／失敗0、Windows実Process Gate 8/8、Git packed-object結合14/14が成立 |
| 署名／正式E2E | Runtime Execution Identity署名、4経路4/4およびRecovery 7/7が成立。cleanup確認済み、手動Recovery不要、正本Repository変更なし |

## 2. 契機と人間が決定した範囲

| 項目 | 内容 |
|---|---|
| 契機 | v0.18からv0.20の署名、E2E、診断、回復および手動作業が`.crdd`直下と重複Directoryへ累積し、用途・Owner・Lifecycleを追跡しにくくなった |
| Roadmap | [v0.21 `.crdd` Runtime Data Contractと構造化基盤](../../99_Roadmap/01_Product_Roadmap.md#11-v0210--project運営信頼複数repository) |
| 着手判断 | 2026-09-12の利用者対話で、棚卸し、親子階層、Repository-local／CROS分離、Trust Domainおよび`tmp/`契約を確認した |
| 基準版 | `v0.20.0` |

人間が決定した範囲は次である。

- Repository内の`.crdd`には、そのRepositoryの情報だけを置く。
- Repository RootがProjectの物理境界であり、同じProject IDで不要に階層を深くしない。
- `repository-manifest.json`と`external-send-policy.json`を`.crdd/config/`へ置く。
- `.crdd`直下にfileを置かない。
- `tmp/`は未分類物の置場にせず、Operation所有の再生成可能な短期中間物だけに使う。
- Recoveryは状態遷移、再入場および解消を所有するComponentの配下へ置き、中央へ同じ義務を複製しない。
- CROSは`qual-lab/cros/<trust-domain-id>/`の論理PathをWindows／Linuxで共通化する。
- v0.21では一つのCROS Processを一つのTrust Domainへだけ接続する。

## 3. 主な変更意図

```text
現行Pathと残存物
  ↓ Owner・用途・Lifecycleを分類
Repository-local Runtime Data Contract
  ├ config
  ├ component-owned durable state
  ├ evidence／candidate／release
  ├ tests
  └ operation-owned tmp
  ↓
共通Path ResolverとSchema
  ↓
全Producer／Consumer／Recovery／Release経路を移行
  ↓
旧Path再生成を拒否
  ↓
未完了RecoveryとEvidenceを保った物理清掃
```

Repository-local状態、CROS横断状態、User／Host Runtime状態を混在させず、人間、AI、CLI、MCPおよび将来のWorkbenchが同じIdentityとLifecycleを利用できるようにする。

## 4. 対象範囲と変更禁止範囲

| 対象 | 処置 |
|---|---|
| `.crdd/config/` | Repository Manifestと外部送信Policyの責務・Schema・Git allowlistを固定する |
| Repository-local Runtime Data | Owner、Path、耐久性、Retention、Cleanup、Recoveryを固定する |
| CROS Runtime Root | Trust Domain単位のOS Path解決、Process境界、Repository Bindingを設計する |
| Path Consumer | Producer、Reader、署名、Release、Checker、ひな型、試験を一括移行する |
| 既存残存 | 由来、参照、Recovery義務、Evidence昇格を確認して移送または清掃する |

次は対象外または変更禁止とする。

- CROS Broker、複数Trust Domainを扱う一つのProcess、一般Internet公開を実装しない。
- Linux常設Runtimeをv0.21へ前倒ししない。LinuxではPath意味とAdapter境界だけを設計する。
- Secret、Token、Password、秘密鍵または絶対Repository PathをRepository Manifestへ保存しない。
- Trust Policy、Manifest、Repository登録または署名だけから個別Operation Authorityを生成しない。
- 旧Pathへの互換書込み、二重書込みまたは同じRecovery義務の複製を残さない。
- 名前または経過時間だけから既存残存を削除しない。

## 5. IdentityとTrustの既定

| Identity／Policy | 既定 |
|---|---|
| Project ID | Repository Manifestが所有する論理Project Identity。clone／worktreeでは維持する |
| Repository Binding ID | Project IDと特定の検証済みRepository Root／worktreeを実行時に結ぶ |
| 重複Binding | 同じTrust Domain内で同じProject IDへ複数の書込み可能Bindingを自動選択せず、Effect 0で停止する |
| 独立Fork | 別Projectとして登録する場合は人間の決定によりProject IDを再発行する。Git上のfork状態だけで自動判断しない |
| Trust Domain ID | 人間、会社等の信頼境界を表す安定ID。Process起動ごとに生成しない |
| Trust Domain選択 | CROS／MCP起動時に明示する。暗黙の`default`を生成しない |
| Trust Policy | Runtime発行者、Repository登録方式、Capability上限、接続方式を所有する。Secretと個別Operation Authorityは所有しない |

実行可能範囲は次の積で決まり、いずれか一つから推定しない。

```text
Repository Manifest declaration
  ∩ Trust Policy
  ∩ Actor Authorization
  ∩ Operation Authority
  ∩ Repository-specific Policy
```

## 6. 固定前の収束確認

| 観点 | 現在の処置 |
|---|---|
| 変更する契約母集団 | Path、Repository Manifest、外部送信Policy、Project／Binding／Trust Domain Identity、Retention、Cleanup、Recovery |
| 既知の利用側 | Coordinator、Project Runtime、Execution Intelligence、MCP、Platform Access、Checker、Release署名・検証、ひな型、試験Script |
| 発火例 | Operation所有の再生成可能な一時展開は`tmp/<operation-id>/`へ置き、全終端経路で清掃する |
| 非発火例 | 繰り返し使用するScript、正式Evidence、Recovery情報、Release stagingは`tmp/`へ置かない |
| 境界例 | 診断logは一時解析だけなら`tmp/`、判断根拠として保持するなら`execution/`または`verification/`へ昇格する |
| 判定情報不足 | Owner、用途、再生成元またはCleanupを確認できない場合は書込みCapabilityを発行しない |
| 不変条件 | Canonical Path／IdentityをConsumerが再解釈せず、同じRecovery義務を複数領域へ保存しない |

## 7. 変更経路と検証計画

```text
Architecture／Schema
  ↓
Path ResolverとRepository Manifest
  ↓
本番Producer／Consumerの閉包移行
  ↓
Component単位契約試験
  ↓
隣接Block間の段階的結合試験
  ↓
旧Path拒否・Migration・Cleanup試験
  ↓
公開入口からの総合試験
  ↓
独立レビューと必須監査
```

検証では少なくとも次を確認する。

- WindowsとLinuxの同じ論理RootがPlatform Adapterから決定論的に解決される。
- Repository Root、Git管理対象、symlink／junction、途中のRepository境界を誤認しない。
- `.crdd`直下file、未登録Top-level、旧Path、別Trust Domainおよび別Repositoryへの書込みをEffect前に拒否する。
- `tmp/`が正常、失敗、取消、Timeout、親Process喪失で清掃またはexact Recoveryへ結合される。
- Manifest、Policy、Binding、Trust DomainおよびOperation Authorityの一部成立を全体許可へ拡張しない。
- 現行の署名、Release、RecoveryおよびExecution Intelligence Capabilityを失わない。

## 8. 正本・実装・検証の参照

| 種別 | 参照 |
|---|---|
| 現行調査 | [Runtime Dataの現行Path棚卸し](../../06_Architecture/runtime-data/01_Current_Path_Inventory.md) |
| 目標設計 | [Runtime Dataの目標Architecture](../../06_Architecture/runtime-data/02_Target_Architecture.md) |
| Discovery | [Runtime／CROS Product Candidates](../../01_Discovery/02_Runtime_and_CROS_Product_Candidates.md#5-crdd-runtime-data-contractとcrddcros構造化基盤) |
| Roadmap | [v0.21未完了作業](../../99_Roadmap/01_Product_Roadmap.md#11-v0210--project運営信頼複数repository) |
| 実装 | `40_Develop/runtime-data/`、Coordinator／Execution Intelligence利用側、Checker旧Path拒否 |
| 検証結果 | [固定候補の署名・回帰・正式E2E](#12-固定候補の完了evidence) |

## 9. Retentionと清掃の初期境界

初期実装では、経過時間だけによる自動削除を行わない。自動清掃は、所有Identity、処理のsettlement、未解決Recovery参照0、正式Evidenceへの必要情報の昇格、対象が利用中でないこと、および削除後不存在を確認できる対象だけに限定する。

容量または件数上限へ到達しても、参照中の古い内容を自動で押し出さない。新規Effectを安全に停止し、清掃候補、保持理由および必要な人間処置を構造化結果で示す。具体的な既定容量は実装と代表運用量を確認して固定する。

## 10. 独立レビューによる構造是正

| 指摘クラスタ | 原因 | 構造是正 | 反証 |
|---|---|---|---|
| Root CapabilityとConsumer Closure | raw文字列Root入口とCanonical Pathの利用側再構成が残り、手書き一覧だけでは署名等の希少Consumerを証明できなかった | 公開入口をRoot Capability必須へ限定し、署名だけは固定module位置から導出する非公開Resolverへ接続。実Sourceから保護Consumer集合、raw入口、未登録領域および名前付きPathの親逆算を導出してCheckerの宣言集合と照合 | 任意絶対Directory、公開indexからの内部Resolver取得、`dirname(namedPath)`から変数・Helper経由で行う未登録領域、予定外署名Consumerを拒否 |
| `tmp`の耐久回復 | in-place書込み、制御文書と削除対象Workspaceの同居、Canonical公開前の匿名Effect、Effect後のIdentity生成、旧世代参照の再利用およびEvidence source未結合により、返したRecovery参照を利用できない経路があった | `.operations/`へ制御面を分離。初回文書・Lockをcaller-known Identityのstagingへflushして完全な文書だけを排他的linkし、Canonical公開直後に残った同一file aliasだけを検証して回収する。再入場前に異なる次世代Identityをcallerが固定し、旧世代参照を受理せず、`released` Lock、清掃前の`recovery_required`公開、work sourceと昇格先の両Hash結合を維持する | 初回staging書込み中／flush後／Canonical link直後／read-back後、Lockの同じ各境界、新世代公開後・返却前／新世代返却後の各Process loss、部分清掃、Lock削除失敗、旧参照replay、source欠落／不一致からexact再入場とEffect 0を確認 |
| 全Consumer自動検出 | Tool名の手書き列挙と代表的なliteral joinだけでは、新規Component、変数segmentおよびHelper経由のRoot再解釈を検出できなかった | `40_Develop/<component>/{src,scripts,bin}`を実Sourceから自動母集団化し、公開Resolverからraw `.crdd` Rootを除外。Consumerは名前付き領域の作成・検証APIだけを利用する | 未登録の新規Tool、変数segment、Helper経由のRoot利用をCheckerで拒否し、既存Consumerを名前付き領域へ移行 |

PIDだけによるOwner生存確認は、PID再利用を同一Processの生存と誤認し得る。現在版は資源を自動削除しない安全側の可用性制約として保持する。担当責任者はRuntime Data／Platform Accessの保守担当とし、長期Operation、自動回復時間保証、LinuxまたはRemote Runtimeの導入前に、Process開始IdentityまたはHost boot Identityとの結合を再評価する。

## 11. リリースと後続

- 対象リリース: `v0.21.0`
- 収録リリース: 未収録
- 本変更のGate: 完了
- 次のGate: v0.21.0の他項目と統合したRelease Candidateの監査およびリリース判断
- 後続: Project Management Projection、Capability Registry、CROS、Remote MCPは本変更の構造化されたRootとIdentityを利用する

## 12. 固定候補の完了Evidence

固定Commit `672a3e76`について、独立再レビュー、回帰、Runtime Execution Identity署名、正式4経路E2EおよびRecovery Matrixが成立した。

| 項目 | 結果 |
|---|---|
| Source Commit／Tree | `672a3e76c8607ced6ab2abaaeaa09a0e848de3d0`／`ec0d55080c39da27b262218daae8e5d40d7e234f` |
| Package Content Root | `788d55b2fb28dc8d4f6d1e1664ba3ec9c9b640a92430d8fadb224b3302fb1318` |
| Runtime Execution Identity | `13f3833f190190f51d32ba53543f579d5e44d62d1fab8472f8787d320d66597d` |
| 独立再レビュー | Critical／Major／Moderate／Minorすべて0、`Pass` |
| 回帰 | Runtime Data 30/30、Execution Intelligence 41/41、Project Runtime 60/60、MCP 31/31、Coordinator 1981成功／5明示Skip／失敗0 |
| 実境界 | Windows実Process Gate 8/8、Git packed-object結合14/14 |
| Repository全体Checker | Markdown 431、Local Link 3111、Anchor 1047、Error 0、Warning 0 |
| 4経路E2E | Record `0f6d3947-810a-4b78-ae65-22e2ce682e75`、forward／reverse／same-codex／same-claudeの4/4成功 |
| Recovery Matrix | Record `e5da5210-b402-4a67-a7d2-b06868dc4690`、7/7成立 |
| 終了後状態 | cleanup確認済み、手動Recovery不要、正本Repository変更なし |

5件のSkipは実Providerまたは明示的な手動実行を必要とする試験であり、未報告の失敗ではない。正式Provider経路は署名済み4経路E2Eで確認した。Recovery Matrixでは期待した安全停止を成功へ読み替えず、異常結果と再入場結果をScenario契約どおり確認した。

生の検証記録はRepository-local `.crdd/verification/`に保持し、Git配布対象にはしない。本節は公開可能な識別子、Hash、件数および判定だけを抽出した追跡用要約であり、Provider生出力、認証情報、Capabilityおよび署名鍵を含めない。Runtime Execution Identityが変化した場合は、本結果を新しいRuntime変更へ流用しない。
