# CRDD検証設計

状態: v0.21.0 Canonical
担当責任者: Qual-Lab
最終更新日: 2026-09-19

## 1. 本書の責務

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

REQ 36、UX 32、IA 22、UI 20、SPEC 29、ARCH 18の計157 Canonical IDを正式入力とする。工程別Analysisが全IDを処置し、Quality Integrationが13のQuality Contractへ統合する。

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

- 157 Canonical IDが工程別Analysisで全数処置されている。
- Source固有条件がQuality IntegrationからQuality DefinitionのLocal Itemまで追跡できる。
- すべてのQuality DefinitionがUT／IT／ST／UATとRT／PT／LTの適用を判断している。
- 外部境界を含むLocal Itemが段階的な到達範囲、観測および終了後条件を持つ。
- 現行Source、Test、RegistryおよびEvidenceの対応は、本書ではなくReality Auditで照合される。
- 実行結果と残る未確認範囲がQuality Centerへ投影される。

## 8. 現在の未評価範囲

Canonical Quality設計と現行Source／Test／Evidenceの対応は未照合である。過去の検証設計に含まれていた個別Runtime、Tool、署名、Docker、Project Runtime、実行知および推論コンテキストの具体項目は、[現行実装との照合](05_Current_Implementation_Reality_Audit.md)で未照合候補として扱う。既存実装や過去の試験を新しいQuality Contractの根拠へ逆輸入しない。

## 9. 旧参照からの案内

過去のChangeや固定Evidenceが参照していたAnchorは、現在の正本へ進む案内だけを保持する。ここへ旧検証設計本文を戻さない。

<a id="tool-user-experience-verification"></a>

- Toolの利用体験と工程引継ぎ: [QA-000013](Definitions/QA-000013/quality_definition.md)

<a id="project-runtime-verification"></a>

- Project Runtime lifecycle: [QA-000003](Definitions/QA-000003/quality_definition.md)

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
