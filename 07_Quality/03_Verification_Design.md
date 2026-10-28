# CRDD検証設計

## Core独立・共通保存の検証計画 — 2026-10-27

### Provider単段Executor分離の非AI確認 — 2026-10-28

[Executor詳細](../06_Architecture/Details/executor/01_Architecture.md)を既存ERB-IT-002／004へ接続する。準備二Mapと観測二Mapは新Owner内へ移し、元通知の同期登録・失効、元result借用と候補／本番交差拒否を確認する。独立子ProcessのCoordinator解決拒否と不正開始のEffect零、Coordinator既存の編集→レビュー→是正→再レビュー・取消・Owner喪失を別々のOracleで確認する。Domainのcodec・Writer・CAS・schema・hash領域は変更しない。実Docker・外部AI・過去保持物は対象外。非AI結果をL3／L5又は全体QAのPassへ昇格しない。

分解済みTask Graph受付は[QA-000003の追加反例](Definitions/QA-000003/quality_definition.md)を、まず合成Plan＋Fake Executorの非AI結合へ接続する。Task別指示・条件の混線、1対1欠測、Path越境、同ID内容差、Owner喪失、部分実行後停止、旧新入力・Transport上限を確認する。本文は保存せず、Hash保持を再開能力の証明としない。Source接続と取得済みの非AI結果は[移管記録](../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)へ接続し、正式項目全体の成立とは区別する。

対象は実行依頼の共通モデル・保存と任意実行の分離である。文書計画→Taskの自動変換や実行状態→文書進捗の自動同期は実装対象・完成条件へ追加しない。既存Objective／Milestoneの用途・Callerの分解済みTask搬送・明示された文書処理範囲はQA-000003の追加条件へ接続し、Source接続と実行結果を照合して評価する。局所成功又は過去のPassだけで未実施の追加条件を成立へ変更しない。

[Runtime Domainの引渡し](../06_Architecture/Details/domain-model/05_Runtime_Domain.md#runtime-domain-quality)を、QA-000003とQA-000008の既存項目に下位シナリオとして具体化した。新Schema・共通保存・一般CRUD・Core独立の各Source接続に伴う限定結果は[移管計画](../99_Roadmap/Changes/CHG-000082/runtime-responsibility-realignment-plan.md)へ記録する。前段のcodec・旧Writerの部分成立や現在の局所結果を、これら上位項目又は実データ移行の正式Passへ流用しない。既存項目数・過去Passを変更しない。

順序はL1のDomain／実保存、L2のCoordinator読込み不能なMCP／Workbench、L4のFake Executorによる調停を先行させる。実AI／実Dockerを使うL3／L5は別の実行許可とし、L1／L2の成立を待たせない。Core CRUDからAI・Docker・Git・認証が呼ばれない負対照、Automation保全、二重CAS、現在認可、五Contextの偽造・再使用、実保存の中断窓をそれぞれ観測する。

基準版の局所Evidenceは能力対応の比較材料であって、新Packageの実装・結合・安全保証を代替しない。新しい報告Lifecycleは追加せず、元受入前提、根拠IDとEvidence本文検証の違い、技術完了の偽造拒否を維持する。保存先を試験Fixtureで有効化済みとしない。

状態: v0.21.0 Canonical
担当責任者: Qual-Lab
最終更新日: 2026-09-19

## 1. 本書の責務

### Workspace方式の段階別検証計画（2026-10-17）

Direct／Candidate共通隔離と開発情報の許容は[QA-000006の新条件](Definitions/QA-000006/quality_definition.md#workspace方式の追加検証条件2026-10-17)で評価する。dummy開発用`.env`の読取りを新たなFailにせず、必要な書込み・認証境界と用途別RWを実測する。本番Secretの通常開発環境への非配置・開発資格の権限／期限は既存管理の構成・運用レビューで確認し、模擬資格やContainer成功を実Cloud権限の証明へ変換しない。新方針の実装・実境界はNot Run。

Merge後分析・資料保存は、`PRL-IT-013`と`RDL-IT-001`／003の実保存・再入場から、`PRL-ST-001`の通常Task公開経路へ接続する。正常・失敗・取消・保存不明・対象更新を反証し、先行Mergeの結果／Refと対象Commitを保持する。分析段階の自動Rollback／追加修正／Merge再発行0をOracleとし、古い／未保存資料から現在の分析完了を推定しない。

新方式は設計伝播段階で全件Not Run。定義と導出は[ARCH追加分析](Analysis/ARCH/quality_analysis.md#workspace方式からの追加導出2026-10-17)、統合は[Quality Integration](04_Quality_Integration.md#workspace方式の追加統合2026-10-17)を参照する。基準DI完成と旧Candidate試験を新版へ流用しない。

| 段階 | 対象・実観測 | 先へ進む条件 |
|---|---|---|
| 静的・契約 | ARCH／QAの導出・Owner・全Consumer・新旧Oracle・Schema／用語・探索除外 | 未決の書込み許可・Git共有境界・dirty・Commit時点を閉じる。新Source／通信の実装前に固定 |
| UT | 対象結合、方式・状態・認可・保持、入力・競合分類 | 値の判定だけを実Git／実Mount成功へ変換しない |
| IT | RFD-IT-029の実Git lifecycle、実保存／複数Process、現在認可、実Mount・Process取消と成果保全 | 主要経路と同じ単位の失敗・cleanup・再入場、実ID／元Revision・終了後条件が揃う |
| ST | 通常AIのOrchestrator経路、Workbench／MCP／CLI、実取消・親喪失・結果と採用待ち、Repository間非開示 | 必要なITを先に通す。未接続の専用助言／候補経路を残して共通化完成としない |
| UAT | Direct／Isolated・内容領域・対象Commit、Merge／分析／Promotion／破棄の意味と人間判断 | 利用者が対象・未完了・残存・採用影響を説明できること。未実施を自動Passにしない |

実Gitは合成Repositoryで作成・登録・Ref・取込・除去・中断を観測する。実Docker／外部AI・破壊操作は対象・影響・上限・清掃を明示した許可後に実行し、今回の設計更新では行わない。PT／LTは現在固定された性能閾値がないため今回追加実行しないが、並行性の機能保証はIT／STで必須とする。Multi-host保証は今回の対象外。実行結果の記録は既存Owner成果物に要点・適用範囲を残し、実行ごとの巨大Evidence書庫を作らない。

本書は、Quality工程全体で検証対象をどの段階へ割り当て、どの条件で実行・記録・評価するかを示す横断計画である。個別の検証条件や試験項目は[Quality Definition](Definitions/)が、上流からの導出は[Quality Integration](04_Quality_Integration.md)が、現行Source・Test・Evidenceとの対応は[現行実装との照合](05_Current_Implementation_Reality_Audit.md)が所有する。

```text
6工程のQuality Analysis
          ↓
Quality Integration
          ↓
13 Quality Definitions
          ↓
本書で段階・実行・記録方針を統合
          ↓
現行実装との照合
```

| 本書が所有する | 本書が所有しない |
|---|---|
| 検証対象の全体範囲、段階選択の原則、実行・停止・記録・評価の共通方針 | 個別RuntimeやToolの検証ケース、具体Source／Test Path、過去の実行結果、現行実装への適合判断 |
| Quality成果物間の入口と終点 | `QA-*`固有の成功・失敗条件やLocal Item |

## 2. 基本図の処置

| 基本図 | 処置 | 一意な参照 | 理由／残る範囲 |
|---|---|---|---|
| 検証義務から試験段階への接続 | 作成 | [段階選択](#4-試験段階と外部境界の到達範囲) | 個別適用は各Quality Definitionが所有する |
| 検証結果から品質判断への接続 | 作成 | [評価と記録](#6-評価と記録) | 現在の実行結果はQuality Centerが投影する |
| 個別Component／状態／故障の網羅 | 既存参照 | [Quality Integration](04_Quality_Integration.md)と[Quality Definitions](Definitions/) | 本書へ個別設計を複製しない |

## 3. 対象と入口

REQ 41、UX 35、IA 23、UI 20、SPEC 30、ARCH 18の計167 Canonical IDを正式入力とする。工程別Analysisが全IDを処置し、Quality Integrationが13のQuality Contractへ統合する。

| 入口 | 本書で確認すること | 詳細の所有者 |
|---|---|---|
| 6工程のAnalysis | 全Canonical IDが処置され、未知・重複・欠落がない | `Analysis/<工程>/quality_analysis.md` |
| Quality Integration | Source固有条件を失わずQuality Contractへ統合される | `04_Quality_Integration.md` |
| Quality Definition | 成功・失敗、試験段階、Local Item、観測、終了後条件が自己完結する | `Definitions/QA-*/quality_definition.md` |
| Architecture横断モデル／Details | Component、境界、状態、故障、配置の検証対象が接続される | `06_Architecture/`と`04_Quality_Integration.md` |

## 4. 試験段階と外部境界の到達範囲

試験段階はSource工程へ固定対応させず、検証する意味、境界、状態、故障および観測可能性からLocal Itemごとに選ぶ。

| 試験段階 | 主な目的 | 完成主張の上限 |
|---|---|---|
| 単体試験（UT） | 純粋規則、局所状態、入力拒否を確認する | Component外の搬送や実境界は主張しない |
| 結合試験（IT） | Component間、外部境界、隣接blockの契約とlifecycleを確認する | 公開入口から利用者結果までの全体成立は主張しない |
| 総合試験（ST） | 本番同等の入口・構成・境界を通したSystem結果を確認する | 利用者が価値を受け入れたことは主張しない |
| 受入試験（UAT） | 利用者成果と受入条件を人間の判断へ接続する | 未実施の技術段階を代替しない |

外部境界を含むLocal Itemは、確認範囲を次の閉集合から選ぶ。関連2 blocks以内で確認できる不整合を最終E2Eまで持ち越さない。

```text
N/A
  ↓
Direct Boundary
  ↓
Adjacent 1 Block
  ↓
Related 2 Blocks
  ↓
System/E2E
  ↓
User Acceptance
```

各Quality DefinitionはUT／IT／ST／UATを`Required`、`Conditional`または理由付き`N/A`で全件判定する。回帰試験（RT）は既存試験の選択・再実行方式、E2Eは試験形態として扱い、独立した試験段階にしない。

## 5. 実行・停止条件

| 対象 | 共通方針 |
|---|---|
| 通常検証 | 対象改訂版、構成、初期状態、入口、期待する観測、終了後条件を固定してから実行する |
| 外部境界 | 入力・受理・開始・Effect・結果搬送・終了後状態を同じIdentityで相関する |
| 取消・失敗・回復 | 成功例だけでなく、部分成立、観測不能、cleanup、再入場を対象にする |
| PT／LT | 各Definitionで適用判断する。適用対象でも人間が対象、上限、中止条件、費用・Credit、cleanupを明示しない限り実行しない |
| 未指示のPT／LT | `Pass`へ読み替えない。明示した受入条件またはRelease Gateでない限り、非実行だけで通常監査を停止しない |

実行開始後に対象、環境、Authorityまたは観測条件が変わった場合は、同じ結果へ混ぜず無効化・停止・再検証条件を記録する。安全な拒否や別Guardでの偶然の失敗を、意図した検証の成功として数えない。

## 6. 評価と記録

```text
Local Itemの実行
        ↓
期待した観測と終了後条件を確認
        ↓
Quality Contractを評価
        ↓
Quality Centerへ現在状態を投影
        ↓
Release／採用判断
```

| 状態 | 意味 |
|---|---|
| Designed | Canonicalな検証項目と観測・終了後条件が定義済み |
| Implemented | 対応する実装と試験入口を現実照合で確認済み |
| Executed | 対象改訂版と条件を固定して実行済み |
| Passed | 意図した理由、観測および終了後条件で合格済み |
| Evidence | 対象改訂版、結果、根拠、未確認範囲を追跡可能 |

個別の実行結果は、直接証明するChangeまたはReleaseの`Evidence/`へ保存する。結果の記録形式は[補助ひな型](../template/07_Quality/99_Verification_Result_Format.md)を使用できる。本書へ実行結果や具体的なTest Pathを追記しない。

## 7. 網羅と完了条件

- 160 Canonical IDが工程別Analysisで全数処置されている。
- Source固有条件がQuality IntegrationからQuality DefinitionのLocal Itemまで追跡できる。
- すべてのQuality DefinitionがUT／IT／ST／UATとRT／PT／LTの適用を判断している。
- 外部境界を含むLocal Itemが段階的な到達範囲、観測および終了後条件を持つ。
- 現行Source、Test、RegistryおよびEvidenceの対応は、本書ではなくReality Auditで照合される。
- 実行結果と残る未確認範囲がQuality Centerへ投影される。

## 8. 現在の未評価範囲

Canonical Quality設計と現行Source／Test／Evidenceの対応は未照合である。過去の検証設計に含まれていた個別Runtime、Tool、署名、Docker、Orchestrator、実行知および推論コンテキストの具体項目は、[現行実装との照合](05_Current_Implementation_Reality_Audit.md)で未照合候補として扱う。既存実装や過去の試験を新しいQuality Contractの根拠へ逆輸入しない。

## 9. 旧参照からの案内

過去のChangeや固定Evidenceが参照していたAnchorは、現在の正本へ進む案内だけを保持する。ここへ旧検証設計本文を戻さない。

<a id="tool-user-experience-verification"></a>

- Toolの利用体験と工程引継ぎ: [QA-000013](Definitions/QA-000013/quality_definition.md)

<a id="orchestrator-verification"></a>

- Orchestrator lifecycle: [QA-000003](Definitions/QA-000003/quality_definition.md)

<a id="execution-intelligence-verification"></a>

- 実行記録の公開と再利用: [QA-000012](Definitions/QA-000012/quality_definition.md)
- 投影と出所: [QA-000004](Definitions/QA-000004/quality_definition.md)

<a id="読取りと権限再確認の境界"></a>

- 読取りとAuthorityの分離: [QA-000004](Definitions/QA-000004/quality_definition.md)／[QA-000012](Definitions/QA-000012/quality_definition.md)

## Checklist

- [x] 検証対象、正式入力および実行入口を区別した
- [x] UT／IT／ST／UATの適用判断を検証義務ごとに行える
- [x] 外部境界の直接、隣接1 block、関連2 blocks、System／E2Eおよび利用者受入の段階を扱える
- [x] 正常、境界、準正常、異常および回復を検証設計へ含めた
- [x] 観測、Oracle、Evidenceおよび終了後条件を区別した
- [x] 実行、停止、取消および再入場条件を示した
- [x] RT／PT／LTの適用を評価し、PT／LTは人間の明示指定なしに実行しない
- [x] 網羅、未評価範囲、完了条件およびReality Auditへの接続を示した
