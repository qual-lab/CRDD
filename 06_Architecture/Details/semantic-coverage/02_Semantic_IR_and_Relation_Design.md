# Semantic IR・Relation詳細設計

成果物種別: Architecture詳細設計
詳細設計領域: semantic-coverage
状態: Canonical

## 基本設計との関係

| Architecture定義 | この領域が具体化する責務 | Relation状態 |
|---|---|---|
| [ARCH-000004](../../Definitions/ARCH-000004/architecture_definition.md) | Coordinator／Project Runtimeのlifecycle、Authority、Effect、Recoveryの設計意味を現実側へ接続するPilot。 | Covered |
| [ARCH-000008](../../Definitions/ARCH-000008/architecture_definition.md) | 外部境界と故障境界の検証可能な意味を、実装・試験の観測点へ接続するPilot。 | Covered |

本領域は既存Subsystemの設計意味を再定義しない。各SubsystemのArchitecture Detailsを入力として、機械利用可能な意味の生成とRelationの成立条件を所有する。

共通Outcome、Reality TraceabilityおよびRepository Observationとの境界は[CRDD Domain Libraryの責務境界](../crdd-domain-library/01_Architecture.md)、入力編成とBundle公開は[Semantic Coverage Architecture](01_Architecture.md)を正本とする。本書はSemantic IR、RelationおよびCoverage Graphの詳細契約を具体化する。

## 1. 目的と責務

本基盤は、Architecture Detailsで定義した意味が実装、Qualityの検証項目およびTest Symbolへ到達しているかを、AIの記憶や都度探索に依存せず判定可能にする。

```text
人間が理解・編集する層
────────────────────────────────────
Architecture Details
  ├ 責務
  ├ 境界
  ├ 状態・資源・Authority・Effect
  ├ Failure／Recovery
  └ Qualityへの引渡し
              │
              │ 決定論的なCompile
              ▼
機械が比較・結合する層
────────────────────────────────────
Semantic IR（生成物）
  ├ Semantic Key
  ├ ARCH-ID
  ├ 種別
  ├ 要求する意味
  ├ 検証要否
  └ Source Anchor
              │
       ┌──────┼────────┐
       ▼      ▼        ▼
   実装Symbol  QA Local Item  Test Symbol
```

| 所有すること | 所有しないこと |
|---|---|
| Architecture DetailsからSemantic IRを生成する契約 | Subsystem固有設計意味の新設 |
| Semantic KeyとARCH-IDの正方向Relation | Source Codeの実装内容 |
| 実装・検証・試験RelationのOwner規則 | Quality Definitionの検証内容 |
| 生成不能、重複、未接続の検出 | Reality Auditの適合判断 |
| 旧JSONからの情報損失のない移行 | 旧JSONを恒久正本として維持すること |

## 2. 正本と生成物

| 情報 | Owner | 更新方法 |
|---|---|---|
| Subsystemの設計意味 | `06_Architecture/Details/<area>/` | 人間が設計変更として更新 |
| Semantic IR | 生成器 | Architecture Detailsから再生成。直接編集禁止 |
| 実装Symbolが実現する意味 | `40_Develop/<subsystem>/symbol.json` | 実装変更と同じ変更単位で更新 |
| Local Itemが検証する意味 | `07_Quality/Definitions/QA-*/quality_definition.md` | Quality設計変更として更新 |
| Test Symbolが検証する実装 | `40_Develop/<subsystem>/symbol.json` | Test実装と同じ変更単位で更新 |
| 逆引き、Coverage、一覧 | 生成Graph／Registry | 正方向Relationから生成 |

Semantic IRがArchitecture Detailsと一致しない場合、Semantic IRを手修正しない。生成器の不具合か、Architecture Details／Templateの構造不足として処置する。

## 3. Pilotで確認する抽出可能性

### 3.1 Project Runtime

| 旧JSON field | 現在のOwner候補 | Architecture Detailsからの抽出 | Pilot処置 |
|---|---|---|---|
| `interfaces` | Architecture Details | 可能 | §2の表から抽出する |
| `persistentRecords` | Architecture Details | 可能 | §3の表から抽出する |
| `resources` | Architecture Details | 可能 | §4の表から抽出する |
| `locks` | Architecture Details | 可能 | §5の表から抽出する |
| `authorities` | Architecture Details | 可能 | §6の表から抽出する |
| `effects` | Architecture Details | 可能 | §7の表から抽出する |
| `stateMachines`／`actionBindings` | Architecture Details | 可能 | §8／§9から抽出する |
| `invariants`／`failureInjections` | Architecture Details | 可能 | §10／§11から抽出する |
| `implementationBindings` | Implementation Symbol | 不可でよい | Architecture正本から分離する |
| `verificationBindings` | Quality Definition／Test Symbol | 不可でよい | Architecture正本から分離する |

### 3.2 Coordinator

| 旧JSON field | 現在のOwner候補 | Architecture Detailsからの抽出 | Pilot処置 |
|---|---|---|---|
| `resources` | Architecture Details | 部分的 | §13.1にIDと短い意味がある。項目Schemaを固定する |
| `states` | Architecture Details | 部分的 | ID集合と全体説明はあるが、各状態の属性・説明が揃わない |
| `transitions` | Architecture Details | 部分的 | ID集合はあるが、各遷移のFrom／To／資源／不変条件が構造化されていない |
| `attemptClassifications` | Architecture Details | 部分的 | ID集合はあるが、個別の拒否条件・期待結果が表になっていない |
| `invariants` | Architecture Details | 部分的 | ID集合と本文説明の対応を一意に抽出できない項目がある |
| `verificationBindings` | Quality Definition／Test Symbol | 不可 | 25件の結合が旧JSONにのみ存在するため、Quality側へ移すまで生成不能とする |
| `verificationBoundaryByBinding` | 生成Projection | 不可でよい | Quality／Test Relationから生成する |

この差はCoordinatorの設計が不十分という一括評価ではない。人間向けには理解できるが、同じ意味を決定論的に再生成できない箇所を機械利用上のGapとして区別する。

## 4. PilotのSemantic Source Contract

Pilotでは、Architecture Details内の可視表を入力とする。自由文を自然言語解析してSemantic Keyを推定しない。

| 必須項目 | 意味 |
|---|---|
| Semantic Key | Pilot内で意味を一意に参照する仮Key |
| 種別 | lifecycle、authority、effect、resource、state、invariant、boundary等 |
| 要求する意味 | 実装・検証が保持すべき設計意味 |
| ARCH-ID | 上位Architecture定義とのRelation |
| 検証要否 | `Required`または`N/A` |
| 根拠 | 同じArchitecture Details内のAnchor |
| `N/A`理由 | 検証不要とするArchitecture上の理由 |

Semantic Keyの文字列規則と種別集合はPilot用であり、Coordinator／Project Runtimeの両方から安定して抽出・利用できた後に固定する。

## 5. Relationと生成Graph

```text
Semantic IR
  meaning.archIds = [ARCH-ID]
          │
          ├──────────────┐
          ▼              ▼
Implementation Symbol   QA Local Item
  implements             verifies
          │              │
          └──────┬───────┘
                 ▼
             Test Symbol
        verifies implementation
        qaIds + localTestIds
```

逆方向の`implementedBy`、`verifiedByQuality`、`testedBy`は生成Graphが作る。Architecture Details、Symbol Manifest、Quality Definitionの複数箇所へ同じ逆Relationを手書きしない。

生成Graphの`implementationObservation`と`testObservation`は`observed`または`unobserved`だけを返す。前者は実装Symbol、後者はTest Symbolとの接続の有無であり、実装の完成、試験の実行または合格を表さない。未接続を失敗として隠さず、後続のReality Auditが現在のSource、TestおよびEvidenceを評価するための観測結果として保持する。

Test SymbolとQuality Local Itemの結合単位は`QA-ID/Local-ID`である。Local IDだけではQA Definitionを越えて一意にならない。同じTest Symbolの`qaIds`と`localTestIds`から複数の完全一致候補が得られる場合は、誤接続を避けてGraph生成を停止する。

## 6. 失敗と停止

| 失敗 | 結果 |
|---|---|
| Architecture Detailsの必須列欠落 | IRを生成しない |
| Semantic Key重複 | IRを生成しない |
| 未知ARCH-ID | IRを生成しない |
| Source Anchor欠落 | IRを生成しない |
| `N/A`理由欠落 | IRを生成しない |
| Implementation Symbolの未知Semantic Key | Coverage Graphを生成しない |
| Local Itemの未知Semantic Key | Coverage Graphを生成しない |
| Test Symbolの未解決実装Symbol | Coverage Graphを生成しない |
| 必須Meaningに実装Symbolがない | `unobserved`としてGraphへ残す。実装不足または未接続の判定はReality Auditへ渡す |
| 必須MeaningにQuality Local Itemがない | Coverage Graphを生成しない |
| 必須MeaningにTest Symbolがない | `unobserved`としてGraphへ残す。Pass／Failへ変換しない |
| `QA-ID/Local-ID`が複数候補へ解決される | Coverage Graphを生成しない |
| 一部Subsystemだけ正常 | 部分Graphを正式結果として発行しない |
| 生成中に失敗する | 既存Bundleを保持し、新しい部分Snapshotを公開しない |

生成不能時に自由文から意味を推測したり、旧JSONの値を現在の正本として補ったりしない。

## 7. 旧Runtime JSONの移行

旧JSONは次の順で分解する。

```text
旧Runtime JSON
      │
      ├ 設計意味 ──────→ Architecture Detailsへ不足を返す
      ├ 実装結合 ──────→ Implementation Symbolへ移す
      ├ 検証結合 ──────→ Quality Local Item／Test Symbolへ移す
      └ 逆引き・一覧 ──→ 生成Projectionへ置換する
```

移行完了は旧JSONを削除したことではなく、各fieldの意味が一つのOwnerへ移り、生成Graphから同等以上の問いへ答えられ、利用側が新経路へ移ったことで判定する。

## 8. Qualityへの引渡し

| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |
|---|---|---|---|---|---|---|
| IR決定性 | 同じArchitecture Details | 同じbyte列のIRを生成 | 順序揺れ、時刻混入、自由文推測 | 入力Hash、出力Hash | IRとCoverageを含む一つのBundle | Pilot実装で確認 |
| 抽出完全性 | PilotのSemantic Source Contract | 全行を一度だけ抽出 | 行欠落、重複、未知ARCH-ID | 行集合比較、Finding | Finding 0またはIR非発行 | Pilot実装で確認 |
| Relation閉包 | IR、Symbol、Local Item、Test Symbol | 宣言された正方向Relationが完全修飾IDで解決し、実装／Test未接続は`unobserved`になる | 未知Key、未解決Symbol、QA間誤接続、未接続の正常化 | Coverage Graph | 部分Graph非発行 | Pilotで確認済み |
| Snapshot公開 | IRとCoverageの生成Bundle | 全内容の検証後に一度だけ置換する | 途中失敗で新旧結果が混在 | 一時Fileと公開Fileのbyte列 | 旧Bundleまたは新Bundleのどちらか一つ | 失敗注入で確認済み |
| 移行情報保持 | 旧Runtime JSONの全field | 各fieldに新Ownerまたは生成物としての処置がある | 未分類、二重Owner、意味欠落 | 移行Matrix | 旧JSON利用側の移行待ちを区別 | Pilotで分類済み |

## Checklist

- [x] Architecture DetailsとSemantic IRを正本／生成物として分けた
- [x] 旧Runtime JSONを正本にしていない
- [x] Relationの正方向Ownerを一つに限定した
- [x] 逆Relationを生成Projectionとした
- [x] CoordinatorとProject Runtimeの抽出可能性を分けて評価した
- [x] 生成不能時にAI推測で補完しない
- [x] 部分Graphを正式結果として発行しない
- [x] Reality Auditを本基盤の後続に分けた
- [x] Quality Local Itemの正方向Relationを可視表から生成した
- [x] Test未接続を`unobserved`として保持し、試験結果へ読み替えていない
- [x] 実装未接続を`unobserved`として保持し、実装不足へ読み替えていない
- [x] Quality Local Itemを`QA-ID/Local-ID`で解決し、曖昧な組合せを拒否した
- [x] IRとCoverageを一つのBundleとして原子的に公開した
- [x] Checker固有処理、CRDD共通能力およびSemantic Coverage固有能力を別Ownerへ分離した
- [x] Pilot結果を独立レビューし、現行のSemantic Key記法とSchemaをPilot revision 0として維持した
