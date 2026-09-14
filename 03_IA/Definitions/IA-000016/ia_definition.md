# IA-000016 変更・指摘・是正・試験・品質

成果物種別: IA定義
IA ID: `IA-000016`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

作業の意図、変更対象、指摘、是正、検証、現在品質を一つの改訂版で辿る。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000023](../../Analysis/UX-000023/ia_analysis.md) | CRDD作成者・保守者／複数指摘を是正する時 | 改訂版（Revision）、指摘（Finding）、是正（Remediation）、Verification、判断依頼（Decision Request）、監査の組合せ（Audit Set） | 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required） | 固定版→監査集合→統合方針→是正→再固定→判断 |
| [UX-000026](../../Analysis/UX-000026/ia_analysis.md) | CRDD作成者・保守者／変更の検証計画を作る時 | 試験層（Test Layer）、確認対象範囲（Target Scope）、一連の開始から終了までの根拠（Lifecycle Evidence）、実行状態（Execution State）、実行権限（Authority）、対象範囲（Coverage） | 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable） | 変更→不確実性→試験層→実行結果→現在保証 |
| [UX-000029](../../Analysis/UX-000029/ia_analysis.md) | CRDD作成者・保守者／変更の現在地や根拠を調べる時 | Work、変更（Change）、変更ファイル（Changed File）、検証根拠（Evidence）、Observed 改訂版（Revision）、品質状態（Quality State） | 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする | Roadmap→Change→対象ファイル→Evidence→Quality→Release |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| ロードマップ項目（Roadmap Item） | 未完了の仕事 | Item ID |
| 変更（Change） | 採用した変更意図 | CHG ID |
| 変更ファイル（Changed File） | 変更が入ったファイル | Repository-relative Path |
| 改訂版（Revision） | 確認対象の固定版 | 改訂版の識別子（Revision Identity） |
| 指摘（Finding） | レビュー・監査の指摘 | 指摘の識別子（Finding Identity） |
| 是正（Remediation） | 指摘への構造是正 | ChangeとFindingへ結合 |
| 試験層（Test Layer） | 確認の粒度 | UT／IT／ST／UAT／RT／PT-LT |
| 検証根拠（Evidence） | 実行条件と観測結果 | 改訂版（Revision）へ結合 |
| 品質状態（Quality State） | 現在の保証状態 | ScopeとEvidenceから評価 |

```text
[O: ロードマップ項目（Roadmap Item）] --実現される--> [O: 変更（Change）]
[O: 変更（Change）] --影響する--> [O: 変更ファイル（Changed File）]
[O: 改訂版（Revision）] --レビューで生む--> [O: 指摘（Finding）]
[O: 指摘（Finding）] --是正される--> [O: 是正（Remediation）]
[O: 是正（Remediation）] --検証される--> [O: 検証根拠（Evidence）]
[O: 検証根拠（Evidence）] --支える--> [O: 品質状態（Quality State）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000023`: 固定済み（fixed）／レビュー中（under_review）／是正必要（changes_required）／確認済み（verified）／判断必要（decision_required）
- `UX-000026`: 計画済み（planned）／未実行（not_executed）／合格（passed）／失敗（failed）／停止（blocked）／非該当（not_applicable）
- `UX-000029`: 計画済み（planned）／進行中（in_progress）／確認済み（verified）／公開済み（released）と品質状態を別にする

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- CRDD作成者・保守者: 複数指摘を是正する時に「監査合意から是正・反証までを一つの改訂版で閉じる」ために必要な判断を行う。システムは「一部是正や監査回数を完成と誤認する」を避けられるよう、合意事項と試験を全数対応させる。
- CRDD作成者・保守者: 変更の検証計画を作る時に「試験層ごとの保証と未確認範囲を理解する」ために必要な判断を行う。システムは「単発成功や試験件数から一連の状態変化全体を保証する」を避けられるよう、開始から清掃まで段階的に反証する。
- CRDD作成者・保守者: 変更の現在地や根拠を調べる時に「作業・変更・根拠・品質を役割別に辿る」ために必要な判断を行う。システムは「同じ説明を複製し代表ファイルだけで済ませる」を避けられるよう、正本を分け全影響ファイルを列挙する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

QualityはVerification Designと状態評価を、CHGは変更意図と影響ファイルを、Gitは差分履歴を所有する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000023のIA分析](../../Analysis/UX-000023/ia_analysis.md)
- [UX-000026のIA分析](../../Analysis/UX-000026/ia_analysis.md)
- [UX-000029のIA分析](../../Analysis/UX-000029/ia_analysis.md)
