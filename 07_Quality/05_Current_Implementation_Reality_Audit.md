# 現行実装との照合

成果物種別: Quality現実照合
状態: In Progress
現在範囲: Coordinator／Project Runtime Pilot
維持責任者: Qual-Lab

## 設計集合

| 項目 | 件数 |
|---|---:|
| Local Item数 | 114 |
| 内訳 | 114 Review済み |

## 1. 目的

[Quality Integration](04_Quality_Integration.md)と各[Quality定義](Definitions/)を基準に、現行Source、Test Catalogおよび実境界Evidenceがどこまで対応するかを照合する。既存実装や試験の存在から検証義務を逆算しない。

```text
[157件のCanonical入力]
          ↓
[Quality Mapping]
          ↓
[検証定義とLocal Item]
──────────────────── ここまでを先に固定
          ↓
[Source／Test／Evidenceとの照合]
          ↓
[Implemented／Executed／Passed／Evidenceあり]
```

## 2. 判定の単位

検証目標全体を一つの`Covered`へ丸めない。各Local Itemについて次を別々に判定する。

| 判定軸 | 意味 |
|---|---|
| Designed | Canonicalな検証項目、正常・境界・失敗、観測、終了後条件が定義済み |
| Implemented | 対応する実装と試験入口を確認済み |
| Executed | 対象改訂版と条件を固定して実行済み |
| Passed | 期待した理由、観測および終了後条件で合格済み |
| Evidence | 結果、対象改訂版、未確認範囲および根拠を追跡可能 |

`Safe Reject`、試験ファイルの存在、以前の版のPass、別のGuardによる偶然の拒否は、目的のLocal Itemの`Passed`を意味しない。

## 3. 照合方法

| 入力 | 照合する内容 | 禁止する推定 |
|---|---|---|
| Source | Owner、境界、Effect、状態、失敗・回復の実装位置 | ファイル名やDirectory名だけで実装済みとする |
| Test Catalog | 対象、段階、実境界、Lifecycle、選択条件 | 登録件数から意味Coverageを推定する |
| Test | 刺激、観測、期待理由、終了後条件 | 最終statusだけで意図したGuardの成立を推定する |
| Evidence | 改訂版、環境、実行結果、未確認、残存Risk | 過去版や別条件の結果を現在へ流用する |

## 4. 現在状態

| 対象 | 状態 | 理由 | 次の処置 |
|---|---|---|---|
| 13検証目標のLocal Item | Quality Design Ready | 157件のMapping、Source ID固有条件、114 Local ItemおよびCRDD Domain Library Candidateの6検証単位とのRelationを固定した | Pilotの17意味に接続したLocal Itemから照合する |
| 現行Source／Test | Pilot初回照合済み | 17意味のうち16件を実装Symbol、Quality Local Itemおよび実試験Symbolへ接続し、1件を実装欠落として分離した | 実行不一致1件と実装欠落1件を所有変更へ返す |
| 実行結果／Evidence | Pilot局所実行済み | Semantic Coverage 14件、Project Runtime 60件がPass。Coordinator対象223件はSandbox内でPassし、Process取消2件は通常ユーザー境界で2／2 Passした | 固定候補化後にEvidenceを対象Commitへ結合する |

以前のArchitecture限定Sliceで示した`Covered 4／Partial 6／Missing 1`は、17 ARCH-IDだけを入力にした暫定対応であり、現在の157件Mappingに対する品質状態ではない。現在判定へ使用しない。

## 5. 旧検証設計から引き継ぐ未照合候補

旧`03_Verification_Design.md`が所有していた具体的なSource、TestおよびRuntime検証は、Quality Definitionの正本として扱わず、Reality Auditの未照合候補へ移す。移行前の内容はCommit `2135799e7691503e1474c8e94cec571093e55a15`の同Pathから再現できるため、本文を複製しない。

| 未照合候補 | 対応を確認するQuality Definition | Reality Auditで確認すること |
|---|---|---|
| 署名配布物、期限、Manifest昇格、Trust | QA-000010 | 現行Source／Test／Evidenceが署名対象、鍵境界、改変拒否、昇格後状態をどこまで証明するか |
| Checker、Windows native部品、Version Control | QA-000001／QA-000006／QA-000013 | 決定論的検査、OS境界、Repository境界、利用側閉包の実対応 |
| Tool結合block、Docker／CLI／Provider境界 | QA-000006／QA-000009 | 直接境界から関連2 blocks、System／E2Eまでの段階到達と全lifecycle |
| Project Runtime、取消、判断返却、回復 | QA-000003 | Taskの受付から終了後状態、exact Recovery、再入場までの実対応 |
| 実行記録の生成・保存・読取り | QA-000004／QA-000012 | 読取り責務と基準版Writer／Store能力を分け、削除・置換前のCapabilityを確認する |
| 推論コンテキストと工程引継ぎ | QA-000013 | 成果物の理解、判断理由、意味伝播および人間確認の現実対応 |

この表は試験設計や合格結果ではない。各候補をLocal Item単位で照合し、未実装、未実行、別版Evidence、意図した理由でのPassを区別する。

## 6. 基準版から引き継ぐ実行知の能力

v0.20.1の実行知はEvent生成、Repository-local Storeへの不変保存、並行Writerの競合処理、Repository Root確認、Project Runtimeからの記録および限定並列実行の評価を成立済み能力として持つ。これらは現在のread-onlyなCanonical実行知へ逆輸入せず、削除または置換判断の前に過去Evidenceと現行実装を照合する。

| 成立済み能力候補 | 現行照合先 | 現在判定 |
|---|---|---|
| 閉じたEvent生成と入力拒否 | execution-intelligenceの生成・検証試験 | 未照合 |
| 不変保存、再送冪等、衝突拒否 | Repository-local Store試験 | 未照合 |
| 並行Writer、Lock、一時file、失敗残存 | Storeの実Process／故障注入試験 | 未照合 |
| 検証済みRepository Rootへの保存 | Version Control境界とStore結合試験 | 未照合 |
| Project Runtimeからの記録と再読取り | Coordinator利用側結合試験 | 未照合 |
| 限定並列Attemptと統合結果の評価 | bounded integration試験 | 未照合 |

基準版の詳細根拠は[CHG-000062の検証結果](../99_Roadmap/Changes/CHG-000062/Evidence/260905_execution-intelligence-verification.md)から辿る。過去の合格をv0.21の合格へ流用せず、Capability、Owner、置換実装、利用側および必要な実境界検証を対応付ける。

## 7. 完了条件

- 全Local Itemが一つ以上のCanonical Source IDまたは横断Architecture成立条件へ接続されている。
- 各Local ItemがTest Catalogまたは人間確認へ接続され、未実装・未実行・未確認を区別できる。
- 自動試験は期待する理由、観測および終了後条件を確認する。
- 実境界を必要とする項目は段階的なITから必要なSTへ接続する。
- PT／LTは人間が対象、環境、上限、費用、中止およびcleanupを明示した場合だけ実行する。
- 現在の品質状態は本書の集計ではなく、Local Itemと最新EvidenceからQuality Centerへ投影する。

## 8. Coordinator／Project Runtime Pilot

照合開始の基準改訂版はCommit `3f2567bd54f00fe638bfc8ff9e7f3695fd8eba66`である。Canonical入力からSemantic Coverage Bundleを再生成し、開始時に古かったSource Hashを現在の入力へ揃えた。その後、現行Sourceと実試験を確認して不足していたSymbol Relationを是正した。Source実装を変更せず、生成BundleとRelationだけを現在の実体へ揃えている。

| 意味単位 | 実装Relation | Test Relation | 現在判定 |
|---|---|---|---|
| `coordinator.candidate-review-boundary` | observed | observed | `Covered Candidate`: 対応Source、Local ItemおよびRuntime契約試験を局所実行で確認 |
| `coordinator.cleanup-before-result` | observed | observed | `Covered Candidate`: Windows Process取消2条件を通常ユーザー境界で局所実行し、終了後不存在を確認 |
| `coordinator.external-boundary-diagnostics` | observed | observed | `Covered Candidate`: Native Trace契約試験を局所実行で確認 |
| `coordinator.objective-lifecycle` | observed | observed | `Covered Candidate`: Task Runtime契約試験を局所実行で確認 |
| `coordinator.provider-effect-authority` | observed | observed | `Covered Candidate`: Authority契約試験を局所実行で確認 |
| `coordinator.provider-selection-boundary` | observed | observed | `Covered Candidate`: Model Selection契約試験を局所実行で確認 |
| `coordinator.recovery-obligation` | observed | observed | `Covered Candidate`: Runtime契約試験とRecovery Matrix契約試験を局所実行で確認 |
| `coordinator.runtime-trust-consumption` | unobserved | unobserved | `Missing`: Trust候補の検証部品はあるが、Runtime Trust Policy activationとProvider launch結合が`not_implemented` |
| `project-runtime.acceptance-decision-authority` | observed | observed | `Covered Candidate`: 判断ApplicationとState契約試験を局所実行で確認 |
| `project-runtime.durable-before-effect` | observed | observed | `Covered Candidate`: Coordinator側のDurable Foundation実境界試験を局所実行で確認 |
| `project-runtime.execution-intelligence-read-model` | observed | observed | `Covered Candidate`: Execution Observation Port契約試験を局所実行で確認 |
| `project-runtime.objective-task-lifecycle` | observed | observed | `Covered Candidate`: Objective、State、Integrationの契約試験を局所実行で確認 |
| `project-runtime.project-state-projection` | observed | observed | `Covered Candidate`: State QueryとState契約試験を局所実行で確認 |
| `project-runtime.queue-lease-lifecycle` | observed | observed | `Covered Candidate`: State契約試験を局所実行で確認 |
| `project-runtime.recovery-obligation` | observed | observed | `Covered Candidate`: State、IntegrationおよびDurable Foundation契約試験を局所実行で確認 |
| `project-runtime.task-authority-narrowing` | observed | observed | `Covered Candidate`: Objective Intake契約試験を`PRL-05`へ接続し局所実行で確認 |
| `project-runtime.transport-neutral-application-contract` | observed | observed | `Covered Candidate`: Public Contract契約試験を局所実行で確認 |

`observed`はRelationの存在だけを示す。Source責務、反例、終了後条件、試験実行およびEvidenceが揃う前に`Covered`へ昇格しない。

### 8.1 初回判定とRelation是正

初回判定は`Covered 1／Partial 15／Missing 1`だった。15件の`Partial`の多くは試験不存在ではなく、実在試験とMeaning／Local Itemを結ぶTest Symbol Relation不足だった。Sourceと試験内容を確認してRelation Ownerへ追記した結果、16件は実装と試験の両Relationを持ち、残る未接続は`coordinator.runtime-trust-consumption`だけになった。

`coordinator.runtime-trust-consumption`だけは単なるRelation漏れではない。Trust候補のLoader、VerifierおよびPackage Trust Coreは存在するが、現行Source自身がRuntime Trust Policy activationとProvider launch integrationを`not_implemented`として公開している。したがって、署名検証部品の存在や署名済みE2E成功から、このMeaningの成立を推定しない。

### 8.2 局所実行結果

| 対象 | 結果 | 判定 |
|---|---:|---|
| Semantic Coverage | 14／14 Pass | Relation生成と完全一致契約は成立 |
| Project Runtime | 60／60 Pass | Pilotで接続したApplication／State／Portの局所契約は成立 |
| Coordinator対象7試験ファイル | 223／225 Pass | Sandbox内でProcess取消2条件だけ`provider_cancellation_grace_exceeded` |
| Windows Process取消2条件の通常ユーザー境界再実行 | 2／2 Pass | 子Process終了と終了後不存在を確認 |

Sandbox内ではProcess列挙が`Access denied`となり、取消試験も子Process終了を猶予内に観測できなかった。同じ2条件を通常ユーザー境界で再実行すると2／2 Passしたため、製品回帰ではなく実行環境の不一致として分類する。Process／OS境界の成立は、必要な権限を持つ本番同等境界で確認し、Sandbox内の失敗も消さずに実行条件とともに残す。

## Checklist

- [x] Canonical Quality設計の固定後にだけReality Auditを開始した
- [x] 基準版Capabilityと過去Evidenceを比較入力として特定した
- [x] 現行Source、TestおよびRegistryをCanonical設計の正解として扱っていない
- [x] 必要な検証をCovered、Partial、Missing、LegacyまたはGapへ分類した
- OPEN: Pilot後に展開 — 未Commit状態とVersion Control Adapterの交換可能性を検証対象へ含めた
- [x] 照合対象のRevision、実行条件および観測限界を固定した
- [x] 不足Test、未実行項目およびEvidence Gapを追跡した
- [x] PT／LTは人間の明示指定がある場合だけ実行した
