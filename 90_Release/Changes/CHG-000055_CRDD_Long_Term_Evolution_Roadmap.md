# 変更トレース: CRDD長期発展方針

変更ID: `CHG-000055`
- 状態: `Reopened`
- 決定権限者: Qual-Lab
- 判断日: 2026-08-25（初回）／2026-08-28（§6～§7追加、§9収載判断）／2026-08-29（Runtime終盤E2E学習、文書UXおよびHuman Decision Journey改善母集団の具体化）
- 対象: CRDD標準自身の課題探索・要求形成における長期方向と能力到達点、エージェント組織における専門性と共有境界の明確化、単一プロダクトRoadmapへの状態投影、課題探索・要求形成／Roadmap／変更トレースの既存責務境界、および三つの改善意図のv0.18.0 Candidate収載判断
- 対象リリース: `v0.18.0 Candidate`
- 変更分類: `additive`
- `migration_required`: `false`
- リリースレベル: `MINOR`候補。v0.18.0 Candidate全体の最終分類、統合またはリリースを決定しない

正本規則: [文書化](../../03_Documentation.md#33-discovery-and-roadmap)、[課題探索・要求形成](../../21_Discovery.md#62-registry-scope-and-registration)、[変更](../../12_Change.md)

現在の読み始め: [本文の可読性再是正](#25-人間可読性の本文再是正)を参照する。§1以降は採用・実装・自己適用の経緯であり、過去の確認を現在の完了判定へ流用しない。Runtimeの最新実測と残件は[CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md#1-結論と現在状態)が所有する。

2026-08-31、Tool開発構成を標準工程フォルダへ整理する後続意図を、既存の根拠駆動リファクタリングへ追加した。[構成・配布・利用者観点の比較候補](../../01_Discovery/01_CRDD_Product_Discovery.md#tool-development-layout-candidate)はDiscovery、現行修正・試験・E2E後に戻る順序は[Roadmap](../../99_Roadmap/01_Product_Roadmap.md#tool-development-layout-follow-up)が所有する。現在のファイル移動、具体的なGit／配布方式の採用、新しいRelease収載は行っていない。

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

## 9. v0.18.0 Candidateへの収載判断による再開

2026-08-28、Qual-Labの人間の決定権限者は、§6で採用した三つの改善意図、すなわち[`CRDD標準自身の課題探索・要求形成`](../../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)の§7.3.1～§7.3.3を、すべてv0.18.0 Candidateへ収載すると判断した。§7～§8で確認した「版未割当」は当時の有効な判断履歴として保持するが、現在の対象版判断は本節が置き換える。

収載対象は、上流工程エージェント／課題探索対話ループと工程接続・意味網羅検証の強化、Coordinator Reference Runtimeの根拠駆動リファクタリング、既存・過去CHGを含む人間可読文書の意味構造改善である。第2段階に残る未採用の実行観測候補、MCP、Remote Runtime、Linux、Self-hosted Provider、Project／Organization Runtimeおよびv0.19.0以降の能力地平は`Held / Unscheduled`のままであり、本判断から収載または実装許可を得ない。

実行順序は次のとおりとする。

1. [`CHG-000015`](CHG-000015_Coordinator_Runtime_1_0.md)が所有するCoordinator Runtime 1.0の完成条件、正式署名一般Task、4経路E2E、失敗・取消・回復および完成監査を固定する。
2. 完成固定版を基準に、三つの改善意図について現行正本、利用側、影響、保持する意図および対象外を再確認し、人間の着手判断を得る。
3. RuntimeをDogfoodingして変更単位ごとに実装、正常・準正常・異常の検証、独立レビューおよび必要監査を完了する。いずれかの改善がCHG-000015の対象ファイル、Runtime Architecture、Trust／Authority、Recovery、公開保証、試験閉包または配布Identityへ影響する場合はCHG-000015を再開または未完了へ戻し、改善後の固定版で完成条件、正式署名4経路E2E、失敗・取消・Recoveryおよび完成監査を再確認する。Runtime非影響の場合だけ、最終差分に対する依存閉包確認と理由付き非該当を記録して既存結果を維持する。
4. 戻り辺が収束した最終Runtime Commit／Treeと完成監査・正式署名EvidenceのIdentityを一致させたうえで、v0.18.0 Candidate全体のRelease Readiness、CHANGELOG、移行および残存リスクを更新し、人間の統合・Release判断へ渡す。

本判断は対象版への収載であって、実装着手、実装完了、規範採用、Stable化、main統合、タグ、公開またはReleaseではない。本CHGは収載判断と責務伝播を追跡し、各改善の具体的変更は、着手時に再確認した現在状態と影響を所有する一つ以上のCHGへ接続する。

§8の監査結果は「版未割当」を含む旧固定改訂版の履歴であり、現在の収載判断の確認結果へ流用しない。現在の統合境界は[`CHG-000014` §9](CHG-000014_V018_Architecture_Candidate_Integration.md#9-追加されたv0180収載境界)へ伝播した。本変更を`Ready for Release Handoff`へ戻す前に、新しい固定改訂版へリポジトリ全体Checker、Security／Architecture、Test／UX、文書、不足／影響および準拠の同じ必須監査集合を再実行する。

README、CHANGELOG、[`16_Quality_Assurance.md`](../../16_Quality_Assurance.md)およびEvidenceは、現時点では完成Capabilityまたは品質状態が変化していないため変更しない。各改善の完成固定時とv0.18.0 Release準備時に再評価し、利用者向け主張、品質状態および根拠を同期する。

## 10. 収載判断の初回監査と統合是正

固定改訂版`80a496b2f43218ad349830e3ccc2202487ecde70`（Tree `7aa8d18c6739cb588163cc395a1ad069752e09b8`）へのSecurity／Architecture、Test／UX、文書、不足／影響および準拠の必須監査集合は、Critical 0、Major 2件相当、Minor 1件相当を検出して総合`Fail`となった。共通原因は、Runtime完成後のリファクタリングからCHG-000015の完成根拠へ戻る経路がなく、Roadmap単独では三改善の共通開始Gateと現行Release Scopeを再構成できなかったことである。あわせてDiscoveryから判断Traceへの直接接続、CHG-000014／CHG-000055の現在metadataが不足していた。

統合修正では、§9へRuntime影響時のCHG-000015再開・最終Identity再固定と、非影響時の依存閉包確認を追加した。Roadmapの三項目へ共通のRuntime完成、正本／影響再確認、人間着手判断、Dogfoodingおよび変更単位の検証・監査を明示し、最終Release GateをCHG-000014の現行収載境界と本CHG §9へ直接接続した。Discoveryも現在の判断Traceへ直接接続し、両CHGのheader metadataを現在化した。

この処置は`Applied`／`Self-checked`であり、指摘事項を`Resolved`または監査を`Pass`とする根拠には使用しない。修正後の新しいCommit／Treeと全体Checkerを固定し、同じ必須監査集合へ再提示して解消と新規Findingの有無を確認する。

再固定版`ef955b930c67ed72673f52e04aef23fadb167c70`（Tree `b8ab41b0bbf125a553356b568002f07f30f3f390`）への再監査では、前回Findingを全数`Resolved`とした一方、文書監査がCHG-000014の節番号重複と旧Fail固定版のTree欠落をMinor 2件として検出した。収載境界を既存§1～§8の履歴番号を変えず§9へ改番して全参照を追従し、旧Fail監査対象を完全Commit／Treeへ固定した。この処置も`Applied`／`Self-checked`であり、新固定改訂版の同じ必須監査集合が完了するまで総合`Pass`へ昇格しない。

## 11. 収載判断の最終確認

最終固定改訂版`91d8e507161350f7d71bb5d28e0203927eca3c54`（Tree `d44b234f3e5bdce88458bbd3aff7dbb01721b571`）へ、リポジトリ全体Checker、Security／Architecture、Test／UX、文書、不足／影響および準拠の同じ必須監査集合を再実行した。

- リポジトリ全体Checker: 356 Markdown、2,135 links、644 anchors、Error 0、Warning 0
- `git diff --check`: Pass
- Coordinator試験: 1,137 / 1,137 Pass
- Coordinator Trace、型、lintおよびformat: Pass
- Security／Architecture: Critical 0、Major 0、Minor 0、Pass
- Test／UX: Critical 0、Major 0、Minor 0、Pass
- 文書／不足／影響／準拠: Critical 0、Major 0、Minor 0、Pass／No Impact

前回までのFindingは全数`Resolved`であり、新規Findingはない。三つの改善の具体実装、実Dogfooding、実装後のRuntime影響、最終署名Runtime Identity、CHANGELOG、移行、Release Readinessおよび人間の統合／Release判断は本確認の対象外で、Roadmapと§9の後続Gateへ残る。

本変更は`Ready for Release Handoff`である。これは三つの改善の完了、v0.18.0 Candidate全体の完成、Stable化、main統合、タグ、公開またはReleaseを意味しない。

## 12. Runtime終盤E2Eから具体化した工程強化母集団

2026-08-29、Qual-Labの人間の決定権限者は、Coordinator Runtime終盤の正式署名E2Eで反復したComponent間の意味不一致を、§6と§9で収載済みの工程接続・意味網羅検証へ追加してDogfoodingすることを判断した。新しい第四の改善意図や独立Roadmapは作らず、[`CRDD標準自身の課題探索・要求形成` §7.3.1](../../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)へ次の母集団を統合した。

- Human／TriggerからAuthority、Execution、Review、Remediation、Verification、cleanupおよびResult PublicationまでのSystem Journey Closure
- 重要State／ArtifactのSingle Truth／Single Owner、実Producer、Transport、Production Consumerおよび再所有禁止境界
- Runtime、AI Reviewer、Machine VerificationおよびHuman AuthorityのProperty別責務と観測可能性
- 成功、安全な拒否、Recovery、unknown、Process再起動と`null / absent / unknown`を共有する終端母集団
- 安全境界と具体的是正可能性を両立するbounded Remediation Handoff
- Subscription／API／費用等の外部metadataとOperational Limit／Policy Limit／Financial Authorityの意味分離

これは既存Runtimeへの追加Capability、固定Schema、全対象への重いTrace、工程追加または監査代替ではない。Security／Authority境界、外部Effect、Durable State、Recovery、Multi-process／取消可能な非同期Runtime、Release／Promotion、Financial EffectおよびAI間Delegation等の高複雑度・高信頼対象を主対象とし、単純なLocal処理へ過剰適用しない。実際に監査往復、伝播漏れ、試験の見逃しおよび利用者操作を減らせる最小の正本・ひな型・Checker・契約試験をRuntime完成後の自己適用で選ぶ。

§11は2026-08-28時点の固定改訂版に対する有効な確認履歴として保持する。本追記により現在状態を`Reopened`へ戻し、具体的な工程強化Dogfooding、変更単位の確認、およびv0.18.0 Candidate最終監査が終わるまで`Ready for Release Handoff`へ再昇格しない。現在、この追記の方向について追加の人間判断は必要ない。

## 13. 文書UX改善母集団の具体化

2026-08-29、Qual-Labの人間の決定権限者は、§6と§9で収載済みの人間可読文書の意味構造改善について、Runtime完成後のDogfoodingで評価する母集団を具体化した。新しい改善意図、Roadmap項目、文書Templateまたは監査種別は追加せず、[`CRDD標準自身の課題探索・要求形成` §7.3.3](../../01_Discovery/01_CRDD_Product_Discovery.md#733-人間可読文書の意味構造改善候補)へ次を統合した。

- 人間、AIおよび機械可読性を両立し、概要から根拠／履歴まで同じ正本を必要な深さで読める段階的開示
- 結論と現在状態の先出し、一文一義、平易な説明、箇条書き／表の意味に応じた利用
- 規則、変更トレース、課題探索・要求形成およびアーキテクチャの責務差に応じた文書入口
- 長期化した変更トレースにおける現在状態と履歴の分離、および短時間の現在地把握と理由再構成の両立
- Requirement、規範強度、Authority、Scope、Status、Risk、Decision、Evidenceおよび時系列を保持する意味差分確認
- 初見の主要ロケール利用者が、結論、条件、責務および次の行動を過度な解読なしに理解できるかという人間可読性確認

これは現時点で`03_Documentation.md`、`51_Document_Audit.md`、全変更トレースまたは公開済み履歴を一括変更する判断ではない。Runtime完成固定後、現行正本と利用側を再確認し、代表的な変更トレースと高密度文書で自己適用する。意味欠落を増やさず、理解、判断、現在地把握および再構成の負荷を下げられると確認した最小の規則、ひな型、Checkerまたは監査観点だけを変更単位として提案する。

公開済みtag、変更ID、当時の判断、状態、根拠および時系列は変更しない。履歴本文の直接再構成が不変参照または意味を損なう場合は、現行系列の索引、要約または補助投影を用いる。§12と同様、本節の追加は現在状態`Reopened`の範囲に含まれ、工程強化Dogfoodingとv0.18.0 Candidate最終監査が完了するまで確認済みへ昇格しない。

## 14. Human Decision Journey改善母集団の具体化

2026-08-29、Qual-Labの人間の決定権限者は、§12で具体化したシステムJourney閉包を、人間の判断要求から回答後の工程再開までへ適用してDogfoodingすることを判断した。新しい第四の改善意図、固定Interaction SchemaまたはRoadmap項目は作らず、[`CRDD標準自身の課題探索・要求形成` §7.3.1](../../01_Discovery/01_CRDD_Product_Discovery.md#731-工程接続と意味網羅検証の強化候補)へ次を統合した。

- 既存Rule、AuthorityおよびContextからAIが一意に処理できる事項を除外し、人間の決定権限が必要な地点だけで停止する
- 承認、選択、確認、情報提供、判断またはリスク受容等、今回求める操作の種類を実質と一致させる
- 推奨、理由、判断価値のある同粒度の代替案、影響、保留時の結果および具体的な回答形式を、重要度に応じた深さで示す
- 人間の短い回答を正しい正本Context／Authorityへ反映し、回答済み判断を再要求せず必要な工程を再開する
- 判断に追加質問を必要とした箇所、不要な質問、同じ質問の反復および回答後に再開できなかった箇所をInteraction UXのFinding候補として観測する

既存の[`判断支援契約`](../../11_Skill.md#53-decision-support-contract)は、判断集合、推奨、影響、短所、保留、不採用および段階的表示をすでに所有する。本追記は同契約を複製せず、自己適用で「質問を表示できた」後のContext反映と再開まで成立したかを評価する。現時点で`11_Skill.md`、`10_Agent.md`、`16_Quality_Assurance.md`、各工程、ひな型またはCheckerを変更する判断ではない。Runtime完成固定後に代表的な承認、選択、情報不足、リスク受容、保留および判断不要ケースでDogfoodingし、追加質問、人間操作、誤った再質問および再開失敗を実際に減らせる最小の変更だけを提案する。

外部の対話AgentやMCPが不明瞭なCRDD判断要求を翻訳することを前提にしない。CRDD単体の判断支援と再開Loopを成立させ、将来の協働接続面は追加分析または横断Contextを提供する補助とする。本節も現在状態`Reopened`の範囲に含まれ、工程強化Dogfoodingとv0.18.0 Candidate最終監査が完了するまで確認済みへ昇格しない。

## 15. 固定Runtimeによる工程強化の先行自己適用

2026-08-30、Qual-Labの人間の決定権限者は、工程強化をCoordinator Runtime 1.0の最終正式署名と完成監査より先に自己適用し、変更が収束した最終固定版だけを正式署名E2Eと一括監査へ渡す順序を採用した。これは§9の完成条件を緩和する判断ではなく、内容変更のたびにRelease鍵入力と監査を反復する非効率を避ける実行順序の具体化である。

先行自己適用には、既にIdentityと隔離境界を検証した署名済み固定Runtime配布物を使用する。各Taskは明示したRepository、Revision、読取りPath、変更可能Pathおよび受入条件へ限定し、Canonical Repositoryを直接変更しない。失敗、結果Envelope不一致、同意境界外またはRecovery不明時はEffect 0で停止し、追加の外部送信や人間入力を自動拡張しない。

自己適用の結果、次の三つの閉包を既存正本へ接続した。

| 閉包 | 反映先と責務 |
|---|---|
| 設計閉包 | [`26_Behavior_Specification.md`](../../26_Behavior_Specification.md#phase-process-contract)が正常・準正常・異常・回復の結果母集団と`absent / null / unknown`の意味を所有する。Architecture、Implementation、QAに既に存在する状態、資源、所有、実装symbolおよび検証設計の契約は重複追加せず利用する |
| 検証閉包 | [`29_Verification.md`](../../29_Verification.md#23-検証妥当性確認保証の意図)が、実producerから本番搬送・変換、本番consumer、結果公開およびcleanup／Recovery後観測までを重要システム経路として確認する |
| 判断・文書閉包 | [`11_Skill.md`](../../11_Skill.md#53-decision-support-contract)が人間回答の正本反映と条件不変時の自律再開を所有し、[未リリース変更トレース統合台帳](README.md)が現在のCanonical CHG、旧ID復元、機械検証詳細の順で読む入口を持つ |

Runtime自己適用では、複数文書Taskが`provider_turn_limit_exceeded`で安全停止した後、`26_Behavior_Specification.md`へ限定したTaskがClaude Code Executor、Codex独立Reviewerおよび限定是正1回を経て完了した。`29_Verification.md`へ限定したTaskは2回とも`provider_task_result_envelope_invalid`で安全停止し、逆方向Providerへの切替は同意境界外としてEffect前に拒否された。いずれの失敗でもCanonical Repository変更とRecovery残存は0であり、Runtime Stateの選択User結合、保護、安定Identity、Recovery ID 0および手動回復不要を再観測した。同じ失敗を無制限に再試行せず、取得できた根拠から親Agentが正本を更新した。

Repository自己適用で生成物が通常差分へ混入し得ることも確認したため、Repository rootの`.crdd`をignore-by-defaultとし、Runtime状態、Candidate、log、一時成果物および生成物を追跡しない。内容自体が検証入力になる非秘密のCommit固定Repository設定だけを明示allowlistし、現在は`.crdd/external-send-policy.json`だけを例外とする。この境界は[`CHG-000017`](CHG-000017_Tools_Coding_Standards.md)とTool規約が所有する。

Runtime sourceまたは配布Identityへ影響しない変更では正式署名をやり直さず、全変更収束後にCHG-000015の最終固定版へ正式署名4経路E2E、失敗・取消・Recoveryおよび完成監査を一度実行する。Runtimeへ影響する変更を後から行った場合は、その最終Identityを固定して同じ完了条件を再計算する。

本順序変更は、工程強化の規範採用、CHG-000015の完成、Stable化、main統合、タグ、公開またはReleaseを意味しない。最終判断と監査集合は維持する。

## 16. Coordinator RuntimeとCRDDの有用性評価

2026-08-30、Qual-Labの人間の決定権限者は、Coordinator RuntimeのDogfoodingを安全な複数Provider連携の成立確認だけで完了させず、品質を維持または向上しながら、人間のAttention、採用可能な結果までの時間、単一Providerへの集中および不要なAI間反復を減らせるか実測する方針を採用した。これは新しい変更意図またはRoadmap項目ではなく、§7.3で採用済みの実行観測を価値判断へ接続する具体化である。

CRDD全体に適用できる境界は[`進捗と運用上の有用性評価の分離`](../../15_Progress.md#operational-utility-boundary)へ、Coordinator Dogfoodingの評価軸、Operation Profile、三条件比較、Task難易度、集約条件および将来MCP比較は[`CRDD標準自身の課題探索・要求形成`](../../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-evaluation)へ反映した。

Dogfoodingでは、Task開始から採用可能な結果までの経過時間、人間の実作業時間、AI処理量、Review／Remediation／Retry／Recovery、Provider別利用、後工程Findingおよび一定期間の処理量を別々に観測する。利用枠分散やAgent起動数だけを成功とせず、品質を効率指標で相殺しない。未観測値を0へ補正せず、十分なOperationが集まる前に改善率または総合点を捏造しない。

現時点では固定Telemetry Schema、追加Credential、Provider規約外の利用量取得、全Taskの三重実行または常時記録を追加しない。既存Runtime出力とDogfooding記録から最小Profileを作り、取得不能項目と比較限界を明示する。具体的な計測実装がRuntime source、情報分類、外部送信、保持、費用またはProvider契約へ影響する場合は、CHG-000015および責務を持つ正本へ戻して別途確認する。

## 17. 実務自己適用全件への展開と現在の停止地点

2026-08-30、人間は採用済みの実務自己適用全件の実行を指示し、対象17文書、検証指示、評価候補を既存SubscriptionのOpenAI／Anthropicへ送る3件の実行範囲を承認した。[実行根拠と結果](Evidence/CHG-000055_Dogfooding_8d3d62c.md)では、課題探索・人間判断、設計・検証接続、文書・過去CHG可読性の3件を各1回実行したが、すべてReviewer段階で停止し、採用可能候補0件だった。全件完了や工程強化の有効性証明へ昇格しない。

再承認の負荷については、既存の外部情報境界・判断支援契約を重複強化せず、承認済み作業集合の許可を親から実行環境へ引き継ぐ運用を是正した。3件のRuntime実行中は同意再利用・追加入力0だったが、実行前の人間承認1回を負荷から除外しない。

Discovery正本に残った完成前着手禁止とCHG一律新規発行の記述を、§15および12_Changeの現在の判断へ同期した。上限契約の実装不整合はCHG-000015で是正し、Reviewerの作業量・結果搬送、選定理由の由来、未取得の有用性観測を同じ実行根拠に接続した。新CHGを発行せず、本CHGは`Reopened`を維持する。次は安全な実務評価結果の取得、必要是正、変更後の機械確認、最後の独立監査であり、保留中の将来機能やRelease判断へ進まない。

## 18. 小さい実務単位での成立と残る品質確認

2026-08-30、既存承認範囲のまま評価単位と読取り範囲を絞り、判断支援、設計と実測の照合、旧CHGの読者経路の3件を各1回実行した。すべてCodex作成・Claude独立レビューが完了した。さらに台帳の導入段落を平易にする実編集をClaude作成・Codex独立レビューで実行し、当該段落以外の完全一致を確認して反映した。[全実行根拠・限界・残件](Evidence/CHG-000055_Focused_Dogfooding_588f04f.md)と元候補を保持する。

今回の追加承認要求、Runtime入力および鍵入力は0回だった。Runtime内レビューは全4件で指摘0・是正0だったが、親が設計評価に根拠の範囲を超えた断定を1件検出した。評価と参照元Architectureを訂正し、親による是正後の最終独立監査は未完了として残した。固定Workerの使用、試験名または状態名から観測範囲を推定せず、具体的な入口・改訂版・対象・結果へ接続する既存規則の実行不足として扱い、重複する規範や新CHGは追加しない。

狭い評価3件を以前の広い3件と同一Taskとして比較せず、工程強化全件の完成または改善率を主張しない。課題探索からUX／IA／UIへつなぐ実務、設計・source・試験の横断確認、台帳以外の読者経路、Runtimeの失敗分類と選定理由の由来、取得不能な有用性指標は同Evidenceの担当・次の処置で追跡する。本CHGは`Reopened`のまま、変更収束後の一括監査へ進める。

## 19. 上流実務の起動停止と選定理由の是正

2026-08-30、基準Commit `d6a0d2c8f245b5d5838c4a00e2afba8b703b03e0`で、繰り返し承認の実例をDiscovery／UXの改善案とIA／UIのテキスト表示案へ具体化する2件を準備した。対象は§17の17文書内にある4工程文書と既存README自己適用Evidenceで、固定署名Runtime、既存Subscription、追加鍵入力なしの実行を要求した。しかし実行環境の安全審査が今回の送信内容と既存承認の対応を確認できず、Process起動前に拒否した。両Taskは未実行であり、Provider失敗件数や実務成功率へ含めない。別入口による迂回送信や同じ要求の反復は行っていない。

外部送信なしで進められる既知の是正として、[CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md#15-release処置)で自動選定を人間の指定として表示する原因を修正し、実選定器を接続した試験へ戻した。上流実務2件の担当は親Coordinator、再開条件は実行環境が対象文書・目的・送信先と許可境界の対応を確認できることとする。停止中は改善案の実Runtime作成・独立レビューの根拠が得られない。既存承認が無かったとは判断せず、承認履歴と実行環境の判定を区別する。実行環境へ許可範囲を確実に引き継ぐ改善候補も§17へ接続し、新しい承認制度や自動的な権限拡張は追加しない。

機械確認の再実行1回で、過去EvidenceのリンクとReleased CHG-000007の固定内容照合が失敗した。対象ファイルにGit差分がないことを確認し、履歴を編集せず単独で再実行したところ、過去参照15件のIdentity検証と全体Checkerが再び合格した。原因は未特定であり、対象内容の修正による解消とは扱わない。親Coordinatorが最終固定検査で再観測し、再発時はGit読取り／固定Identity照合の実行条件を切り分ける。履歴の改稿や検査の無効化は行わず、最終監査への未確定事項として保持する。

## 20. 承認後の上流実務2件

2026-08-30、人間が§19の送信範囲を明示承認した後、Repository Commit `746c5d200ee72382a5637f89c83000cfae5f4222`、Tree `c2a6115635bb490d8dcaef1c6a3796bc07766d59`で2件を実行した。署名済みRuntimeは`a619545ff7f30f3ec65efa134994abc0f825421a`、Release Sequence `2026083005`のまま再利用し、配布物の変更・再署名・鍵入力は行っていない。固定Runtimeには前回の選定理由是正が含まれず、この実測を修正版の証明には使わない。

| 実務 | 作成／独立レビュー | 呼出し時間 | 結果・親の処置 |
|---|---|---:|---|
| [課題探索・UXの改善案](Evidence/CHG-000055_Consent_UX_Application_746c5d2.md) | Codex／Claude | 174.674秒 | 承認・指摘0・是正0。親が表示省略と監査要否の混同を補正 |
| [IA・UIのテキスト表示案](Evidence/CHG-000055_Consent_Interaction_Application_746c5d2.md) | Codex／Claude | 176.633秒 | 承認・指摘0・是正0。親が追加入力0回の曖昧な表現を補正 |

両件とも既存同意の再利用、Runtime追加入力0回、cleanup確認済み、手動回復不要、Process再起動不要、RuntimeによるCanonical Repository変更なしだった。公開入口のUTF-8 byte搬送、`shell:false`、固定Node 24.19.0と専用Provider Homeを使用した。実効モデルはCodex `gpt-5.5` medium、Claude Opus medium、通常速度。既存Subscriptionだけを使用し、API key・従量課金fallback・追加購入はない。会話上の再開承認1回を人間負荷から除外しない。

全候補を正規exportし、対象Path・byte長・SHA-256を確認してから正規discardの`discarded`を確認した。[要求・公開結果・選定表示・計時・元候補・破棄結果・親の補正](Evidence/CHG-000055_Upstream_Dogfooding_746c5d2.json)を保持する。元候補と保存版のHashは区別し、親の補正後の最終独立監査は未完了とする。生Provider出力やCredentialは記録していない。候補の秘密検査はheuristicであり、秘密不存在の証明ではない。

今回の具体化は、範囲内では質問せず短く状況を説明することと、範囲変更・許可判定不能では送信停止と再開条件を示すことに分かれた。既存の承認照合・判断支援規則の適用案であり、新しい権限、機能、同意省略または規範採用ではない。親の現行運用では範囲内の不要な再質問を避ける。将来の自動表示実装を採用する場合は、CHG-000015で具体的な出力契約・既存同意照合・停止経路へ接続する。

呼出し時間の合計351.307秒は、親の確認・export・反映・検証まで含む採用可能結果への総時間ではない。人間の実作業秒数、段階別AI時間、実turn数、token／quota、直接実行比較、実利用者の理解度と改善率は未測定である。2件は同じ事例を別の工程観点から評価したもので、1件目の成果を2件目へ搬送した連続工程試験ではない。実画面・Graphic制作、全専門工程の網羅、工程間受渡し、実装された表示の利用者試験も完了扱いしない。

§19の上流2件の起動停止は今回の実行完了で解除した。親の補正後の独立監査、表示を使った実務での誤認・不要確認の再発観測、設計・実装・試験の横断確認、残る読者経路、未測定の有用性指標は本CHGとCHG-000015で引き続き追跡する。本CHGは`Reopened`を維持し、最終固定・一括監査・Releaseを前倒ししない。

## 21. 表示案から実装・検証への接続

§20の設計案を基に、既存の送信許可を使っていることを入力不要で一度表示する処理を[CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md#15-release処置)へ実装した。初回／再利用の区別、不明な許可方式、表示失敗と例外、表示中の取消をTaskの結合試験へ接続した。規範や承認制度を追加せず、既存の許可照合と停止条件を維持する。手作業の再承認を増やさず状況を伝える案と、許可不明でも継続してしまう誤認を防ぐ実装を分けて検証している。

このSource変更は親による実装であり、固定署名Runtimeによる編集実務とは区別する。固定Runtimeを改変せず、開発試験で収束させる。担当は親Coordinator。実際の表示理解度、不要確認の再発、人間の実作業時間、更新版の実Provider実測と独立監査は、実務収束後の最終固定確認まで未確認として保持する。現在、追加の人間判断は必要ない。

変更後のTask／送信許可契約146件と署名不要の開発E2E 223件は合格した。両型検査、変更2sourceのLint／format、設計対応検査も合格した。全体Checkerは365文書・2,213リンク・680アンカー、Error 0／Warning 0で、過去参照15件のIdentityも検証できた。これらを最終独立監査の代替にしない。

Coordinator全試験は今回は失敗4件を残した。試験の`TEMP`／`TMP`をRepository-local `.crdd/dogfooding`へ限定したところ、`generate-release-key.contract.test.ts`の2件と`sign-release-manifest.contract.test.ts`の1件はRepository外出力という前提に一致せず、`repository-root-resolution.contract.test.ts`の1件はGit境界が存在しないという前提に一致しなかった。対象の試験と鍵生成・Root解決実装は今回変更していない。未知の場所への書込み、鍵生成の保護条件緩和、試験のskipで合格にしない。親Coordinatorが次の試験基盤是正として、実Repository内に閉じる試験とRepository外／Git境界不存在を本当に必要とする試験を分け、後者の隔離方法・書込み許可・cleanupを固定して再実行する。再検証まで全体合格は未達とする。

同日の後続是正で、この4件を[CHG-000017](CHG-000017_Tools_Coding_Standards.md#8-release処置)へ接続した。製品の鍵Path・Git境界判定には変更を入れず、実Repository内の隔離配布環境とvolume rootの読み取り観測へ試験を分離した。同じ`TEMP`／`TMP`限定条件でCoordinator全1,218件が合格し、失敗・取消・skipは0件、実行時間は110.674秒だった。最終の変更3ファイルも関連19件・型検査・Lint／formatで確認した。§21の4件の試験前提不一致は解消とし、実務全件、実Provider E2E、独立監査またはReleaseの完了とは区別する。

通常のpackage試験入口でも一時保存Rootを自動強制できるかは別の未確認範囲として残す。担当は親Coordinator、次の再評価契機は試験入口の運用固定時とし、未確認の間はRepository-localな`TEMP`／`TMP`を指定して実行する。公式秘密鍵、親Directoryまたは兄弟Repositoryへ試験用ファイルを置く回避は行わない。

### 実務再開前のClaude作業量上限の是正

2026-08-30、ユーザー判断により実務の継続前に[CHG-000015](CHG-000015_Coordinator_Runtime_1_0.md#15-release処置)でRuntimeを改善した。対象はClaude Reviewerのturn上限であり、Windows Job Objectではない。推論強度から独立した有限の作業量見積りを、Task Packet、実行計画、固定Docker argv、結果検証へ接続した。読取り6範囲・変更1範囲・受入条件4件・是正指摘0件のReviewerは、推論強度にかかわらず最大10 turnsとなる。見積りが16を超える場合は分割要求として停止し、無制限実行や自動高推論化で回避しない。

実Providerを使わない契約・結合試験では、件数導出、是正指摘の反映、実argv、上限ちょうど／超過、無効入力、同じ上限になる作業量の差替え拒否、Mount返却、Authority非発行、公開停止理由および再試行なしを確認する。実務の成功率向上は未実測であり、旧署名Runtimeでの成功を更新Sourceの証明へ流用しない。親Coordinatorが次の更新Runtimeによる実務で、上限停止、受理可能な結果までの時間、利用量を比較する。見積り係数の評価と実行前表示の改善余地も同じ再評価へ含め、改善効果が出るまで無条件に完了としない。

変更後のCoordinator全試験は1,223件合格、失敗・取消・skipは0件、109.626秒だった。試験一時領域はRepository-local `.crdd/dogfooding`へ限定した。両型検査、変更14個のTypeScriptファイルのLint／format、設計対応検査も合格した。全Repository Checkerは365文書・2,218リンク・685アンカー、Error 0／Warning 0を確認した。これらは開発時の決定論的な確認結果であり、最終固定署名E2E、実務の上限停止解消または独立監査Passではない。公式鍵入力、署名配布物の更新および実Provider送信は行っていない。

### Provider比較を含む少数回の実測計画

同日、ユーザーは調査用の少数回のSubscription利用を許可し、CodexとClaude Codeの比較も含めるよう指示した。既存の[有用性評価](../../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-evaluation)へ、同一Taskの実行者と独立確認者を入れ替えた2経路比較を追加した。初回は各1 Task、通常4回、既存是正・再レビュー込み最大8回のProvider呼出しを計画上の上限とし、追加再試行しない。Task、Revision、投影、受入条件を揃え、モデル・推論・上限・実行順序を記録し、経路全体の有用性とモデル単体性能を区別する。1組の結果から成功率や優劣を一般化しない。

確認時点の更新Sourceは`999f66c`だが、実Provider用の配布物は改善前の`a619545`だけである。既存の開発E2E入口は実Providerを使わない。したがって、この比較は未実行であり、今回の記録ではProvider呼出しとクレジット消費は0回。親Coordinatorが更新版の実測入口の不足をCHG-000015の継続課題として扱い、既存の署名・Authority条件を維持して開始条件を整理する。開発用の実Provider入口が必要なら、そのTrust、回数制限、停止・cleanupおよび正式Releaseとの分離を別途設計し、単に検証を迂回する入口は作らない。比較計画はその保護境界変更の承認を兼ねない。既存Roadmapの有用性評価参照から追跡し、新CHG・新Roadmap項目は追加しない。最後の独立レビューでは比較条件、品質評価、標本限界と実測根拠を確認する。

### 実測結果から次版へ残す検討材料

2026-08-31、人間は作業を続けながら中間有用性評価を次版への布石として残すよう依頼した。既存の[根拠駆動リファクタリング候補](../../01_Discovery/01_CRDD_Product_Discovery.md#runtime-utility-next-version-candidates)へ、照合の呼出し元別計測、検証の共有単位、意味のあるTask分解と横断品質、人間負荷を含む比較評価を接続した。Roadmapは既存項目から候補の存在・状態・再評価契機を示すだけとし、新しいMD・CHG・固定Schemaは作らない。候補保持の記録を本CHGが、実装と実測根拠をCHG-000015が所有する。

比較はその後CHG-000015の固定開発版で実行済みとなったが、全体的な性能改善・有用性は未確定である。[最新実測](Evidence/CHG-000015_Development_Provider_Comparison_799e368.json)では両経路のレビュー承認・回収が成立した一方、所要時間は前回より増えた。レビュー1回・追加是正0回を「レビューなし」、Reviewer承認を人間受入、局所成功を全体品質へ読み替えない。次版候補は`Held / Unscheduled`、版番号・収載・具体設計は未決とし、現行v0.18の必須残件を延期しない。現在の安全判断に影響する新根拠は現行是正へ戻す。

これは既存の長期改善意図への根拠・候補追加であり、新しい規範、実装許可、移行、Release判断ではない。親がDiscovery／Roadmap／CHGの責務と既存の有用性評価へ着手前照合した。記録・参照の全体Checkerを実施し、意味と範囲の独立Document／Gap確認は既定の最終一括監査へ接続する。

## 22. 実務残件の横断確認と最終試験への接続

2026-08-31、人間が実務残件、必要是正、最終試験の一括実行を承認した。基準はCommit `f8e024f1b0245456c3f5665374cbde86bcc29ea6`、Tree `fc6321251df1b4920870af1c0c36d86c1d609f15`。変更分類は既存意図の実務検証と案内明確化であり、新規規範、決定権限、将来機能、Releaseの採用ではない。親の照合と二つの読み取り専用確認で工程受渡し・読者経路・設計実装試験の計画を確認した。正式監査ではなく、完成後の一括監査は維持する。

### 工程受渡しの現在状態

[既存UX成果](Evidence/CHG-000055_Consent_UX_Application_746c5d2.md)を実入力として、IA／UIの表示案へ保持条件を渡す1 Taskを準備した。対象は同成果、`23_IA.md`、`25_UI.md`と一つの生成候補だけ。初回判断、範囲内再利用、情報不足、範囲拡大、リスク受容、独立保留の6場面を、表示、継続／停止、反証ケースへ結ぶ。公式Subscription、既存署名Runtime `a619545`、最大4 CLI呼出し、Task再試行なし、正規export／discardという範囲である。

外側の実行環境が今回の具体的Payloadと送信先への承認を確認できず、起動前に拒否した。Runtime／Providerは起動せず、送信・クレジット消費は0。今回の承認履歴を否定する判断ではなく、実行環境との境界照合が成立しなかった事実である。別入口や権限設定で迂回していない。親が書いた机上評価をRuntimeの成果受渡し実績へ代用せず、本項は未完了とする。再開担当は親Coordinator、条件は3入力と生成候補のOpenAI／Anthropic送信に対する実行環境の許可。承認後も現在Revisionで要求を再固定し、古い比較sessionの許可枠は再利用しない。

### 設計・実装・試験の照合

Traceの9資源・20状態・21遷移・10不変条件、および10検証bindingの70caseを対象に、設計文書と試験sourceへの参照存在を全数照合した。欠落0。ただし7bindingは契約投影、3bindingは実Filesystem／Processであり、全70caseのassertion意味網羅、現在OS／Docker／Providerの実状態をこの照合で証明しない。

重点確認では、native観測の新規検証と私有結合、同意表示の正常・不明・失敗・取消、Provider終了からHost回収・receipt・finalize・公開までの順序をproduction symbolと対応試験へ照合した。具体的欠陥は見つからず、状態・資源・Frameworkを追加する是正は行わない。CLI signalはTask Trace外の別契約であり、その解除までTask fixtureから推定しない。詳細な実装正本は[Runtime Architecture](../../tools/coordinator/architecture/README.md)を維持する。

### 読者経路の棚卸し

| 読者 | 確認した入口と到達先 | 処置・限界 |
|---|---|---|
| CRDD標準の採用者 | root READMEの「できることと開始場所」→工程正本・クイックスタート | 既存案内を維持。Runtime必須化なし |
| Runtime利用者 | Runtime README→現在Capability・コマンド・Repository設定・回復境界 | 入口へ目的別リンクと発行担当者／一般利用者の区別を追加。内部候補の通読を開始条件にしない |
| Runtime開発者 | Runtime README→Architecture／脅威モデル／開発者確認 | 既存詳細を削除・再定義せず参照 |
| 現在の変更を知る読者 | 変更台帳→7 Canonical CHGとそれぞれの現状・Release処置 | 履歴台帳を現在状態の第二正本にしない。個々の本文全体の理解度は未測定 |
| 過去判断を復元する読者 | 旧ID台帳→固定Commit原文・不変Evidence | 固定履歴を改稿しない。機械確認の15件の履歴同一性を再確認し、人間の理解時間とは分ける |

CLIテキスト案ではGraphic制作・実画面の視覚品質は今回非該当。初見理解時間、人間の実作業秒数、誤認減少率は未測定であり、非該当や0へ補正しない。読み取り案内の追加だけで文書全体の可読性改善完了とはしない。残る実務受渡し、最終固定E2Eおよび独立監査は同じCHGへ保持する。

### 機械確認と検出した是正

一時成果物はRepository-local `.crdd/dogfooding`へ限定した。生成物のBiome探索除外と非Git fixtureの探索境界に不整合を検出し、[CHG-000017](CHG-000017_Tools_Coding_Standards.md#8-release処置)で是正した。製品の公開判定とRuntime実行Sourceは変更していない。

| 確認 | 結果と適用範囲 |
|---|---|
| Runtime全試験 | 1,395 / 1,395、失敗・取消・skip 0。基準`f8e024f`の実装を検査、123,384.5894 ms |
| 開発E2E | 8試験ファイル、233 / 233、失敗・取消・skip 0、31,123.2221 ms。Provider Adapter、Task、一般Task・4経路・Recovery Runnerの契約試験であり、実Provider／正式署名の再実測ではない |
| Checker全試験 | 是正後に正規test runnerで174 / 174、失敗・取消・skip 0、222,950.4798 ms。初回の41件失敗を隠さず、試験前提の是正後に全件再実行 |
| 型検査 | Coordinator production／tests、Checkerの3 projectで合格 |
| Lint／Format | 正規Biome Lint 311ファイル、Format 310ファイルで合格。所有Sourceの検査を維持 |
| 設計対応Checker | 9資源・20状態・21遷移・10不変条件・10検証bindingを受理 |

Runtime全試験logのSHA-256は`87a567176253943ae834cdd91dccb6ddb334f1303ef039a52bc860daa1bea6a0`、開発E2E logは`f69850dbf714c8c75b646499b051233bc8576294a85450b87208e4aded711730`。logは`.crdd`の一時記録であり、恒久的なEvidence参照とはしない。試験結果の範囲・件数・実行入口を本項に保持し、再実行できるSourceへ接続する。Repository全体Checkerは365 Markdown、2,258 links、705 anchors、固定履歴15件でError 0／Warning 0、差分検査も合格した。この確認時点では実務受渡しは外部実行許可待ちだった。以下に再開後の結果を示す。最終固定版の正式署名4経路／Recovery E2Eと一括監査は未完了である。

### 承認後の実務受渡し結果

同日、人間が3文書と生成候補のOpenAI／Anthropic送信、既存Subscription限定・最大4 CLI・Task再試行なしを明示承認した。対象をCommit `b516f36e32bead1ef56755a2c1ceb016a78f028e`、Tree `740da799539a54955c0faac86443207e06aff6b7`へ再固定し、実行前後のHEAD／Tree一致とclean状態を確認した。前記3入力の内容は前回準備から変更していない。外側の実行環境の許可を得て既存署名配布物`a619545ff7f30f3ec65efa134994abc0f825421a`の通常Task入口を実行し、許可・署名検証は迂回していない。

| 観測 | 結果 |
|---|---|
| 実行区間 | UTC `2026-08-30T18:01:12.112Z`～`2026-08-30T18:04:45.505Z`、Task開始から完了結果まで213,402.2899 ms。後続export／discardと人間受入時間は含まない |
| 実行者／独立確認者 | Codex `gpt-5.5`・推論中／Claude `opus`・推論中、通常速度。固定Linux環境のcode-mode非対応を理由とする既存の5.5選定であり、新たなモデル変更ではない |
| 呼出しとレビュー | 実行1・独立レビュー1、指摘0、是正0、Task再試行0。`coordinator_task_candidate_approved`、Exit 0 |
| 同意と人間負荷 | Runtimeは`reused_initial_consent`、起動後の手入力0。起動前に親が追加承認を1回求めた負荷は残る。Human Active Timeは未測定であり0ではない |
| 出力 | [IA／UIへの受渡し候補](Evidence/CHG-000055_Handoff_Application_b516f36.md)、35行、4,641 bytes、SHA-256 `9bc56ff50884d7a129a59b97d53965c399752828940784941cef3c90d29f959f` |
| 回収 | `cleanupConfirmed=true`、`manualRecoveryRequired=false`、`processRestartRequired=false`。正規exportのbaseCommit／Path／byte数／Hashを照合後、正規discardが`discarded`。Runtimeによるcanonical Repository変更なし |

要求JSONのSHA-256は`e15a1e0a2b68453307fcd2da5c361b81c2451bb51c957fb330a969cdbc1ffd9d`。入力Hashは`23_IA.md`が`3db1f05280d461249fbc99b42fff69e923f6a34cb5a02a5fb4b9ecbee981549d`、`25_UI.md`が`5979f206968e8814804b791de9d16cacac362bc2f7bd94f497eb71e142a2f333`、上流UX成果が`4143cf1f1437b578952550e665ecb02ec49c2f8dba816160c2baf3df6de360e6`。実行は固定配布物の`tools/coordinator/bin/coordinator.ts task --request-stdin --json`と同入口の`candidate export`／`candidate discard`をNode 24.19.0、Windowsから行った。Task結果Hashは`66e5421fd70acc4402fc92b1ffab10ef12ecda827e9d3cbe7635f6b1989b6c63`。要求・結果・選定・計時・export・discardはRepository-local `.crdd/dogfooding/handoff-b516f36.*`の一時記録に保持し、恒久的な参照にはしない。出力本文は親が編集せず同じbyte列でEvidenceへ保存した。

本件で成立したのは、既存UX成果を実入力にした下流のテキスト表示案生成と独立レビュー、回収の1例である。出力中の「Runtime実測」は下流で行う検証案であり、6場面の実操作を今回すべて実測した意味ではない。「独立保留」の行に含まれるGraphicは本件非該当、理解時間は未測定、その他の未確認条件とは別に扱う。親の照合はこの限界を維持し、独立レビュー承認を人間受入、正式規範採用、全体品質または有用性改善へ読み替えない。最終一括監査へは出力本文とこの解釈境界を共に渡す。

## 23. 検証選択と完成への収束方針の還元

2026-08-31、人間はRuntime開発の反復から得た検証選択・収束方針と四つの補強を採用した。基準は`0ef1c47`。v0.18では、現在残る不確実性から次に有効な確認を選び、完成条件を無断変更せず収束させる原則を既存正本へ反映する。v0.19の限定分散・再計画・統合検証は研究候補として保持するだけであり、収載・実装許可としない。

同じ未リリースの工程強化意図への還元として本CHGを継続する。変更分類は既存契約の明確化・補強。新しい状態機械、固定回数、監査免除、安定ID、Runtime実装、課金経路、決定権限または移行機構は追加しない。現在の完成条件を満たすための是正、影響不明、独立保留可能な追加能力を分け、過去の監査・実測を新しい規則の合格根拠へ流用しない。

### 着手前照合と利用側

親と読み取り専用の確認者が、規則所有、直接複製、専門工程、AI入口、準拠監査、次版候補とロードマップを照合した。確認者が指摘したPL-19・AI入口の無限定な収束条件と、親の水平検索で見つけた自己確認・検証設計・READMEの同文も、初回編集計画へ統合した。着手前確認であり、独立レビューのPassではない。

| 編集のまとまり | 所有先・利用側 | 処置 |
|---|---|---|
| 次の検証方法を選ぶ | 品質保証§5.1 | 観測能力・安全性・決定権限・独立性を満たす方法内で追加根拠の価値と費用を比較。早期前提確認、実行根拠、反復時の設計再確認、実質的な最終監査を接続 |
| 現在の完成と保留を分ける | Agent§7.2、保守§3.1 | 原因・影響先の是正、未知の影響の確認、根拠付き保留、非収束時の親の再評価を規定。保守は参照に留める |
| 無制限探索と未確認の放置を両方防ぐ | Skill§2.3／§4.8、品質保証§5.2、PL-19、両AGENTS、README | 現在の判断・受入条件・検証義務へ収束を結合。必須条件未達・影響不明を将来へ退避しない同じ意味へ追従 |
| 次版の能力候補を保持 | 既存Discoveryの次版候補、既存Roadmap | 2～4作業程度の限定実証候補と、個別Passではなく統合後に採用可能な結果を評価する境界を追加。状態はHeld／Unscheduled |

21～28の専門工程の収束条件、29の反証・根拠戦略、51／53の監査・伝播契約は既存正本への参照で追従し、本文を複製しない。CHG-000014のv0.18収載境界とRuntimeの完了条件は変更しない。CHANGELOGと公開・最終採用判断は従来のRelease最終化へ残す。規則が適用された後の挙動・収束改善は未実測であり、編集済みだけで効率向上を主張しない。

### 分岐と反証の照合

初回編集前に次の期待処置を既存正本へ照合し、編集後に対象本文と再照合した。9例とも期待処置と矛盾しないことを親が確認した。これは規則の机上確認であり、独立レビュー、Runtimeや分散実行の自動試験ではない。

| 代表例 | 維持する期待処置 |
|---|---|
| 局所原因を単体試験で十分観測できる | 原因層の回帰と必要な利用側確認。全体監査を機械的に追加しない |
| モックは成功したが実環境の残存資源が未観測 | 必要な実境界の確認を残す。モック合格で回収成立にしない |
| 現在の安全性や完成への影響が不明 | 不足根拠を確認し、影響する操作は停止。将来候補への退避不可 |
| 既存受入条件を満たし、独立保留できる追加高速化 | 根拠・担当・再評価契機・保留影響を追跡。現版の必須作業へ自動追加しない |
| 同じ設計境界で失敗が反復 | 原因・利用側を再確認し設計へ戻る。局所修正を無制限に継ぎ足さない |
| 必須監査集合の一部だけ終了 | 集合縮小、途中の対象修正、完了判定不可。重大リスク時の停止・移送は既存契約どおり |
| E2E成功後、独立監査で安全欠陥が判明 | 文書合わせで済ませず是正へ戻る。E2E成功を根拠に指摘を閉じない |
| 並列作業は全てPassだが統合条件が未確認 | 統合受入とはしない。統合改訂版の整合・受入条件・影響した個別根拠を確認 |
| 低重要度と呼ばれた指摘が必須条件の未達を示す | 将来へ送らず現在の必要是正として扱う |

機械確認は全体Checker、リンク／anchor、差分、旧収束文の残存を対象とする。自然言語の意味を文字列一致テストだけで合格にする新Checkerは作らない。Runtimeのsource・実行設定は変更しないため、本変更だけを理由とする実Provider再実行・署名・課金は行わない。必要な独立レビュー、Document／Gap／Conformanceの確認は、ユーザー指定の開発E2E・実務収束後の最終固定版の一括監査へ追加する。監査集合を開始しておらず、未評価のまま通常完了・工程移行・Releaseへ昇格しない。移行機構は不要だが、採用側は基準版採用評価で検証計画と保留判断への影響を確認する。

## 24. 実務結果の照合と最終固定への引渡し

2026-08-31、人間は実務収束、最終試験、一括監査、Release準備の一括実行を承認した。基準は`f84ea34`。現在の採用済み意図に対する検証と案内是正であり、新機能、権限拡大、main統合またはReleaseの許可ではない。親と二つの読み取り専用確認で、現在の成果・設計・実装・試験を照合した。これは着手前確認であり、最終監査ではない。

### 工程受渡しと読者経路

§22の上流UXからIA／UIへの実受渡しを再生成せず、保存済み成果の6場面を次へ接続した。今回の確認は現行sourceと既存試験の意味照合であり、6場面すべてを実Providerで実測した主張ではない。

| 場面 | 現在の照合先と保持条件 |
|---|---|
| 初回判断 | `coordinator-task-runtime.contract.test.ts`の初期確認表示と`external-send-consent-runtime.contract.test.ts`の保存契約。許可前にTaskへ進まず、表示を許可発行へ読み替えない |
| 範囲内再利用 | 同Task試験の再利用表示と§22の実務結果。再利用で追加承認入力を要求しない |
| 情報不足 | 同Task試験の未知の許可方式、表示失敗、拒否、表示中取消。Workspace・Provider起動前の停止を確認 |
| 範囲拡大 | 同意契約のA→B→A、期限、User／Identity変更。古い許可を復活させず、必要な人間回答後に現行境界を再照合 |
| リスク受容 | `11_Skill.md`の判断支援と成果本文。人間の受容を実行Authorityと同一視しない。専用APIを新設しない |
| 独立保留 | `10_Agent.md`の収束判断と成果本文。現在の影響が不明な事項を安全な将来候補へ退避しない |

標準採用者、Runtime利用者、Runtime開発者、現在の変更を知る読者、過去判断を復元する読者の五経路を§22の棚卸しへ再照合した。今回、新たな全文再構成の必要性は確認されず、最終固定版の現在状態同期とDocument／Gap確認へ渡す。初見理解時間、人間の実作業秒数、quota、直接実行との統計比較は未測定であり0または改善済みとしない。担当は親Coordinator、再評価契機はRuntime完成・実務収束後の有用性評価、保留影響は人間負荷削減や速度優位を主張できないこと。既存Discoveryの有用性評価で追跡し、安全性や操作成立の未確認をこの保留へ混入させない。

### 抽出済み責務と必要な是正

採用済み根拠駆動リファクタリングは、Task要求parser共通化、限定実測の制約／session／受動計測分離、既存状態機械と回復台帳の共有、同一借用内native重複検証削減に具体化済みである。設計正本と実装・試験・比較EvidenceはCHG-000015の各結果へ接続する。全面的なLifecycle／Ledger分割、汎用Platform／Provider／MCP／Routerは引き続き未採用候補であり、今回の必須作業へ追加しない。性能改善は実証されておらず、この照合だけで作業全体を完了へ昇格しない。

最終入口照合で、Runtime READMEに「Matrix開始時に同意を取り消す」という廃止済み説明を検出した。現行Runnerと再利用契約試験に合わせ、初回は初期同意または再利用、後続は再利用とする説明へ是正した。source・許可・試験の合否規則は変更していない。既存の伝播確認の実行不足であり、新しいCRDD規則は追加せず最終Document／Gap確認へ渡す。

### 最終試験・監査・公開準備の境界

旧署名版`a619545`から現行RuntimeのTypeScriptには変更があるため、旧4経路結果を最新完成根拠に流用しない。native source・build・観測器・署名script・固定Runtime assetsの差分はないが、2つのnative binaryは現在の観測器で再検証してから新しい候補へ配置する。旧manifestはコピーせず、全機械試験・開発E2E後の最終Commit／Treeへ新しいmanifestを発行する。

Issue #30は2026-08-31の読取りでOpen、コメント0、当該branchのPRなし。Issueが追跡する詳細な市場・倫理・商業性・調査手法・採用後価値モデルは、CHG-000013で意図的に未採用候補として残されている。現在の最低境界の実装だけでは全件対応済みでなく、自動closeしない。既存IssueとRoadmapで追跡を維持する。

現在は最終署名E2Eと一括監査の前であり、CHG-000015／000017／本CHGの現在判定、CHANGELOG最終化、完了Roadmap除去、PR／統合判断は未完了である。必要な監査集合はArchitecture／Security、Test／UX、Document、Gap／Impact／Conformanceとし、同一固定版と共通の全体機械確認を渡す。全結果が揃う前に対象を編集せず、指摘があれば既存の統合・再照合契約へ戻す。

固定前の機械確認では、Node.js 24.19.0、Repository-local `.crdd/dogfooding`を`TEMP`／`TMP`とした条件で、Coordinator全試験が終了コード0、開発E2Eが233件合格（37,429.0704 ms）、Checker試験が174件合格（261,068.1053 ms）だった。後二者は失敗・取消・skip 0。両packageの型・Lint・format、設計対応検査も合格した。Rust 1.94.1のfrozen全feature試験は31件合格、CurrentUser Registryを変更する明示実測1件は既定どおりignoredであり合格に数えない。Rust formatとClippyのWarning拒否も合格。native実動作の残る保証は正式E2Eと既存実測の適用照合へ残す。全体Checkerは366文書・2,279リンク・725アンカー・固定履歴15件でエラー／警告0を確認した。これらは正式E2E・独立監査の代替ではない。

## 25. 人間可読性の本文再是正

### 今回分かったこと

2026-08-31、人間から「入口の改善だけでは本文がまだ読みにくい」と再指摘を受けた。§24の「新たな全文再構成の必要性は確認されなかった」という判断は、本文に累積した条件・例外・履歴を十分に評価できていなかった。過去の確認結果を消さず、今回の再評価で訂正する。

既存の文書化規則には条件・義務・例外の分離があった。主因は規則の欠如だけでなく、確認が入口と参照経路に偏り、本文の意味構造まで使い切れていなかったことである。

### 対応と変更しない範囲

- 要約追加に留めず、長段落の適用条件、処置、例外、終了条件を分離する。
- 条件比較、状態の対応、担当の分担は表へ、順序が重要な処理は手順へ変える。
- 準拠監査の長い基準行は、同じ文書内の基準本文・決定権限・必要な根拠へ展開する。短い基準は表に残す。
- CHG-000015は現在の実測結果を先頭に置き、冒頭に累積した過去経緯を本文・順序を保存して後ろへ移す。
- 用語の識別子、状態値、基準ID、条件の論理、規範の強さ、決定権限、公開済みの判断は変更しない。
- 公開済みCHG-000001～000011と固定Evidenceは改稿しない。統合台帳から内容別に辿る案内を整える。

本件は既存の未リリース文書改善意図の是正であり、新しいCHGや可読性専用の文書を増やさない。文書化§4.8.1には本文自体の確認と意味保存を補足し、文書監査の既存観点へ接続する。文字数や表の数だけで合格を判定するCheckerは追加しない。

### 確認した範囲と処置

| 対象群 | 今回の処置 |
|---|---|
| 原則・用語・文書化 | 書込み範囲、用語登録条件、本文構造の確認を整理 |
| 自律Operation・Agent | 人間へ戻す判断、非同期処理の適用範囲、層間搬送、書込み境界を分離 |
| 品質保証・保守 | 追加探索の条件、是正対象の全数対応、リリース前後の手順を分離 |
| Discovery・プロジェクトDiscovery | 未評価項目の整理責任と契機、採用済み意図と未採用候補の状態表示を整理 |
| UI・UI／仕様対応・振る舞い仕様 | 参照実装の目的と責務、三つの品質確認、正常・準正常・異常・回復を整理 |
| Architecture・Implementation | 設計と実装の対応、結果の搬送、耐久状態が権限になる条件、試験根拠を分離 |
| Document・Conformance・Gap監査 | 本文の確認、Release判定、品質保証の観点、長い準拠基準、探索・外部境界を整理 |
| Skill・UX・IA・Verification | 既存の責務別見出し・比較表を確認。長さだけを理由に一律再構成しない |
| 現行CHG・統合台帳 | Runtimeの最新停止と旧成功を分離。本CHGに再評価を記録し、現行変更と過去CHGへの日本語案内を整理 |
| 公開済みCHG・固定Evidence | 元本文を保護し、別の案内から参照。履歴を書き換えて読みやすくしたとは主張しない |

これは本文の水平確認と自己是正であり、初見の読者による理解時間測定や全段落の独立監査ではない。残る長い箇所、用語の密度、表の使い過ぎも、最新固定版のDocument／Gap／Conformance確認で評価する。

### 完了条件と検証の接続

今回の自己確認は、変更前後の条件・例外・参照・基準ID、展開した基準本文の保持、移した履歴本文の一致、公開済み履歴の非変更、全体Checkerを対象とする。新しい版の基準を公開済みへ昇格しない。

並行して、CHG-000015の最新署名E2E停止に対する固定理由の分類を追加した。分類修正の59契約試験、型検査、Lintは合格したが、停止原因の解消または最新4経路完了とは扱わない。詳細は同CHGの現在状態と[実測記録](Evidence/CHG-000015_Signed_E2E_89545e3.md)を参照する。

自己確認では、表から展開した12基準について準拠表明・決定権限・必要な根拠の本文一致、移したCHG-000015の履歴本文の一致と重複なし、公開済みCHG11件の差分なしを確認した。全体Checkerは367文書、2,334リンク、766アンカー、固定履歴15件でエラー／警告0。関連する開発E2Eは233件合格、失敗・取消・skip 0（28,915.6141 ms）。これらは本文の理解しやすさを自動で証明するものではない。

Coordinator全機械試験も1,397件合格、失敗・取消・skip 0（125,176.6475 ms）となった。ただし実Providerの逆方向停止は未解消であり、固定した開発版で追加した理由分類を観測してから原因を判断する。

必要な最終独立監査は§24の集合を維持し、E2E収束後に実施する。今回の着手前確認を監査Passへ流用しない。現在の編集・機械確認に追加の人間判断は不要であり、完成判定、統合、Releaseの判断は別に残る。
