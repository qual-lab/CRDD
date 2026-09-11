# 変更トレース: Runtime Data ContractとTrust Domain

変更ID: `CHG-000066`
状態: `Open`
担当責任者: Qual-Lab
対象版: `v0.21.0`
変更分類: `feature`
最終更新日: 2026-09-12

## 1. 結論と現在状態

Repository-local `.crdd`を、そのRepositoryだけに属する設定、Runtime状態、Evidenceおよび一時物の境界として再構成する。複数Repositoryを扱うCROS状態は、配布主体、ApplicationおよびTrust Domainごとに分離したOS管理Rootへ置く。

現行Pathと物理残存の棚卸し、目標Architecture、共通Schema／Path Resolver、利用側移行、旧Path拒否、段階的結合試験およびCRDD公式Repository自身の物理清掃まで完了した。全体Checkerと選択回帰による固定候補前確認を残している。

| 項目 | 現在状態 |
|---|---|
| 現行Path棚卸し | 完了 |
| 目標Directory Taxonomy | Candidate固定済み |
| `tmp/`の限定用途 | Candidate固定済み |
| Recovery所有 | Component所有へ固定 |
| Repository Manifest／Trust Policy Schema | 実装・契約試験済み |
| 共通Path Resolver | 実装・Windows／Linux論理Path試験済み |
| Consumer移行・旧Path拒否 | 実装・本番Source、公開案内、SPEC、WorkflowのFocused Test済み |
| `tmp/`所有・清掃契約 | 実装・全終端経路、Evidence要否、Process再入場試験済み |
| 既存物理残存の清掃 | 完了・退避後不存在を確認 |
| 全体Checker／選択回帰 | Checker 431文書でError 0。変更影響計画を固定し、外部Providerを使わない対象確認を完了。独立レビュー待ち |

## 2. 契機と人間が決定した範囲

| 項目 | 内容 |
|---|---|
| 契機 | v0.18からv0.20の署名、E2E、診断、回復および手動作業が`.crdd`直下と重複Directoryへ累積し、用途・Owner・Lifecycleを追跡しにくくなった |
| Roadmap | [v0.21 `.crdd` Runtime Data Contractと構造化基盤](../../99_Roadmap/01_Product_Roadmap.md#12-v0210--project運営信頼複数repository) |
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
| Roadmap | [v0.21未完了作業](../../99_Roadmap/01_Product_Roadmap.md#12-v0210--project運営信頼複数repository) |
| 実装 | `40_Develop/runtime-data/`、Coordinator／Execution Intelligence利用側、Checker旧Path拒否 |
| 検証結果 | Runtime Data 14/14、Execution Intelligence 41/41、Project Runtime対象97件中旧期待値2件を是正して対象再試験成功、Test Catalog 19/19、Coordinator関連結合201/201、署名契約15/15、回帰計画契約17/17、全体Checker 431文書・3,109 Link・Error 0 |

## 9. Retentionと清掃の初期境界

初期実装では、経過時間だけによる自動削除を行わない。自動清掃は、所有Identity、処理のsettlement、未解決Recovery参照0、正式Evidenceへの必要情報の昇格、対象が利用中でないこと、および削除後不存在を確認できる対象だけに限定する。

容量または件数上限へ到達しても、参照中の古い内容を自動で押し出さない。新規Effectを安全に停止し、清掃候補、保持理由および必要な人間処置を構造化結果で示す。具体的な既定容量は実装と代表運用量を確認して固定する。

## 10. リリースと後続

- 対象リリース: `v0.21.0`
- 収録リリース: 未収録
- 次のGate: 全体Checker、選択回帰、独立レビュー
- 後続: Project Management Projection、Capability Registry、CROS、Remote MCPは本変更の構造化されたRootとIdentityを利用する
