# 変更トレース: v1候補の統合とArchitecture Candidate再基準化

変更トレースID: `CHG-000014`
状態: `Ready for Verification`
担当責任者: Qual-Lab
最終更新日: 2026-08-11
対象系列: v1
対象バージョン: 未確定
変更分類: `normative`／`breaking`（統合差分としての候補、未確定）
リリースレベル: 未確定
`migration_required`: `true`（規範変更候補。Architecture Candidateの同居だけからは発火しない）

正本規則: [変更](../../12_Change.md)

## 1. 人間による判断と目的

Qual-Labの人間の決定権限者は、Current Decision Set候補とCommunication候補を一つのv1候補branchへ統合し、旧v2の7文書をv1 Architecture Candidateとして再基準化することを承認した。

この判断は候補の統合であり、v1.0.0、現行準拠、Architectureの規範採用、Authority拡張、Runtime有効化、main統合、CHANGELOGまたはReleaseの承認ではない。

## 2. 統合した来歴

| 系列 | Source Commit | 統合時の扱い |
|---|---|---|
| Current Decision Set | `dd617e7f15d413e363d041b0008922ebe89d811c` | v1規範変更候補として統合し、人間レビューの追加2指摘を最新版へ是正 |
| Communication | `04350294ff4031af09893edf21c136cbadbb01be` | v1規範変更候補として意味mergeし、暫定CHG IDを再採番 |
| 旧v2 Architecture | `cd9795d885f3500ab2ef43a25c37c3737fd01e21` | 7文書を非規範v1 Architecture Candidateへ再基準化 |

旧系列のCommitとmerge履歴は来歴として保持するが、旧branchを継続同期元、自動上書き元、採用基準またはReleased baselineとして扱わない。今後の変更は、公開基準、規範変更候補、Architecture Candidate間の意味差を新しい変更として評価する。

## 3. CHG IDの一意化

Communicationのsource Commitでは`CHG-000012_Communication_Market_and_Adoption_Exploration.md`を暫定使用していたが、Current Decision Setも`CHG-000012`を使用していた。人間の決定により、統合候補の有効IDを次に固定した。

- `CHG-000012`: Current Decision Set
- `CHG-000013`: Communicationの市場・採用探索
- `CHG-000014`: 本統合とArchitecture Candidate再基準化

Communicationの旧IDと旧ファイル名はsource Commitを解釈する来歴であり、現在の別名または有効IDとして使用しない。

## 4. 三つの状態境界

| 区分 | 内容 | 現在成立しないもの |
|---|---|---|
| 公開済みCRDD v0.17.0 | 現在の公開基準 | 本候補による自動変更 |
| v1規範変更候補 | Current Decision Set、Communication | v1準拠、対象Version、移行完了、main統合、Release |
| v1 Architecture Candidate | Re-evaluation、Operation、Coordinator、Runtime安全、Operation Health、Forward Compatibility、Provider Routing | 規範採用、AI自動読込、Authority、Capability有効化、固定製品・UI・Agent構成 |

同じbranch、Commit、READMEまたはRoadmapに存在することを、後段の成立根拠にしない。

## 5. Architecture文書のrenameと意味変更

| 旧名称 | 現名称 |
|---|---|
| `01_CRDD_v2_Concept.md` | `01_CRDD_v1_Concept.md` |
| `02_CRDD_v2_Responsibility_Boundary.md` | `02_CRDD_v1_Responsibility_Boundary.md` |
| `03_CRDD_v2_PoC_Plan.md` | `03_CRDD_v1_PoC_Plan.md` |
| `04_CRDD_v2_Autonomous_Safety_Architecture.md` | `04_CRDD_v1_Autonomous_Safety_Architecture.md` |
| `05_CRDD_v2_Operation_Health_and_Human_Interface.md` | `05_CRDD_v1_Operation_Health_and_Human_Interface.md` |
| `06_CRDD_v2_Forward_Compatibility.md` | `06_CRDD_v1_Forward_Compatibility.md` |
| `07_CRDD_v2_Agent_and_Provider_Orchestration.md` | `07_CRDD_v1_Agent_and_Provider_Orchestration.md` |

renameだけでなく、旧系列分離、同期方向、v1対v2比較、Target、相互リンクおよびREADME英日を、公開済みv0.17.0、v1規範変更候補、非規範v1 Architecture Candidateの境界へ再基準化した。

## 6. 契約母集団と代表ケース

| ケース | 期待結果 |
|---|---|
| 現在必要な人間判断 | 現在の判断集合へ残し、決定権限者へ提示する |
| 将来必要だが現在の作業を阻害せず安全に独立保留できる判断 | 担当、再評価契機、保留影響、元根拠へ接続し、現在の判断集合から除外する |
| 現在必要な重大リスク、不可逆Effect、残存リスク受容またはAuthority競合 | 将来判断として除外せず、停止または人間へ移送する |
| 判断0件 | 形式承認を作らず、現在人間判断不要と明示する |
| 通常Communication | 市場探索を無条件発火させず、通常責務を維持する |
| 市場・採用探索のAND条件が成立 | Discovery正本へ接続して追加探索する |
| AND条件に偽がなく少なくとも一方が不明 | 通常Communicationを維持し、追加探索だけ確認待ちとする |
| Communication非適用 | 空のCommunication成果物を作らない |
| 許可した処理境界内のOperation | 既存Policyと完了条件に従い、外部EffectやPromotionを推定しない |
| 境界、AuthorityまたはCurrent Revisionが不明 | Fail Closedとし、人間または再評価へ戻す |
| 正式Findingを是正 | 更新固定改訂版、再検証、必要な独立再レビューを経るまで`Resolved`にしない |
| Findingなし・Review非該当の軽量Operation | 新しいReview、承認、状態または擬似`Resolved`を追加しない |
| Architecture Candidateが同じbranchに存在 | v1準拠、規範採用、Authority、Runtime実装またはReleaseを成立させない |

## 7. 変更禁止範囲

- Architecture Candidateの内容を`01_Principles.md`、`10_Agent.md`、`11_Skill.md`、準拠基準その他の現行正本へ先取り移植しない。
- Current Decision SetまたはCommunicationの片側を、重複利用側の競合解消で失わない。
- 新しい成果物、状態軸、承認段階、中央台帳、固定Schema、固定Coordinator製品、Queue UIまたはAgent構成を要求しない。
- Human Authority、External Information Boundary、Independent Review、Promotion、Policy-contained Completionを弱めない。
- 公開済みタグ、過去CHANGELOG、main、正本文書のVersionを変更しない。

## 8. 固定と検証

旧3系列のChecker、レビューおよび監査のPassは統合候補の合否へ流用しない。内容統合と実差分照合後に新しいCommit／Treeを固定し、リポジトリ全体Checkerを一度実行して共通入力とする。

必須監査集合は次の3系統である。

1. Agent／Architecture Review: Coordinator、Current Decision Set、Independent Review、Communication／Discovery、人間対象調査、Security／Privacy／External Information Boundaryを含む。
2. Document Audit: rename、相互リンク、README英日、CHG一意性、用語、正本重複、候補とRelease境界を含む。
3. Gap／Impact＋Conformance Audit: 契約母集団、利用側母集団、現行v0.17.0準拠非影響、移行候補および非規範Architecture境界を含む。

現在状態は`Ready for Verification`である。固定後Identity、Checker、3監査、対象Version、最終分類、移行、CHANGELOG、main統合、公開およびReleaseは未完了であり、取得前にPassまたはRelease Handoffを先取りしない。
