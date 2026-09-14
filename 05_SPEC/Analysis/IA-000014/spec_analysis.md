# IA-000014のSPEC分析

成果物種別: SPEC分析（IA観点）
分析単位: `IA-000014`
状態: 分析済み

## 1. 正式入力

- IA定義: [IA-000014 受け渡す情報・Task・結果・帰還](../../../03_IA/Definitions/IA-000014/ia_definition.md)

UX、UIまたはREQを直接読んで不足を補完しない。この分析はIA定義から、振る舞いが区別すべき情報、状態、関係、可視性、導線、責任を導く。

## 2. 利用場面ごとに保持する意味

必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000019](../../../03_IA/Analysis/UX-000019/ia_analysis.md) | 外部へ渡す情報の所有者／別Agentやツールへ仕事を渡す時、または結果を受け取る時 | 仕事用情報一式（Context Package）、情報源（Source）、改訂版（Revision）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision） | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| [UX-000021](../../../03_IA/Analysis/UX-000021/ia_analysis.md) | プロジェクト運営者／PM／応答喪失後に再接続する時 | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation） | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| [UX-000024](../../../03_IA/Analysis/UX-000024/ia_analysis.md) | 外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

各入力UXの対象、状態、導線を共有語だけへ丸めず、行ごとにSPEC処置へ引き継ぐ。

## 3. 対象・識別・関係

| 対象 | 利用者にとっての意味 | 識別・関係 |
|---|---|---|
| 仕事用情報一式（Context Package） | 選択した仕事用情報一式 | 情報一式の識別子（Package ID） |
| 情報源参照（Source Reference） | 出所と改訂版（Revision） | 情報源の識別子（Source Identity）＋改訂版（Revision） |
| 選択理由（Selection Reason） | 含めた理由 | Package Itemへ結合 |
| 作業（Task） | 受け渡し先の仕事 | 作業識別子（Task Identity） |
| 引き渡し（Handoff） | 役割間の移送 | 情報源（Source）／Target Role |
| 結果（Result） | Taskから戻る成果と状態 | Taskへ結合 |
| 判断（Decision） | 結果とともに元の仕事へ戻す判断・未解決事項 | 責任者（Owner）と決定権限（Decision Authority）へ結ぶ |

```text
[O: 情報源参照（Source Reference）] --選択される--> [O: 仕事用情報一式（Context Package）]
[O: 仕事用情報一式（Context Package）] --支える--> [O: 作業（Task）]
[O: 引き渡し（Handoff）] --引き渡す--> [O: 仕事用情報一式（Context Package）]
[O: 作業（Task）] --生む--> [O: 結果（Result）]
[O: 結果（Result）] --判断・未解決事項と返す--> [O: 判断（Decision）]
```

上表は複数の入力UXを横断して利用する中心対象を示す。入力固有の対象は「利用場面」の対応表にも保持し、中心対象へ統合できない意味を欠落として扱う。

対象、識別、関係の全行を処置し、名前やPathから識別情報を推測して再構成しない。

## 4. 状態・可視性・時間的意味

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000019`: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）
- `UX-000021`: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）
- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

欠測、不明、非開示、競合、古い情報を同じ空値へ丸めない。一時的情報と永続的情報、表示可否と実行権限を別に扱う。

## 5. 導線・責任・失敗時の保持

- 外部へ渡す情報の所有者: 別Agentやツールへ仕事を渡す時、または結果を受け取る時に「必要な情報だけを出所付きで渡す」ために必要な判断を行う。システムは「全量投入・秘密情報混入・古い仮説の現在値化」を避けられるよう、情報源・改訂版・選択理由を保持する。
- プロジェクト運営者／PM: 応答喪失後に再接続する時に「切断後に同じ依頼へ戻る」ために必要な判断を行う。システムは「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を避けられるよう、同一識別情報の照会を再実行より先に示す。
- 外部へ渡す情報の所有者: 外部AI・検索・公開Communication・管理対象依存を利用する時に「送信範囲と内部へ戻す際の昇格条件を理解する」ために必要な判断を行う。システムは「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を避けられるよう、同意・投影・採用を分離する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

### 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

入力不足、権限不足、観測不能または関係不整合では、既知の状態・識別情報・未解消義務を保持し、安全な拒否または再確認先を返す。IAが定義していない状態値や保存方式はここで創作しない。

### 下流へ保持する意味

Architectureは情報解決（Resolver）と通信方式（Transport）を分け、SPECは同じ識別子（Identity）での再取得を、Verificationは出所喪失・過剰投入を反証する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 6. SPEC処置

| SPEC候補 | 処置 | 判断理由 |
|---|---|---|
| [SPEC-000017](../../Definitions/SPEC-000017/spec_definition.md) | New | この情報構造を入力・状態・結果・開示条件へ変換する |
| [SPEC-000021](../../Definitions/SPEC-000021/spec_definition.md) | New | この情報構造を入力・状態・結果・開示条件へ変換する |
| [SPEC-000026](../../Definitions/SPEC-000026/spec_definition.md) | New | この情報構造を入力・状態・結果・開示条件へ変換する |
| [SPEC-000027](../../Definitions/SPEC-000027/spec_definition.md) | New | この情報構造を入力・状態・結果・開示条件へ変換する |

## 7. UX観点との統合時に確認すること

UX観点の利用者成果と組み合わせ、情報を保持するだけでなく、どの契機で何を返し、何を変更せず、失敗後にどこへ戻れるかをSPEC定義で確定する。
