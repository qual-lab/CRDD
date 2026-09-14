# IA-000012 実行時データ・保持・清掃

成果物種別: IA定義
IA ID: `IA-000012`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000017](../../Analysis/UX-000017/ia_analysis.md) | 実行環境の導入・運用者／実行時データを作成または清掃する時 | 実行データの基点（Runtime Root）、実行データ（Data Item）、目的（Purpose）、責任者（Owner）、永続性（Durability）、保持条件（Retention）、Cleanup | 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown） | 作業→データ用途→保持判断→清掃→不存在確認 |
| [UX-000022](../../Analysis/UX-000022/ia_analysis.md) | 実行環境の導入・運用者／失敗後または保守時に残存を見つけた時 | 残存物（Residue）、回復対象の識別子（Recovery Identity）、作用状態（Effect State）、処置（Disposition）、清掃根拠（Cleanup Evidence） | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 実行データの基点（Runtime Root） | 実行時データの管理基点 | 検証済みRoot |
| 実行データ（Data Item） | 用途を持つ実行時情報 | 責任者（Owner）＋目的（Purpose）＋識別子（Identity） |
| 永続性（Durability） | 再起動後も必要か | 一時（temporary）／保持必要（durable） |
| 保持条件（Retention） | 保持する条件と上限 | 実行データ（Data Item）へ結合 |
| 回復義務（Recovery Obligation） | 回復に必要な耐久情報 | 同一の識別子（Identity） |
| 清掃根拠（Cleanup Evidence） | 終了後の不存在根拠 | 対象と観測へ結合 |

```text
[O: 実行データの基点（Runtime Root）] --含む--> [O: 実行データ（Data Item）]
[O: 実行データ（Data Item）] --持つ--> [O: Durability]
[O: 実行データ（Data Item）] --管理される--> [O: Retention]
[O: 実行データ（Data Item）] --支える場合がある--> [O: 回復義務（Recovery Obligation）]
[O: 実行データ（Data Item）] --完了根拠を持つ--> [O: 清掃根拠（Cleanup Evidence）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000017`: 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）
- `UX-000022`: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- 実行環境の導入・運用者: 実行時データを作成または清掃する時に「実行時データの所有場所と一連の状態変化を理解する」ために必要な判断を行う。システムは「subdirectoryや別基点フォルダへ同名データを作る」を避けられるよう、用途別領域とcleanup条件を明示する。
- 実行環境の導入・運用者: 失敗後または保守時に残存を見つけた時に「残存資源の由来・保持・清掃・回復を理解する」ために必要な判断を行う。システムは「名前や経過時間だけで由来不明物を削除する」を避けられるよう、残存・観測不能・不存在を区別する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

ArchitectureはPathと排他を、Maintenanceは保持上限を、VerificationはLifecycle全体と清掃後状態を確認する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000017のIA分析](../../Analysis/UX-000017/ia_analysis.md)
- [UX-000022のIA分析](../../Analysis/UX-000022/ia_analysis.md)
