# 実行記録の読取りと評価候補の詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: execution-intelligence
状態: Canonical
維持責任者: Qual-Lab

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000007](../../Definitions/ARCH-000007/architecture_definition.md) | 利用可能な実行記録を読取り、欠測を保った事実と非Authorityな評価候補を返す。 | Covered |
| [ARCH-000016](../../Definitions/ARCH-000016/architecture_definition.md) | Source Revision、観測時点および評価候補の時間的出所を、現在値と履歴を混同せず解決する。 | Covered |
| [ARCH-000018](../../Definitions/ARCH-000018/architecture_definition.md) | 異なる作成側のCanonical Eventを検査し、並行書込みと途中失敗を扱って不変に公開する。 | Covered |

## 詳細成果物の適用判断

| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |
|---|---|---|---|
| Component Model | Required | Record Port／Writer／StoreとQuery／Reader／Projectionを分ける。 | [§1](#1-component-model) |
| Interface Model | Required | 記録Portと読取りPortを別のAuthority／Effect境界に置く。 | [§2](#2-interface-model) |
| Data Flow | Required | 観測から不変記録、記録から事実・欠測・評価候補へ至る変換を追跡する。 | [§3](#3-data-flow) |
| State Model | Required | 記録Attemptとrecorded／not_recorded／unknown、読取りのobserved／not_observed／unknownを区別する。 | [§4](#4-state-model) |
| Sequence | Required | 記録と読取りそれぞれの検査、公開、確認、投影の順序を固定する。 | [§5](#5-sequence) |
| Failure／Recovery | Required | 並行衝突、途中失敗、Effect不明、Source欠落、破損、相関不一致を扱う。 | [§6](#6-failurerecovery) |
| Deployment | Required | 複数ProcessのWriterが同じ検証済みRepository Rootへ公開し、API／CLI／MCP等のReaderが同じStoreを参照する配置条件を固定する。 | [§7](#7-deployment) |
| Observability | Required | 記録Attempt、公開確認、読取り結果と欠測理由を同じExecution Identityで相関可能にする。 | [§8](#8-observability) |
| Security Boundary | Required | 記録権限と読取り権限を分け、いずれも変更・採用・実行Authorityへ昇格させない。 | [§9](#9-security-boundary) |
| Implementation Structure | Required | 設計責務を具象差、選択、状態依存、構成、資源Ownerおよび外部境界へ分解する。 | [§Implementation Structure](#implementation-structure) |

## Engineering Concern評価

| Concern | Result | Rationale | Evidence／Related ID |
|---|---|---|---|
| Concurrency | PASS | Writerは不変公開と衝突後再読取りを用い、Readerは一つのSnapshot内で異なる観測時点を混在させない。 | [§4](#4-state-model) |
| Timing | PASS | 観測時点とSource Revisionを結果へ保持し、古い値を現在値として返さない。 | [§4](#4-state-model) |
| Resource Lifecycle | PASS | WriterのLock、一時物、Handleを公開確認または失敗settlement後に回収し、ReaderのHandleも終了時に残さない。 | [§5](#5-sequence) |
| External Boundary | PASS | 作成側入力の受理／公開と、ReaderのSource取得不能／記録不存在をそれぞれ別状態で返す。 | [§6](#6-failurerecovery) |
| Failure／Recovery | PASS | 公開Effect不明は同じExecution IdentityのAttemptへ再入場し、読取り不能時は状態を推測せず再取得可能な参照と理由だけを返す。 | [§6](#6-failurerecovery) |
| State／Consistency | PASS | 記録Attemptとrecorded／not_recorded／unknown、読取りのobserved／not_observed／unknownを区別する。 | [§4](#4-state-model) |
| Observability | PASS | 記録Attempt、公開確認、読取り結果と欠測理由を同じExecution Identityで相関可能にする。 | [§8](#8-observability) |
| Security／Trust | PASS | 記録権限と読取り権限を分け、いずれも変更・採用・実行Authorityへ昇格させない。 | [§9](#9-security-boundary) |

結果語彙は次の意味に限定する。

- `PASS`: 詳細設計上の処置と根拠節が揃った状態。実装済み・試験済みを意味しない。
- `N/A`: Architecture上、そのConcern自体が存在しない状態。未検討や後工程送りを意味しない。
- `OPEN`: 未解決の設計事項が残る状態。
- `FAIL`: 必須設計と矛盾する、または必要な設計が未充足の状態。

## Qualityへの引渡し

| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|---|---|---|
| `execution-intelligence.record-read` | Interface／Flow | Query／Reader | 許可されたSourceのexact記録だけを返す | 別Task混入、破損黙殺、欠測補完 | UT／IT | Direct Boundary | Source ID、Task ID、Revision、読取り結果 | 書込みEffect 0、Handle 0 | 外部Source別の実在性 |
| `execution-intelligence.state-projection` | Flow／Consistency | Aggregator／Projection | observed／not_observed／unknownを区別する | unknownを空値や正常へ畳む | UT／IT | Adjacent 1 Block | 状態、reason、observed at | 入力記録不変、Authority発行0 | 利用側表示の理解可能性 |
| `execution-intelligence.temporal-provenance` | Flow／Consistency | Revision／Observed At | 現在値と履歴を区別できる | 古い記録を現行として表示 | UT／IT | Adjacent 1 Block | source revision、observed at | 履歴変更0 | Clock差の実境界 |
| `execution-intelligence.evaluation-candidate` | Interface／Transition | 事実と評価候補 | 両者を別結果として返す | 候補を事実・採用判断へ昇格 | UT／IT | Adjacent 1 Block | fact、candidate、basis | 採用Effect 0 | 人間判断後の下流処置 |
| `execution-intelligence.record-publication` | Sequence／Lifecycle Ownership | Record Port／Writer／Store | Canonical Eventを同じExecution Identityで不変公開する | 並行上書き、部分公開、重複事実、Effect不明の自動再発行 | IT／ST | Related 2 Blocks | Execution ID、Attempt、publish結果、再読取り | Lock／一時物／Handle 0、または同じIdentityの回復義務 | 複数作成側の実境界 |

導出キーは本領域内でQualityが同じ設計項目を反復参照するための局所参照であり、CRDD全体の安定コンテキストIDではない。

## 現行実装との照合

v0.20.1にはEvent生成、Recorder、Store Writerおよび不変保存の成立済みCapabilityがある。これらは[ARCH-000018](../../Definitions/ARCH-000018/architecture_definition.md)の現行照合対象として[現行実装のReality Audit](02_Current_Implementation_Reality_Audit.md)で比較する。基準版実装の存在だけをCanonical設計の成立根拠にはしない。

## 1. Component Model

```text
実行Runtime／外部Application
          │ Canonical Event
          ▼
      Record Port
          ↓
  Schema／Identity検査
          ↓
        Writer
          ↓ 不変公開
       Record Store
          ↑
        Reader
          ↑
         Query
          ↑
Workbench／MCP／CLI／TS API

Reader → 検査・相関・Aggregation → Read-only Projection
                                      ├─ 観測事実
                                      ├─ 欠測／不明
                                      └─ 非Authority評価候補
```

Writerだけが検証済みRecord PortからStoreへの公開Effectを所有する。ReaderとProjectionは入力Sourceを変更しない。いずれもTask状態、Project状態、実行許可または評価採用を所有しない。

## 2. Interface Model

記録Portは、作成側Identity、Execution Identity、Attempt、Canonical Event、Schema Revisionおよび相関情報を受け取る。Writerは入力を再解釈せず検査し、公開結果を`recorded`、`not_recorded`、`unknown`で返す。`unknown`には同じAttemptへ再入場する非Authorityな回復参照を含められる。

読取りPortは、許可されたSource識別、対象Task、取得条件とSnapshot条件を受け取る。結果は、観測状態、事実、評価候補、Source Revision、観測時点および欠測理由を返す。どちらのPortもFilesystem Pathや内部Store表現を公開契約へ漏らさない。

## 3. Data Flow

```text
Runtime event
   ↓ schema・producer・execution identity検査
Validated canonical event
   ↓ attempt単位の一時保存と排他
Immutable publish
   ↓ publish結果の再読取り確認
Canonical execution record
   ↓ task・revision・time相関
Observed facts + missing/unknown
   ↓ 評価候補を別fieldへ導出
Read-only result
```

要求値、観測値および評価値を相互に代用しない。Sourceが返さない値は未観測として保持する。

## 4. State Model

| 状態 | 意味 | 禁止する短絡 |
|---|---|---|
| `prepared` | 入力と対象Rootを検査し、まだ公開Effectを発行していない | 記録済みとみなさない |
| `publishing` | 同じAttemptで不変公開を試行している | timeoutを未記録へ畳まない |
| `recorded` | 公開後の同一内容をStoreから再読取り確認できた | 別Attemptや別内容の成功へ流用しない |
| `not_recorded` | 公開Effect前に拒否または失敗し、対象不存在を確認できた | `unknown`を含めない |
| `publication_unknown` | Effect有無または公開内容を確認できない | 新しいAttemptで自動再発行しない |
| `observed` | 許可されたSourceから対象記録を検査できた | 現在有効・採用済みとみなさない |
| `not_observed` | Sourceは読めたが対象記録がない | 正常値や0へ補完しない |
| `unknown` | Sourceまたは相関を検査できない | `not_observed`へ畳まない |

一つの結果は単一Snapshot条件を持つ。異なるRevisionや観測時点の結果を、同じ現在状態へ暗黙統合しない。

## 5. Sequence

```text
【記録】
Canonical Eventと対象Rootを検査
      ↓
同じExecution Identity／Attemptで排他取得
      ↓
一時保存 → flush → immutable publish
      ↓
公開内容を再読取り確認
      ↓
recordedを返す ──失敗／不明──→ 同じAttemptの回復義務を保持
      ↓
Lock／一時物／Handleを回収

【読取り】
取得条件を検査
      ↓
Sourceを読取る
      ↓
Schema／Identity／Revisionを検査
      ↓
事実・欠測・評価候補を分離
      ↓
根拠付きProjectionを返す
```

記録Sequenceの公開以外ではStoreへの書込みEffectを行わない。読取りSequenceでは書込みEffectを行わず、両経路ともTask更新、候補採用または実行Authority発行を行わない。

## 6. Failure／Recovery

- 入力拒否、公開前失敗、公開済み、公開Effect不明を分ける。
- 同じExecution Identityへの同内容再送は再読取りで収束させ、異なる内容との衝突は上書きせず拒否する。
- 並行Writerは一方の不変公開後に他方が同内容を再読取りできる場合だけ同じ結果へ収束する。
- 一時保存、flush、renameまたは公開確認の途中失敗では、対象不存在を確認できない限り`not_recorded`を返さない。
- 公開Effect不明時は同じAttemptと回復参照を保持し、新しいIdentityや拡大Authorityを発行しない。
- Source不存在とSource観測不能を分ける。
- 記録破損、Schema不一致、Identity不一致またはRevision競合を黙って除外しない。
- 部分的に読めた結果を完全な履歴として返さない。
- 再取得可能な場合は、秘密情報を含まないSource参照、Snapshot条件と失敗理由を返す。
- 回復処置そのものは所有せず、再取得後も同じ対象Identityを用いる。

## 7. Deployment

Record PortとQueryはTypeScript APIとして同じ契約を公開し、CLI、MCPまたはWorkbenchはAdapterとして利用する。Writerが別Processに分かれても、検証済みRepository Root、Store Schema、Execution Identityおよび不変公開規則は変えない。複数ProcessのWriterが同じStoreへ到達する場合はprocess間排他を使用する。共有Serverでの接続認証とRepository ExposureはCROS／Transport側が所有する。

## 8. Observability

診断結果には、Execution Identity、Attempt、作成側種別、公開段階、公開確認、対象Task、Source種別、Source Revision、観測時点、観測状態、欠測理由および評価根拠を含める。Raw provider出力、資格情報または許可されていないPathを診断目的で複製しない。

## 9. Security Boundary

- 記録Portの利用資格を、Task実行、評価採用、別Executionへの記録または回復Authorityとして扱わない。
- Sourceを読めることを、Source変更、Task実行、評価採用または回復Authorityとして扱わない。
- 開示不可Sourceの存在やIdentityを境界外へ漏らさない。
- 評価候補は非Authorityであり、明示した決定権限者の判断を代替しない。
- CanonicalなTask Identity、Revisionおよび観測時点を利用側で再解釈しない。

## Implementation Structure

| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |
|---|---|---|---|---|---|---|
| Variation | Required | この観点を成立させる構造と責務が存在するため。 | Qualityへの引渡しで責務差を別の設計項目として固定する。 | 具象差を一つの分岐へ畳まず、各導出キーの正常条件と反証条件を保つ。 | 新しい具象を追加した場合、対応する導出キーと利用側の再確認が必要になる。 | `execution-intelligence.record-read`<br>`execution-intelligence.state-projection`<br>`execution-intelligence.temporal-provenance`<br>`execution-intelligence.evaluation-candidate`<br>`execution-intelligence.record-publication` |
| Common Contract | Required | この観点を成立させる構造と責務が存在するため。 | 実行Record、状態Projection、時系列根拠と評価候補を、観測値・推定・未観測を分ける共通契約へ揃える。 | ReaderやProjectionが異なってもSource、Observed At、Freshnessおよび欠測を保持する。 | 新しいRecord種別が独自の現在値や欠測表現を持ち、古い値を現在値へ畳む。 | `execution-intelligence.record-read`<br>`execution-intelligence.state-projection`<br>`execution-intelligence.temporal-provenance` |
| Creation／Selection | N/A | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 本領域は独立した具象生成・選択責務を持たず、上位から固定入力を受ける。 | 生成・選択判断を本領域へ追加しない。 | 将来生成・選択責務を追加する場合に再評価する。 | N/A |
| State-dependent Behavior | Required | この観点を成立させる構造と責務が存在するため。 | 入力・処理中・完了・失敗・観測不能を区別して振る舞いを決める。 | 状態を空値や成功へ畳まず、同じIdentityで終了条件まで追跡する。 | 状態追加・統合はRecoveryと観測契約へ波及する。 | `execution-intelligence.record-read` |
| Composition／Recursion | Required | この観点を成立させる構造と責務が存在するため。 | 複数の局所責務を公開結果へ合成し、部分成立と全体成立を分ける。 | 各局所結果を保持し、必要な全要素が揃うまで上位完成を表示しない。 | 構成要素の追加時は完成条件と全Consumerを再確認する。 | `execution-intelligence.record-read`<br>`execution-intelligence.state-projection`<br>`execution-intelligence.temporal-provenance`<br>`execution-intelligence.evaluation-candidate`<br>`execution-intelligence.record-publication` |
| Lifecycle Ownership | Required | この観点を成立させる構造と責務が存在するため。 | Process、Handle、一時物、秘密または公開SnapshotのOwnerと終了条件を固定する。 | 成功・失敗・取消の全経路で資源回収または同一Identityの回復義務を残す。 | Owner変更は取消、Recovery、終了後条件へ波及する。 | `execution-intelligence.record-publication` |
| External Boundary | Required | この観点を成立させる構造と責務が存在するため。 | 外部境界ごとに要求、受理、Effect、結果搬送および終了後状態を分ける。 | 境界の成功を要求発行だけから推定せず、段階に応じた観測を必須にする。 | 境界変更は直接境界からSystem／E2Eまでの検証範囲へ波及する。 | `execution-intelligence.record-publication` |

同じ責務へ二つ目の具象実装を追加する場合は、共通契約へ昇格するかを評価する。昇格しない場合は、同じ責務ではない、または局所分岐の方が単純で影響が小さい理由を記録する。特定のDesign Pattern名は必須にしない。

## 上流UI／SPEC Detailとの関係

| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |
|---|---|---|---|---|
| [UI／SPEC Detail Architecture Traceability](../../08_UI_SPEC_Detail_Traceability.md) | ARCH-000007、ARCH-000016、ARCH-000018のSource Definition | 同Traceability表で上記ARCH-IDへ接続された全Detail ID | Covered | Detailの意味変更はUI／SPECへ、配置責務の変更は該当ARCH定義へ戻す |

担当Interaction Relation: `PRT-000005.spec-000008`、`PRT-000017.spec-000022`、`PRT-000020.spec-000030`

本領域は上記Relationの配置責務を局所所有する。Detailを新しい要求として解釈せず、対応ARCH-IDが所有する配置・境界・状態・観測の制約として実現する。

## Checklist

- [x] 関連するARCH-IDと担当する責務断面を明示した
- [x] 10種類の詳細成果物を全数Applicability判定した
- [x] Requiredを実在する節または成果物へ接続した
- [x] N/AにArchitecture上の理由を記録した
- [x] 8種類のEngineering Concernを全数評価した
- [x] PASSを設計済みの意味に限定した
- [x] Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した
- [x] Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した
- [x] 7種類のImplementation Structure観点を全数Applicability判定した
- [x] 二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した
- [x] Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した
- [x] Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した
- [x] Human Inputの必要性とOpen／Gapを評価した
- [x] 現行実装との照合をReality Auditとして分離した
- [x] Source構造をCanonical詳細設計へ逆輸入していない
