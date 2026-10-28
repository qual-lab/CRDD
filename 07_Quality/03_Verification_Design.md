# CRDD検証設計

## Core独立・共通保存の検証計画 — 2026-10-27

### 編集E2E試験領域の分離 — 2026-10-29

編集Toolは既存の有限Client／Server／Owner時計も使用する。既存取消の十一条件でcallback・段階・解除済み投影を照合し、実保存HTTPでは正常完了保存と同IDの状態取得を並行要求として確認する。Promise.allだけで保存処理との厳密な時間重複を主張しない。start／observe／cancel／closeの実操作と時計段階を合わせ、Client終了後・Owner終了待ち前に購読を解除する。本文・Tokenは記録せず、十五秒期限は不変である。

`verify-workspace-ai.ts`はRepository-local testsの実体確認とDocker一覧読取り後に、`mkdtempSync`で新品の`workspace-ai-*`を一件確保する。固定日付Rootを再利用せず、追加設定・Registry・互換読取りは持たない。作成後の実体確認・子Directory作成失敗では、exact Rootと固定理由をconsoleへ返して保持し、未確認Rootへ結果Fileを書いたり削除したりしない。正常・親領域拒否・realpath差・Root link・mkdir拒否を有限代役で確認する。

`--preflight`は編集を合成File更新で代替し、公開HTTP・本番保存・候補固定・二親Merge・既存dirty／stage保全・Worktree／Branch回収を確認する。AI Client生成・Provider送信は行わず、Dockerは既存一覧比較のみ。実AI編集・レビューの成立や全体QA合格とは区別する。AI受付／観測十五秒・Workspace操作六十秒は変更しない。

### Provider単段Executor分離の非AI確認 — 2026-10-28

正常終了後の試験清掃は、Claudeの既知の空`tmp/claude-65534/`だけを受理し、Codexでの同名残存・未知名・File・非空・子link・子Identity差・中間tmpのlink化／Identity差を拒否する。LinkとIdentity差はmetadataの有限代役であり、実OSでの競合耐性を証明するものではない。拒否時は子rmdir零・確定イベントbytes保全を確認する。再帰削除・製品Recovery・過去Rootの処置を追加しない。

合成助言は正式Schema・許可参照がPromptに含まれることを検査する。Platform Home観測・NamedPipe Lease・Docker Isolation Runtimeの物理処置と清掃／資源観測を有限代役化し、Command stdoutへ合成Envelopeを与える。試験Host・Executor・AI Adapter Parser・内容Normalizerは実体を通す。両Providerの正常、余分／欠落field、Contract／Revision／status、空全区分、不正項目、投影外参照、Transport拒否を区別する。Codexの重複Keyは最終Agent文字列から内容検査へ届くため別反例とする。実行失敗・元終端保存失敗の一次理由は内容拒否で上書きしない。合成Envelopeの成功を、実AIのSchema準拠保証や前回結果の理由確定へ換算しない。

Receiptの通常代役は実CLIと同じLF付きIDを返し、裸ID・CRLFも確認する。短いID・複数ID・途中改行・非16進文字・大文字・空値は受領段階で拒否し、Receipt保存零・後続Provider未発行・同回復参照保持を確認する。五資源の保存IDがすべて改行なしの64桁であることを照合し、実Docker再実行の代替とはしない。

失敗診断の接続では、作成応答未観測・清掃不明・排他解放拒否／例外でも一次診断が結果IPCに残り、解放不明後の診断Writer呼出しが零であることを確認する。予定資源名／labelの一致と清掃側の閉形式検査、生出力fieldの拒否、診断保存拒否が実行結果を変更しないことも反証する。Platform Accessの無出力Workerは、実helper＋有限代役Workerで共有状態・release通信・error／exit・unref親終了を分け、旧resume構成の変異を同じ終了Oracleで拒否する。実Home／Dockerは使わず、Worker stdioの破棄を排他解放成功へ換算しない。

実Homeの事前確認用Scriptは別入口に分け、Platform observer／Named Pipeは代役化して、初回拒否・再観測差・観測／checkpoint例外・取得不能／不明・解放不明を反証する。元Lockの解放一回、未知時のRoot保持、非秘密checkpointと既存Pipe名の式互換を確認する。実Native・共有Home観測・OS排他取得は、この試験から成功としない。

単段試験Hostは実確定JSONと既存Executorを用い、下位DIと同期Leaseだけを代役化する。Effect前の回復記録・同ID引渡し、五資源の提出／Receipt相関、通知中だけの元参照照合、清掃後の一回解放、元終端だけの保存を検査する。正常・取消・清掃不明・排他喪失・解放拒否／例外・回復開始／Provider通知／不存在／終端保存拒否を負例とし、実Worker終了・Home観測・本番保存・Host喪失回復の成立へ拡張しない。

実試験CLIは純粋計画・非TTY拒否、子内の固定助言計画／Home差替え／取消join／取得解放不明、親の同意不成立／別nonce／重複結果／非零close／stdout混入／close不明を分けて検査する。Native・Lease・Host又はforkを用途別に代役化し、実確定JSONの清掃拒否を確認する。取消後の遅延close・結果喪失・取消と成功の競合・切断済み子も反例とし、元回復参照とclose未観測時のRoot無変更を確認する。Coordinatorの静的依存を混入させた変異を先行hookで拒否し、実IPC子では不正計画と開始前取消をHome／Root作成前に拒否する。fork代役によるclose試験は実Provider子の終了確認ではなく、実境界の検証義務を残す。実送信時は表示された合成入力・Model・固定Source・一回上限と当該Rootの回収までを別途承認する。

再実行入口は`executor/scripts/verify-provider-attempt.ts`とし、既存ITから同じ関数を呼ぶ。import時の書込み・Process生成零、専用fixture排他取得後だけの同期保存Gate、確定JSONのIdentity・Hash・本文読戻し、不正／コピー／失効／Gate例外時の保存零、排他解放後の再取得、全子終了後の確認・通常清掃を検査する。本番共有Home／Host排他・認証・Runtime state保存の代用とはしない。

[Executor詳細](../06_Architecture/Details/executor/01_Architecture.md)を既存ERB-IT-002／004へ接続する。準備二Mapと観測二Mapは新Owner内へ移し、元通知の同期登録・失効、元result借用と候補／本番交差拒否を確認する。独立子ProcessのCoordinator解決拒否と不正開始のEffect零、Coordinator既存の編集→レビュー→是正→再レビュー・取消・Owner喪失を別々のOracleで確認する。単独の候補生涯と、本番Factoryの配線・実計画投影は有限代役で別構成として検査し、正常・取消join・清掃不明・通知保存例外の元参照を照合する。Module代役下の配線確認を、本番Docker Runtime内部・耐久保存・実資源不存在・Host喪失の成立へ換算しない。Domainのcodec・Writer・CAS・schema・hash領域は変更しない。実Docker・外部AI・過去保持物は対象外。非AI結果をL3／L5又は全体QAのPassへ昇格しない。

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
