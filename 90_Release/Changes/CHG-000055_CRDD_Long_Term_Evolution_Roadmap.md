# 変更トレース: CRDD長期発展方針

変更ID: `CHG-000055`
- 状態: `Ready for Release Handoff`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25（初回）／2026-08-28（§6～§7追加）
- 対象: CRDD標準自身の課題探索・要求形成における長期方向と能力到達点、エージェント組織における専門性と共有境界の明確化、単一プロダクトRoadmapへの状態投影、および課題探索・要求形成／Roadmap／変更トレースの既存責務境界
- 対象リリース: `v0.18.0 Candidate`
- 変更分類: `additive`
- `migration_required`: `false`
- リリースレベル: `MINOR`候補。v0.18.0 Candidate全体の最終分類、統合またはリリースを決定しない

正本規則: [文書化](../../03_Documentation.md#33-discovery-and-roadmap)、[課題探索・要求形成](../../21_Discovery.md#62-registry-scope-and-registration)、[変更](../../12_Change.md)

## 1. 人間の判断と目的

Qual-Labの人間の決定権限者は、CRDDの長期発展を「AI作業者 → AI開発チーム → AIネイティブ・プロジェクト → AIネイティブ組織」と捉える上位方向を採用した。第1段階はCoordinator Runtime 1.0、第2段階は実行観測と専門工程の自己適用である。Issue #30の整理、自律オペレーション実証およびv0.18.0最終化は、長期段階の能力定義へ混ぜず、独立した保守／リリース作業として扱う。

目的は、個別の研究候補やQualシリーズの構想を捨てず、現在地と次の観測地点を一つの上位地図で説明可能にすることである。第二のRoadmap、固定作業手順、将来段階の要求正本または実装計画は作らない。長期方向、研究候補および保持条件は[`CRDD標準自身の課題探索・要求形成`](../../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)が所有し、プロダクトRoadmapは判断状態、対応状態、情報源および再評価契機だけを投影する。

## 2. 採用した構造

長期発展の詳細は既存の[`01_Discovery/01_CRDD_Product_Discovery.md`](../../01_Discovery/01_CRDD_Product_Discovery.md#7-crddの長期発展方針)へ追加し、単一の[`99_Roadmap/01_Product_Roadmap.md`](../../99_Roadmap/01_Product_Roadmap.md)には現在の判断状態、対応状態、情報源および次の再評価だけを残す。

- 第1段階: Coordinator Runtime 1.0によりAI開発チームを実行可能にする。
- 第2段階: 実行観測と専門工程の自己適用により実態を観測する。
- 第3段階: プロジェクト作業、計画、リスク／Topic、人間判断およびプロジェクト状況理解をAIネイティブ・プロジェクト運営へ接続する。
- 第4段階: MCP／Runtime API等の協働接続面を評価する。
- 第5段階: 作業発生時だけ必要なAI作業者を起動できるプロジェクトRuntimeを評価する。
- 第6段階: プロジェクトからポートフォリオ投影を取得する複数プロジェクト／組織実行環境を評価する。

Qual-Planner、Qual-TopicおよびQual-MTGは独立したプロジェクト正本ではなく、CRDDの同じプロジェクト正本へ接続する専門接続面候補として扱う。具体的な作業評価、能力モデル、キュー、スケジューラーまたはポートフォリオ投影は、該当段階の着手時に根拠と人間判断から再評価する。

今回の記録で露呈した責務の曖昧さは、新しい成果物を追加せず、[`21_Discovery.md`](../../21_Discovery.md#61-責務の境界と登録簿の位置付け)、[`03_Documentation.md`](../../03_Documentation.md#33-discovery-and-roadmap)および[`12_Change.md`](../../12_Change.md#2-変更の契機と経路)の既存条項を強化して是正する。課題探索・要求形成は意味、Roadmapは方向・順序・到達点、変更トレースは確認済み現在状態からの差分を所有する。将来プロジェクト運営等を採用する場合も三者を置換せず、変更を伴わない作業へCHGを機械的に要求しない保持条件だけを追加する。具体的な運営接続は非規範候補のままである。

## 3. 境界と影響

この変更は課題探索・要求形成への非規範の長期方向追加、Roadmapへの状態投影、および既存文書責務の明確化であり、CRDD規範の強さ、安定コンテキストID、公開スキーマ、実行環境、決定権限、セキュリティ、プロバイダー、課金、移行、Issue #30の採否またはリリース判断を変更しない。段階番号は長期方向を説明する表示であり、全段階の直列実施、固定期限、固定成果物、前段の完全終了または実装許可を意味しない。

Coordinator Runtimeの完了条件と根拠は[`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)、上流工程強化の要求候補は[`01_Discovery/01_CRDD_Product_Discovery.md`](../../01_Discovery/01_CRDD_Product_Discovery.md)、v0.18.0の統合境界は[`CHG-000014`](CHG-000014_V018_Architecture_Candidate_Integration.md)が引き続き所有する。Issue #30、自律オペレーション実証およびリリース作業の意味や状態も本変更へ複製しない。

## 4. 初回監査結果と統合是正

初回固定前差分のアーキテクチャ／セキュリティ／準拠レビュー、文書監査および不足／影響・利用導線監査は、Critical 0件、複数のMajor／Minor指摘を伴い`Fail`となった。共通原因は、長期方向とアーキテクチャ候補をプロダクトRoadmapへ直接置いて登録簿を第二正本化したこと、第1段階へ第2段階の上流工程自己適用と横断リリース作業を混在させたこと、CHG-000055を未完了行として登録しなかったこと、原案の詳細研究候補をリポジトリ内の情報源へ保存しなかったこと、および利用者ロケール優先表示、変更分類、対象リリース、リリースレベルの不足である。

全監査結果を統合し、長期方向、判断理由、段階、研究候補、保持条件および次の観測地点を既存の課題探索・要求形成へ移し、Roadmapを状態投影へ縮約する。第1段階はCoordinator Runtimeだけへ限定し、実行観測と上流工程の自己適用を第2段階へ置く。Issue #30、自律オペレーション実証およびv0.18.0最終化は独立した現在作業として維持する。変更分類を`additive`、対象リリースを`v0.18.0 Candidate`、リリースレベルを`MINOR`候補へ補正し、README日英の既存導線を長期方向正本とRoadmapへ分離する。

この処置は第1固定版では`Applied`／`Self-checked`であり、指摘事項を`Resolved`または監査を`Pass`とする根拠には使用しなかった。後述する新固定改訂版へ同じ監査集合を再実行して解消を確認した。

## 5. 最終確認結果

固定改訂版`cf03e0c204d1833005a3f01ea4d18eec3a2d28ae`（Tree `360c4c365f39dc425f7f85a33dc626c5708e53ff`）へ、リポジトリ全体Checker、アーキテクチャ／セキュリティ／準拠レビュー、文書監査および不足／影響・利用導線監査を一つの必須集合として実行した。

- リポジトリ全体Checker: 701 files、384 Markdown、2,236 links、650 anchors、Error 0、Warning 0
- `git diff --check`: Pass
- Coordinator試験: 771 / 771 Pass
- アーキテクチャ／セキュリティ／準拠レビュー: Critical 0、Major 0、Minor 0、Pass
- 文書監査: Critical 0、Major 0、Minor 0、Pass
- 不足／影響・利用導線監査: Critical 0、Major 0、Minor 0、Pass

確認は、単一Roadmap原則、第1段階と現在作業の接続、将来候補と要求／実装許可の分離、課題探索・要求形成／Roadmap／CHGの責務、プロジェクト運営の条件付き非置換境界、既存アーキテクチャとの重複、準拠・移行非変更、およびREADME等から必要な導線を含む。前回のCHGと実行根拠、未採用プロジェクト運営の具体化、利用者ロケール優先表示および必須監査集合の指摘事項は全数`Resolved`となり、新規指摘事項はない。

本変更の記録自体に追加の人間判断は必要ない。v0.18.0への統合およびリリースは別の人間判断である。

## 6. Coordinator Runtime自己適用から追加した改善候補

2026-08-28、Qual-Labの人間の決定権限者は、Coordinator Runtime 1.0の収束過程で得た学びを、既存の第2段階へ追加することを採用した。追加対象は次の三つであり、詳細な意味と保持条件は[`CRDD標準自身の課題探索・要求形成`](../../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)が所有する。

- 振る舞い仕様、アーキテクチャ、検証設計、実装および検証を接続し、正常・準正常・異常・回復を状態、遷移、資源、観測および失敗注入点へ対応させる。
- Runtime 1.0完成後、反復Findingと実測Evidenceからオペレーション・ライフサイクル、資源ライフサイクル／台帳、外部接続、Repository選択・接続、PlatformおよびProviderの安定した責務境界だけを抽出する。
- 人間可読文書の意味構造を改善し、新規文書だけでなく現行系列から参照する既存文書と過去CHGも棚卸し対象に含める。

この追加は、Coordinator Runtime 1.0の完成条件、現在の実装Architecture、工程数、固定成果物、共通Trace Schema、Multi-platform対応、MCP、Project RuntimeまたはRelease範囲を変更しない。採用したのはRuntime 1.0完成後に実測根拠から安定境界を抽出する作業意図であり、Linux常設Runtime、複数Repository、MCP／HTTP、Self-hosted Provider、Project／Organization Runtime、Adapter名、APIまたは互換性は第4～第6段階の研究候補である。過去CHGを対象に含めることは公開済みtagまたは履歴事実の書換えを許可せず、変更ID、判断、当時状態、Evidence、参照および時系列を保持した情報欠落のない表現改善に限る。

単一Roadmapには三項目の判断状態、対応状態、情報源および次の処置だけを追加した。既存のMCP／協働接続面、Project Runtimeおよび複数プロジェクト／組織実行環境は既に第4～第6段階の研究候補として記録済みであるため、重複項目を追加していない。本追記は`additive`かつ`migration_required=false`を維持する。更新固定版の文書監査、不足／影響監査およびリポジトリ全体Checkerが完了するまで、本節の追加分を確認済みへ昇格しない。

## 7. CRDD版の発展（Version Evolution）と専門性の責務分離

2026-08-28、Qual-Labの人間の決定権限者は、長期方向をCRDD v0.18.0 Candidate、版未割当の採用済み改善、ならびに将来のCRDD v0.19.0、v1.0.0、v1.x、v2.xおよび将来（Future）という人間可読な能力到達点へ投影する表示枠組みを採用した。あわせて、専門機能をCRDDの共有責務境界へ増やし続けず、まず個別ProjectのContextとRole／Skillによる自己適用で成立性を確認する方向を採用した。

採用したのは、能力到達点の表示枠組みと、実測から責務境界を抽出する根拠駆動ループである。版未割当の改善意図はv0.18.0または将来版への収載予約ではなく、v0.19.0、v1.0.0、v1.x、v2.xおよび将来（Future）の個別能力像は`Held / Unscheduled`として登録した。将来Versionの予約、Release Candidate、収載、期限、互換性、PM／QA／Planner等の具体機能、UI、MCP、Remote Runtime、Linux、Self-hosted Provider、Organization Runtime、共有責務境界の分割方式またはReleaseを採用していない。Versionは公開差分と互換性を所有する[`19_Maintenance.md`](../../19_Maintenance.md#51-release-version-and-revision)に従い、実現時の採用済み差分と人間判断から再割当できる。

[`04_Agent_Organization.md`](../../04_Agent_Organization.md#41-専門性と共有境界)には、既存の`Role ≠ Specialty ≠ Capability ≠ Authority`を変えず、個別ProjectのCRDD正本成果物、Role／Skill、Runtimeおよび協働接続面の責務を明確化した。これは新しい必須Role、Skill、成果物、固定フローまたは準拠条件ではなく、既存原則の`additive`な明確化である。

利用側母集団として、AgentのRole／Authorityは`10_Agent.md`、Skillの成立性は`11_Skill.md`、品質状態は`16_Quality_Assurance.md`、自律Operationは`05_Autonomous_Operation.md`、準拠判定は`52_Conformance_Audit.md`の既存責務を維持するため本文変更不要と判定した。root／template `AGENTS.md`も、決定権限、専門判断、実行および監査の既存接続を変更しないため非該当である。新しい規範、移行または実装を追加しないため、`additive`、`migration_required=false`、現Runtime、v0.18.0 CandidateのRelease範囲およびT1～T2境界を維持する。

本節と関連正本は監査前の`Reopened`状態である。更新固定版の全体Checker、文書、不足／影響、準拠、Security／ArchitectureおよびTest／UXの確認が完了するまで、確認済みまたはRelease準備完了へ昇格しない。

## 8. 追加判断の最終確認

固定改訂版`9dc376e29efa40d558fc904136e7c20e051383a2`（Tree `eba63d10e0f70968c4ac1ca7defee646caa262fb`）へ、リポジトリ全体Checker、Security／Architecture、Test／UX、文書、不足／影響および準拠の確認を実施した。

- リポジトリ全体Checker: 356 Markdown、2,121 links、637 anchors、Error 0、Warning 0
- `git diff --check`: Pass
- Security／Architecture: Critical 0、Major 0、Minor 0、Pass
- Test／UX: Critical 0、Major 0、Minor 0、Pass
- 文書／不足／影響／準拠: Critical 0、Major 0、Minor 0、Pass／No Impact

確認は、現在のv0.18.0 Candidate、版未割当の`Adopted / Planned`改善、将来の`Held / Unscheduled`能力地平、Phase／Versionの直交、専門性と共有責務境界、Authority、現RuntimeおよびRelease非変更を含む。監査で検出したTopology、Credential／Capability所有、情報密度、状態混在、再評価契機およびローカル表示の指摘は全数`Resolved`となり、新規Findingはない。

本変更は`Ready for Release Handoff`である。これはmain統合、Stable化、タグ、公開またはReleaseを意味せず、それらはv0.18.0 Candidate全体の別の人間判断である。
