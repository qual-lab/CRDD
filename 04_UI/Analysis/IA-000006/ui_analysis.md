# IA-000006のUI分析

成果物種別: UI分析（IA観点）
分析単位: `IA-000006`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000006 Project・Repository・Binding・読取り投影（Projection）](../../../03_IA/Definitions/IA-000006/ia_definition.md)

UXやREQを直接読んで不足を補完しない。この分析はIA定義から情報設計観点だけを導き、利用者成果と操作体験はUX観点の分析に委ねる。

## 2. UIへ引き継ぐ情報構造

論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| プロジェクト（Project） | 論理的な案件・活動 | プロジェクト識別子（Project ID） |
| リポジトリ（Repository） | Projectの一部を所有する正本境界 | リポジトリ識別子（Repository ID） |
| 結合情報（Binding） | Repositoryと検証済みRootの結合 | 結合識別子（Binding ID） |
| プロジェクト項目 | リポジトリが正本として所有する文書その他の項目 | リポジトリと項目固有の識別情報で結ぶ |
| 読取り投影（Projection） | 正本から導出した読取りView | 情報源（Source）＋改訂版（Revision）＋観測時点（Observed At） |
| 対象範囲（Coverage） | 投影が扱えた範囲 | 情報源（Source）集合と状態 |

UIでは「プロジェクト（Project）、リポジトリ（Repository）、結合情報（Binding）、プロジェクト項目、読取り投影（Projection）、対象範囲（Coverage）」の識別と関係を維持する。同名・近似値、未観測・不存在、現在値・古い値を表示都合でまとめない。

## 3. 表示の優先順位とNavigation

| 利用場面 | 最初に見分ける対象 | 区別する状態 | 次の導線 |
|---|---|---|---|
| `UX-000009`／プロジェクト運営者／PM／プロジェクト状況を確認する時 | プロジェクト（Project）、プロジェクト項目、読取り投影（Projection）、情報源（Source）、改訂版（Revision）、観測時点（Observed At）、対象範囲（Coverage）、競合 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown） | プロジェクト→現在投影→不足・競合→情報源→次の判断 |
| `UX-000011`／プロジェクト運営者／PM／参照または操作対象を選ぶ時 | プロジェクト（Project）、リポジトリ（Repository）、リポジトリの基点フォルダ（Repository Root）、結合情報（Binding） | 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） | Project→Repository→Binding→検証済みRoot |
| `UX-000015`／経営・管理層／複数プロジェクトの一覧の優先度を判断する時 | プロジェクト概要（Project Summary）、比較軸、対象範囲（Coverage）、観測時点（Observed At）、公開関係（Exposure）、情報源（Source） | complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） |

```text
Project・Repository・Binding・読取り投影（Projection）
        ↓
対象と現在状態
        ↓
不足・制限・競合
        ↓
関係・根拠
        ↓
判断／回復／次の対象
```

内部ID、生Log、実装詳細は最初の結論へ混在させず、根拠を掘り下げる段階で示す。

## 4. 表示差と開示境界

IA定義が要求する状態区分:

- `UX-000009`: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）
- `UX-000011`: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）
- `UX-000015`: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）

IA定義が要求する導線と責任:

- プロジェクト運営者／PM: プロジェクト状況を確認する時に「プロジェクトの現在地を根拠と不完全性付きで理解する」ために必要な判断を行う。システムは「欠測や古い値を完全な現在値と誤認する」を避けられるよう、根拠、不完全性、観測時点を同時に示す。
- プロジェクト運営者／PM: 参照または操作対象を選ぶ時に「プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する」ために必要な判断を行う。システムは「同名や近いパスを同じ対象と誤認する」を避けられるよう、各識別情報と物理基点フォルダの結合を明示する。
- 経営・管理層: 複数プロジェクトの一覧の優先度を判断する時に「複数プロジェクトを根拠付きで比較する」ために必要な判断を行う。システムは「単一Scoreや欠測した集計で健全性を断定する」を避けられるよう、比較値から根拠・古さ・不足へ戻れる。

値なし、未観測、古い値、競合、部分取得、開示制限および結果不明は、それぞれ利用者の次の判断が異なる場合に別の表示状態として扱う。開示できない対象は、その存在自体を示せるかも決定権限に従う。

## 5. UI処置

| UI候補 | 処置 | 保持する情報・状態・導線 | 判断理由 |
|---|---|---|---|
| [UI-000004 Project・節目・Portfolioの状況把握](../../Definitions/UI-000004/ui_definition.md) | New | Project・Repository・Binding・読取り投影 | この情報構造を利用者が判断できる表示へ変換する |
| [UI-000006 Repository内作業と対象選択](../../Definitions/UI-000006/ui_definition.md) | Same | Project・Repository・Binding・読取り投影 | 同じ情報構造を別の利用場面でも使う |

## 6. UX観点との統合時に確認すること

UX観点の分析が求める利用者成果、重要場面、操作およびFeedbackに対し、「Project・Repository・Binding・読取り投影（Projection）」の対象・状態・関係・導線が過不足なく判断材料を提供するかをUI定義で確認する。IAからUIへ引き渡す固有の意図は「UIは不完全性と根拠を同時に理解可能にし、SPECは競合・欠測・鮮度を、ArchitectureはBinding検証を定める。」であり、利用者の目的をここで推測して先取りしない。
