# UI-000011 実行時データの保持・清掃

成果物種別: UI定義
UI ID: `UI-000011`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

必要な状態だけを保持し、不要になったデータを安全に清掃できる。

## UX観点の入力

| UX分析 | このUIで保持する利用者成果 |
|---|---|
| [UX-000017](../../Analysis/UX-000017/ui_analysis.md) | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる |
| [UX-000022](../../Analysis/UX-000022/ui_analysis.md) | 失敗後に残存の由来・影響・再入場先を理解し、必要な回復を行って不存在まで確認できる |

## IA観点の入力

| IA分析 | このUIで保持する情報構造 |
|---|---|
| [IA-000012](../../Analysis/IA-000012/ui_analysis.md) | 保存場所の内部構造を推測せず、保持すべき状態、一時物、回復義務を安全に扱う。 |
| [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 失敗後に再接続、再試行、回復、清掃を取り違えず、二重作用を避ける。 |

## 両観点の統合判断

| UX分析 | 利用者が得たい結果 | 対応するIA分析 | UIで成立させる対応 |
|---|---|---|---|
| [UX-000017](../../Analysis/UX-000017/ui_analysis.md) | 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる | [IA-000012](../../Analysis/IA-000012/ui_analysis.md) | 実行データの基点（Runtime Root）、実行データ（Data Item）、目的（Purpose）、責任者（Owner）、永続性（Durability）、保持条件（Retention）、Cleanupを見分ける。状態は「一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown）」。導線は「作業→データ用途→保持判断→清掃→不存在確認」 |
| [UX-000022](../../Analysis/UX-000022/ui_analysis.md) | 必要な根拠を残し不要物を安全に片付けられる | [IA-000012](../../Analysis/IA-000012/ui_analysis.md) | 残存物（Residue）、回復対象の識別子（Recovery Identity）、作用状態（Effect State）、処置（Disposition）、清掃根拠（Cleanup Evidence）を見分ける。状態は「存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）」。導線は「停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認」 |
| [UX-000022](../../Analysis/UX-000022/ui_analysis.md) | 必要な根拠を残し不要物を安全に片付けられる | [IA-000003](../../Analysis/IA-000003/ui_analysis.md) | 残存物（Residue）、回復対象の識別子（Recovery Identity）、作用状態（Effect State）、回復義務（Recovery Obligation）、回復処置（Recovery Action）、処置（Disposition）、清掃根拠（Cleanup Evidence）を見分ける。状態は「存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible）」。導線は「停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消」 |

UIはUX側の目的だけでも、IA側の対象一覧だけでも成立しない。各行の利用者成果を、対応する情報・状態・関係・導線で判断可能にした時だけ、このUIの意味が成立する。

## 表示面と情報の優先順位

```text
実行時データの保持・清掃
        ↓
実行データの基点（Runtime Root）／実行データ（Data Item）／永続性（Durability）／保持条件（Retention）／回復義務（Recovery Obligation）／清掃根拠（Cleanup Evidence）／依頼（Request）／試行（Attempt）／外部作用（Effect）／結果（Result）／回復処置（Recovery Action）／終了確認（Settlement Observation）／次の行動（Next Action）
        ↓
現在状態・不足・制限
        ↓
作業→データ用途→保持判断→清掃→不存在確認／停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認／停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消
```

| IA分析 | 独立して見分ける対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|---|
| IA-000012 | 実行データの基点（Runtime Root） | 実行時データの管理基点 | 検証済みRoot |
| IA-000012 | 実行データ（Data Item） | 用途を持つ実行時情報 | 責任者（Owner）＋目的（Purpose）＋識別子（Identity） |
| IA-000012 | 永続性（Durability） | 再起動後も必要か | 一時（temporary）／保持必要（durable） |
| IA-000012 | 保持条件（Retention） | 保持する条件と上限 | 実行データ（Data Item）へ結合 |
| IA-000012 | 回復義務（Recovery Obligation） | 回復に必要な耐久情報 | 同一の識別子（Identity） |
| IA-000012 | 清掃根拠（Cleanup Evidence） | 終了後の不存在根拠 | 対象と観測へ結合 |
| IA-000003 | 依頼（Request） | 利用者の同一依頼 | 依頼識別子（Request Identity） |
| IA-000003 | 試行（Attempt） | 依頼を実行した個別試行 | 依頼（Request）に属する試行識別子（Attempt ID） |
| IA-000003 | 外部作用（Effect） | 外部へ生じ得る変更 | 試行（Attempt）と作用識別子（Effect Identity） |
| IA-000003 | 結果（Result） | 試行または依頼の結果 | 依頼（Request）／試行（Attempt）へ結合 |
| IA-000003 | 回復義務（Recovery Obligation） | 残存を処置し、終了後を確認するまで残る義務 | 同一の回復対象識別子（Recovery Identity） |
| IA-000003 | 回復処置（Recovery Action） | 回復義務を解消するために実行する行動 | 回復義務と処置の試行へ結合 |
| IA-000003 | 終了確認（Settlement Observation） | 回復後に残存や作用が解消したことの確認 | 回復義務と観測時点へ結合 |
| IA-000003 | 次の行動（Next Action） | 現在許される行動 | 状態と権限（Authority）から導く |

同じ画面や応答へ置く場合も、上表の独立軸を一つの成功・信頼・完了へ畳まない。重要な不足、制限、判断要否は詳細へ隠さない。

## 操作とFeedback

主要な操作・判断: 保持内容を見る／清掃する／保留する。

| UX分析 | 利用者が行う判断・行動 | 重要な場面 | 必要なFeedback | 避ける失敗 |
|---|---|---|---|---|
| UX-000017 | 実行時データの所有場所と一連の状態変化を理解する | 永続化または削除の直前 | 用途別領域とcleanup条件を明示する | subdirectoryや別基点フォルダへ同名データを作る |
| UX-000022 | 残存資源の由来・保持・清掃・回復を理解する | 削除または回復を選ぶ場面 | 残存・観測不能・不存在を区別する | 名前や経過時間だけで由来不明物を削除する |

UI部品や通信方式はここで固定しない。各UX行のFeedbackを、IAの状態・導線と対応付けて表示する。

## 状態と表示差

| UX／IAの対応 | 区別する状態 | 状態から進む導線 |
|---|---|---|
| UX-000017／IA-000012 | 一時（temporary）／保持必要（durable）／回復必要（recovery_required）／清掃可能（eligible_for_cleanup）／不明（unknown） | 作業→データ用途→保持判断→清掃→不存在確認 |
| UX-000022／IA-000012 | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復・清掃→不存在確認 |
| UX-000022／IA-000003 | 存在（present）／不存在（absent）／不明（unknown）、回復可能（recoverable）／清掃可能（cleanup_eligible） | 停止→残存観測→同一の回復対象識別子→回復処置・清掃→不存在確認→義務解消 |

上表にない処理中、取消、回復その他の状態を一律に追加しない。値なし、未観測、古い値、競合、開示制限または結果不明は、該当するIA定義が要求する場合にだけ別状態として示す。

## 視覚表現とアクセシビリティ

- 「実行データの基点（Runtime Root）、実行データ（Data Item）、永続性（Durability）、保持条件（Retention）、回復義務（Recovery Obligation）、清掃根拠（Cleanup Evidence）、依頼（Request）、試行（Attempt）、外部作用（Effect）、結果（Result）、回復処置（Recovery Action）、終了確認（Settlement Observation）、次の行動（Next Action）」を、色だけでなく表示名、状態語、順序でも見分けられるようにする。
- 結論、重大な不足、主要操作、根拠、詳細の順を視覚順と読上げ順で一致させる。
- CLI、MCP、Workbenchで同じ意味の状態と次の導線を対応付ける。
- キーボード操作と文字表示だけでも、上表の判断・根拠・戻り先へ到達できるようにする。

## 制約

- UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。
- 表示の都合でUX成果、IAの独立軸、状態、根拠、対象範囲または開示境界を弱めない。
- 視覚詳細はPrototypeで評価し、未評価の候補を完成表示しない。

## UI／SPEC対応レビューへ渡す項目

両観点の統合内容は前節の正本を参照し、ここへ全文を再掲しない。次表は、SPECが同じUX／IAを別々に分析した後で確定すべき未決事項だけを渡す。

| UX | IA | UIで観測可能にすべき操作・Feedback | SPEC側で未確定の振る舞い |
|---|---|---|---|
| UX-000017 | IA-000012 | 実行時データの所有場所と一連の状態変化を理解する。用途別領域とcleanup条件を明示する | IA-000012 が示す状態・関係を入力条件、成功・停止条件へ接続し、「subdirectoryや別基点フォルダへ同名データを作る」を防ぐ観測可能な結果を確定する |
| UX-000022 | IA-000012 | 残存資源の由来・保持・清掃・回復を理解する。残存・観測不能・不存在を区別する | IA-000012 が示す状態・関係を入力条件、成功・停止条件へ接続し、「名前や経過時間だけで由来不明物を削除する」を防ぐ観測可能な結果を確定する |
| UX-000022 | IA-000003 | 残存資源の由来・保持・清掃・回復を理解する。残存・観測不能・不存在を区別する | IA-000003 が示す状態・関係を入力条件、成功・停止条件へ接続し、「名前や経過時間だけで由来不明物を削除する」を防ぐ観測可能な結果を確定する |

SPECはこの表の結論を転記せず、UX観点とIA観点を別々に分析する。UIの操作に対応する発火条件・結果がない、またはSPECの結果を利用者が認識できない場合は対応レビューを通過しない。

## 情報源

- [UX-000017のUI分析](../../Analysis/UX-000017/ui_analysis.md)
- [UX-000022のUI分析](../../Analysis/UX-000022/ui_analysis.md)
- [IA-000012のUI分析](../../Analysis/IA-000012/ui_analysis.md)
- [IA-000003のUI分析](../../Analysis/IA-000003/ui_analysis.md)
