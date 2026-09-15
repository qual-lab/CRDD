# 品質分析

成果物種別: Quality分析
分析単位: `<試験段階／意味のある対象集合>`
状態: Draft
維持責任者: `<担当責任者>`

## 1. 確認する理由

`<この横断分析が、どの不確実性またはRiskを減らすか>`

```text
[Canonical IDの全集合]
          │ 一件ずつMapping
          ▼
[検証すべき意味]
          ↓
[検証義務]
          │ Same／New／Merge
          ▼
[検証目標]
          ↓
[試験段階・種別／検証定義]
```

## 2. 母集団の導出

| 工程 | Canonical Definitionの導出元 | 件数 |
|---|---|---:|
| Discovery | `01_Discovery/Definitions/REQ-*/requirement.md` | `<件数>` |
| UX | `02_UX/Definitions/UX-*/ux_definition.md` | `<件数>` |
| IA | `03_IA/Definitions/IA-*/ia_definition.md` | `<件数>` |
| UI | `04_UI/Definitions/UI-*/ui_definition.md` | `<件数>` |
| SPEC | `05_SPEC/Definitions/SPEC-*/spec_definition.md` | `<件数>` |
| Architecture | `06_Architecture/Definitions/ARCH-*/architecture_definition.md` | `<件数>` |

Directory名だけで数えず、所定のDefinition実体が存在するIDだけを母集団とする。

## 3. 全件Mapping

| Source ID | 検証すべき意味 | 検証義務 | 検証目標 | Level | Type | 処置状態 |
|---|---|---|---|---|---|---|
| `<Canonical IDへのLink>` | `<成立条件または利用者・運用への意味>` | `<何を保証するか>` | `<DefinitionへのLinkまたは候補名>` | `<UT／IT／ST／UAT>` | `<Functional／State／Fault等>` | `Mapped／Gap／N/A` |

対象とする`REQ-*`、`UX-*`、`IA-*`、`UI-*`、`SPEC-*`および`ARCH-*`のCanonical集合は、各IDを一行以上で処置する。同じIDに複数の独立した検証義務がある場合は複数行に分ける。Canonical集合、Mapping集合、欠落、未知IDおよび重複による曖昧さを機械検査できるようにする。

## 4. 検証義務の統合

| 検証義務Candidate | 処置 | 検証目標 | 判断理由 |
|---|---|---|---|
| `<Candidate>` | `Same／New／Merge` | `<DefinitionへのLinkまたは候補名>` | `<統合してもSource ID固有の意味が失われない理由>` |

複数のSource IDが同じ検証目標へ収束することは、Quality工程の意図した統合である。統合後も、各Source IDから固有の成立条件、検証項目およびEvidenceへ逆引きできなければならない。

### 4.0. Source固有条件と検証項目の関係

| Source ID | 検証目標 | 保持する固有条件 | 対応Local Item |
|---|---|---|---|
| `<Canonical IDへのLink>` | `<DefinitionへのLink>` | `<Source固有の成立条件。検証目標の共通説明へ置換しない>` | `<Definition内Local IDを一つ以上>` |

§3のSource IDと検証目標の関係を、同じ集合のままLocal Itemまで具体化する。同じSource IDでも検証目標が異なる場合は別行にし、条件を共通名へ丸めない。§3、§4.0および各Definitionの関係集合を機械的に完全一致させる。Source固有条件は空白差を除いて同じ文面を保ち、別の説明へ言い換えない。

### 4.1. Architecture横断モデルの処置

| 検証目標 | [Component／責務](../../../06_Architecture/02_Component_and_Responsibility_Model.md) | [境界／Interface](../../../06_Architecture/03_Boundary_and_Interface_Model.md) | [Runtime／Data Flow](../../../06_Architecture/04_Runtime_and_Data_Flow_Model.md) | [故障／回復](../../../06_Architecture/05_Failure_Recovery_and_Resilience_Model.md) | [配置／実行](../../../06_Architecture/06_Deployment_and_Execution_Model.md) |
|---|---|---|---|---|---|
| `<検証目標>` | `Required／N/A: 理由` | `Required／N/A: 理由` | `Required／N/A: 理由` | `Required／N/A: 理由` | `Required／N/A: 理由` |

5つの横断モデルを同じArchitecture一覧から暗黙に処置せず、各検証目標に必要かを個別に判定する。`N/A`には理由を残す。

### 4.2. Architecture詳細設計領域の処置

| 詳細設計領域 | 接続する検証目標 | Qualityで受け取る主な成立条件 |
|---|---|---|
| `../../../06_Architecture/Details/<area>/01_Architecture.md` | `../../Definitions/<verification-objective>/verification.md` | `<境界、状態、故障、観測、終了後条件>` |

`06_Architecture/Details/*/01_Architecture.md`の現在集合を全数処置する。領域名の記載だけでCoverageとせず、どの検証目標が何を受け取るかを明示する。この関係集合は各Definitionの「Architecture詳細設計入力」と完全一致させる。

### 4.3. 検証項目の閉包

| 検証目標 | Local Item集合 | 入力Coverage | Architecture入力 |
|---|---|---|---|
| `<検証目標>（../../Definitions/<verification-objective>/verification.md）` | `<Definition内の全Local ID>` | `§3の当該目標へ接続した全Source ID` | `§4.1と§4.2の該当入力` |

すべての検証定義とLocal Itemを全数処置する。Local Itemの全体集合だけでなく、検証目標との組を各Definitionから導出した組と完全一致させる。表への記載だけで意味Coverageとせず、個別Definitionの事前状態／入力、刺激、観測、期待理由、終了後条件および実行形態を独立レビューする。

## 5. 試験段階・種別の判断

| 試験段階 | 処置 | 理由 |
|---|---|---|
| UT | `<Required／N/A>` | `<理由>` |
| IT | `<Required／N/A>` | `<理由>` |
| ST | `<Required／N/A>` | `<理由>` |
| UAT | `<Required／N/A>` | `<理由>` |
| RT | `<Required／N/A>` | `<再実行する既存検証の選択条件>` |
| PT／LT | `<Design only／Required with Human authorization／N/A>` | `<理由>` |

試験段階をSource工程へ固定対応させない。同じSPECでも、純粋な判断分岐はUT、Component間契約はIT、公開された一連の振る舞いはSTになり得る。回帰試験（RT）は独立した試験段階ではなく、変更影響に応じて既存の検証を再実行する選択として扱う。PT／LTは設計できるが、人間が対象、環境、上限、費用／Credit、中止条件およびcleanupを明示しない限り実行しない。

## 6. 故障と観測

| 分類 | 作る状態 | 観測すること | 終了後条件 |
|---|---|---|---|
| 正常 | `<状態>` | `<観測>` | `<条件>` |
| 準正常／境界 | `<状態>` | `<観測>` | `<条件>` |
| 異常／判定不能 | `<状態>` | `<観測>` | `<条件>` |

## 7. 実行形態と根拠

| 確認対象 | 実行形態 | 必要な根拠 |
|---|---|---|
| `<対象>` | `Automated／Manual／Hybrid` | `<Evidence要件>` |

## 8. 網羅状態と下流への引き渡し

- Canonical母集団: `<件数と導出元>`
- Mapping済み: `<件数>`
- Gap／N/A: `<件数と理由>`
- Context Gap: `<なし／上流へ戻す事項>`
- Quality Analysis Gap: `<なし／未分析事項>`
- 検証定義へ渡すこと: `<検証目標、状態、観測、終了後条件>`
