# IA-000014 受け渡す情報・Task・結果・帰還

成果物種別: IA定義
IA ID: `IA-000014`
状態: Canonical
維持責任者: Qual-Lab

## 意味と利用者成果

必要最小の情報を出所付きで渡し、同じ仕事へ結果と未決事項を戻す。

### 利用場面

| 入力UX | 利用者／場面 | 保持する対象 | 区別する状態 | 根拠・判断への導線 |
|---|---|---|---|---|
| [UX-000019](../../Analysis/UX-000019/ia_analysis.md) | 外部へ渡す情報の所有者／別Agentやツールへ仕事を渡す時、または結果を受け取る時 | 仕事用情報一式（Context Package）、情報源（Source）、改訂版（Revision）、選択理由（Selection Reason）、作業（Task）、引き渡し（Handoff）、結果（Result）、判断（Decision） | 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked） | 情報源→選択→仕事用情報一式（Context Package）→Task→結果（Result）→元の仕事 |
| [UX-000021](../../Analysis/UX-000021/ia_analysis.md) | プロジェクト運営者／PM／応答喪失後に再接続する時 | 依頼識別子（Request Identity）、試行（Attempt）、接続中の作業単位（Session）、現在有効な利用許可（Current Grant）、結果（Result）、回復義務（Recovery Obligation） | 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled） | 再接続→同じ依頼（Request）→現在権限→状態・結果→回復義務 |
| [UX-000024](../../Analysis/UX-000024/ia_analysis.md) | 外部へ渡す情報の所有者／外部AI・検索・公開Communication・管理対象依存を利用する時 | 送信先（Destination）、目的（Purpose）、情報分類（Information Classification）、同意（Consent）、送信する最小情報、作業（Task）、持帰り結果（Returned Result）、候補（Candidate）、判断（Decision） | 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted） | 送信候補→境界確認→送信する最小情報→送信→出所付き結果→採否 |

この表は入力UXごとの意味保持先である。共有定義へ統合しても、各行の対象・状態・導線を共通語だけへ丸めない。

## 対象・識別・関係

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

## 状態と可視性

入力UXで必要とされた状態は次のとおりである。状態実値を採用する場合は、下流工程で対応関係を定義し、この利用者向け区分を上書きしない。

- `UX-000019`: 準備済み（prepared）／送信済み（sent）／受領済み（received）／返却済み（returned）／停止（blocked）
- `UX-000021`: 進行中（active）／切断（disconnected）／結果取得可能（result_available）／回復必要（recovery_required）／確定済み（settled）
- `UX-000024`: 未許可（not_authorized）／許可済み（authorized）／送信済み（sent）／返却済み（returned）／候補（candidate）／採用（adopted）

重要な状態、不足、判断要否は次の行動と同じ文脈で示す。観測不能を不存在や正常へ丸めない。

## 導線と責任

- 外部へ渡す情報の所有者: 別Agentやツールへ仕事を渡す時、または結果を受け取る時に「必要な情報だけを出所付きで渡す」ために必要な判断を行う。システムは「全量投入・秘密情報混入・古い仮説の現在値化」を避けられるよう、情報源・改訂版・選択理由を保持する。
- プロジェクト運営者／PM: 応答喪失後に再接続する時に「切断後に同じ依頼へ戻る」ために必要な判断を行う。システムは「Timeoutを未実行とみなし新規外部作用（Effect）を起こす」を避けられるよう、同一識別情報の照会を再実行より先に示す。
- 外部へ渡す情報の所有者: 外部AI・検索・公開Communication・管理対象依存を利用する時に「送信範囲と内部へ戻す際の昇格条件を理解する」ために必要な判断を行う。システムは「接続済みを包括許可とし、外部反応や依存新版を要求・因果・方針へ自動昇格する」を避けられるよう、同意・投影・採用を分離する。

各利用場面の導線は「利用場面」の対応表を正とする。結果なし、判断待ち、失敗、状態不明の場合も、根拠または安全な戻り先へ接続する。

## 制約

具体的な画面、UI部品、API、Schema、保存方式、Process構成は本定義で確定しない。正式な識別子や状態実値を用いる場合は平易な表示と対応付け、利用者が内部構造を知らなくても判断できるようにする。

## 下流への引き渡し

Architectureは情報解決（Resolver）と通信方式（Transport）を分け、SPECは同じ識別子（Identity）での再取得を、Verificationは出所喪失・過剰投入を反証する。

下流工程は「利用場面」の各行を受入単位として扱い、中心対象だけを実装して入力固有の意味を落とさない。

## 情報源

- [UX-000019のIA分析](../../Analysis/UX-000019/ia_analysis.md)
- [UX-000021のIA分析](../../Analysis/UX-000021/ia_analysis.md)
- [UX-000024のIA分析](../../Analysis/UX-000024/ia_analysis.md)
