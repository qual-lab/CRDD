# IA-000006 Project・Repository・Binding・読取り投影（Projection）

成果物種別: IA定義
IA ID: `IA-000006`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

論理Projectを一つに見ながら、情報源、物理Root、不完全性を取り違えず現在地を判断する。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000009](../../Analysis/UX-000009/ia_analysis.md) | プロジェクト運営者／PM／プロジェクト状況を確認する時 | プロジェクト（Project）、プロジェクト項目、読取り投影（Projection）、情報源（Source）、改訂版（Revision）、観測時点（Observed At）、対象範囲（Coverage）、競合 | complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown） | プロジェクト→現在投影→不足・競合→情報源→次の判断 |
| [UX-000011](../../Analysis/UX-000011/ia_analysis.md) | プロジェクト運営者／PM／参照または操作対象を選ぶ時 | プロジェクト（Project）、リポジトリ（Repository）、リポジトリの基点フォルダ（Repository Root）、結合情報（Binding） | 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable） | Project→Repository→Binding→検証済みRoot |
| [UX-000015](../../Analysis/UX-000015/ia_analysis.md) | 経営・管理層／複数プロジェクトの一覧の優先度を判断する時 | プロジェクト概要（Project Summary）、比較軸、対象範囲（Coverage）、観測時点（Observed At）、公開関係（Exposure）、情報源（Source） | complete／partial／開示制限（restricted）／stale／競合あり（conflicting） | Portfolio→差→対象範囲（Coverage）→Project→情報源（Source） |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| プロジェクト（Project） | 論理的な案件・活動 | プロジェクト識別子（Project ID） |
| リポジトリ（Repository） | Projectの一部を所有する正本境界 | リポジトリ識別子（Repository ID） |
| 結合情報（Binding） | Repositoryと検証済みRootの結合 | 結合識別子（Binding ID） |
| プロジェクト項目 | リポジトリが正本として所有する文書その他の項目 | リポジトリと項目固有の識別情報で結ぶ |
| 読取り投影（Projection） | 正本から導出した読取りView | 情報源（Source）＋改訂版（Revision）＋観測時点（Observed At） |
| 対象範囲（Coverage） | 投影が扱えた範囲 | 情報源（Source）集合と状態 |

```text
[O: プロジェクト（Project）] --構成される--> [O: リポジトリ（Repository）]
[O: リポジトリ（Repository）] --結合される--> [O: 結合情報（Binding）]
[O: リポジトリ（Repository）] --所有する--> [O: プロジェクト項目]
[O: プロジェクト項目] --投影される--> [O: 読取り投影（Projection）]
[O: 読取り投影（Projection）] --宣言する--> [O: 対象範囲（Coverage）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000009`: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）／不明（unknown）
- `UX-000011`: 確認済み（verified）／未確認（unverified）／曖昧（ambiguous）／利用不能（unavailable）
- `UX-000015`: complete／partial／開示制限（restricted）／stale／競合あり（conflicting）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- プロジェクト運営者／PM: プロジェクト状況を確認する時に「プロジェクトの現在地を根拠と不完全性付きで理解する」ために必要な判断を行う。システムは「欠測や古い値を完全な現在値と誤認する」を避けられるよう、根拠、不完全性、観測時点を同時に示す。
- プロジェクト運営者／PM: 参照または操作対象を選ぶ時に「プロジェクト・リポジトリ・基点フォルダを区別して対象を確認する」ために必要な判断を行う。システムは「同名や近いパスを同じ対象と誤認する」を避けられるよう、各識別情報と物理基点フォルダの結合を明示する。
- 経営・管理層: 複数プロジェクトの一覧の優先度を判断する時に「複数プロジェクトを根拠付きで比較する」ために必要な判断を行う。システムは「単一Scoreや欠測した集計で健全性を断定する」を避けられるよう、比較値から根拠・古さ・不足へ戻れる。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

UIは不完全性と根拠を同時に理解可能にし、SPECは競合・欠測・鮮度を、ArchitectureはBinding検証を定める。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000009のIA分析](../../Analysis/UX-000009/ia_analysis.md)
- [UX-000011のIA分析](../../Analysis/UX-000011/ia_analysis.md)
- [UX-000015のIA分析](../../Analysis/UX-000015/ia_analysis.md)
