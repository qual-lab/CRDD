# IA-000003 実行・失敗・外部作用・回復

成果物種別: IA定義
IA ID: `IA-000003`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000003](../../Analysis/UX-000003/ia_analysis.md) | プロジェクト運営者／PM／委任した仕事の応答を待つ時 | 作業（Task）、実行主体、現在状態、判断、入力、次の行動 | 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed） | Task→現在状態→判断要否→待機・入力・取消・回復 |
| [UX-000004](../../Analysis/UX-000004/ia_analysis.md) | プロジェクト運営者／PM／失敗・取消・切断後に仕事を続ける時 | 失敗、試行（Attempt）、外部作用、結果、残存、回復処置（Recovery Action）、再試行 | 失敗後の作用なし／作用済み／不明、回復要／不要 | 失敗→作用状態→同じ依頼の結果→回復処置または再試行 |
| [UX-000021](../../Analysis/UX-000021/ia_analysis.md) | プロジェクト運営者／PM／応答喪失後に再接続する時 | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation） | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| [UX-000022](../../Analysis/UX-000022/ia_analysis.md) | 実行環境の導入・運用者／失敗後または保守時に残存を見つけた時 | 残存物（Residue）、回復対象の識別子（Recovery Identity）、作用状態（Effect State）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、処置（Disposition）、清掃根拠（Cleanup Evidence） | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 依頼（Request） | 利用者の同一依頼 | 依頼識別子（Request Identity） |
| 試行（Attempt） | 依頼を実行した個別試行 | 依頼（Request）に属する試行識別子（Attempt ID） |
| 外部作用（Effect） | 外部へ生じ得る変更 | 試行（Attempt）と作用識別子（Effect Identity） |
| 結果（Result） | 試行または依頼の結果 | 依頼（Request）／試行（Attempt）へ結合 |
| 回復義務（Recovery Obligation） | 残存を処置し、終了後を確認するまで残る義務 | 同一の回復対象識別子（Recovery Identity） |
| 回復処置（Recovery Action） | 回復義務を解消するために実行する行動 | 回復義務と処置の試行へ結合 |
| 終了確認（Settlement Observation） | 回復後に残存や作用が解消したことの確認 | 回復義務と観測時点へ結合 |
| 次の行動（Next Action） | 現在許される行動 | 状態と権限（Authority）から導く |

```text
[O: 依頼（Request）] --含む--> [O: 試行（Attempt）]
[O: 試行（Attempt）] --発生させる場合がある--> [O: 外部作用（Effect）]
[O: 試行（Attempt）] --生む--> [O: 結果（Result）]
[O: 外部作用（Effect）] --発生させる場合がある--> [O: 回復義務（Recovery Obligation）]
[O: 残存物（Residue）] --根拠になる--> [O: 回復義務（Recovery Obligation）]
[O: 次の行動（Next Action）] --選ぶ場合がある--> [O: 回復処置（Recovery Action）]
[O: 回復処置（Recovery Action）] --処置する--> [O: 回復義務（Recovery Obligation）]
[O: 終了確認（Settlement Observation）] --解消を確定する--> [O: 回復義務（Recovery Obligation）]
[O: 結果（Result）] --利用を許す--> [O: 次の行動（Next Action）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000003`: 開始可能（ready）／実行中（running）／入力・判断待ち（waiting）／停止（blocked）／完了（completed）／失敗（failed）
- `UX-000004`: 失敗後の作用なし／作用済み／不明、回復要／不要
- `UX-000021`: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）
- `UX-000022`: 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）

回復に関する状態は、次の四つを同一視しない。

```text
[S: 義務あり・未処置]
        │ --回復処置を開始-->
        ▼
[S: 処置中]
        │ --処置が終了-->
        ▼
[S: 処置済み・終了後未確認]
        │ --不存在または安全な終了を確認-->
        ▼
[S: 義務解消]
```

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- プロジェクト運営者／PM: 委任した仕事の応答を待つ時に「現在の実行状態と必要な判断を確認する」ために必要な判断を行う。システムは「古い観測や一律表示を進捗・完了と誤認する」を避けられるよう、観測時点・停止理由・必要な判断を行動可能に示す。
- プロジェクト運営者／PM: 失敗・取消・切断後に仕事を続ける時に「再試行・回復・清掃の違いを理解する」ために必要な判断を行う。システムは「結果不明の処理を新規実行して外部作用（Effect）の二重実行を起こす」を避けられるよう、外部作用（Effect）状態・回復対象の識別情報・終了条件を示す。
- プロジェクト運営者／PM: 応答喪失後に再接続する時に「切断後に同じ依頼へ戻る」ために必要な判断を行う。システムは「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を避けられるよう、同一識別情報の照会を再実行より先に示す。
- 実行環境の導入・運用者: 失敗後または保守時に残存を見つけた時に「残存資源の由来・保持・清掃・回復を理解する」ために必要な判断を行う。システムは「名前や経過時間だけで由来不明物を削除する」を避けられるよう、残存・観測不能・不存在を区別する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

SPECとArchitectureは回復義務の発生、回復処置、終了後確認、義務解消を分けた一連の状態変化と冪等再取得を、Verificationは切断・取消・残存を含む実境界を具体化する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000003のIA分析](../../Analysis/UX-000003/ia_analysis.md)
- [UX-000004のIA分析](../../Analysis/UX-000004/ia_analysis.md)
- [UX-000021のIA分析](../../Analysis/UX-000021/ia_analysis.md)
- [UX-000022のIA分析](../../Analysis/UX-000022/ia_analysis.md)
