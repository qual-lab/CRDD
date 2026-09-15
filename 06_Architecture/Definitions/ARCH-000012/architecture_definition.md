# 公開Transportの意味同一性のArchitecture定義

成果物種別: Architecture定義
Architecture ID: `ARCH-000012`
状態: Canonical
維持責任者: Qual-Lab

## 1. 責務と境界

受付前／受付済／Effect前後の失敗／結果ありを入口間で同じ意味に保つ。Transport固有Schemaを公開意味契約として再定義しない。

| 区分 | 内容 |
|---|---|
| 状態Owner | MCP／CLI Transport Adapter |
| 所有する責務 | decode／encode、接続Lifecycle、公開Application Contractへの搬送 |
| 所有しない責務 | Project Runtimeの意味契約、Authority追加、Provider実行 |
| 主な外部境界 | CLI、MCP stdio、localhost HTTP、将来のWorkbench |

## 2. UI観点の入力

| UI分析 | 守る利用者向けの約束 |
|---|---|
| [UI-000007](../../Analysis/UI-000007/architecture_analysis.md) | 入口をまたぐ共通依頼・結果 |

## 3. SPEC観点の入力

| SPEC分析 | 守る振る舞い契約 |
|---|---|
| [SPEC-000011](../../Analysis/SPEC-000011/architecture_analysis.md) | 複数入口で同じ依頼・結果契約を保つ |

## 4. 両観点の統合判断

入力ごとの状態Owner、Authority、Effect、失敗およびlifecycleを次表で分ける。同じ責務に統合しても、読取り、分類、書込み、外部Effectまたは再接続を相互流用しない。

| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |
|---|---|---|---|---|---|---|
| UI-000007 | UI | MCP／CLI Transport Adapter | UI契約はAuthorityを発行しない。利用者操作: 依頼する／結果を受け取る／別入口で続ける | UI契約はEffectを定義しない。表示上の状態差: 受付前／受付済み／作用前失敗／作用後失敗／結果あり。導線: 入口→同じ公開要求→Runtime→同じ結果 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が確認・操作する → CLI、MCP、Workbenchの入口を変えても同じ依頼と結果を扱える。 → 結果と次の行動を認識する |
| SPEC-000011 | SPEC | MCP／CLI Transport Adapter | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 | [stdio／localhost HTTP入力] -> [同じApplication Request] -> [同じ状態／結果／失敗分類] |

## 5. 構造と依存方向

```text
[MCP／CLI Transport Adapter]
└─ [SPEC-000011: 複数入口で同じ依頼・結果契約を保つ]
   [stdio／localhost HTTP入力] -> [同じApplication Request] -> [同じ状態／結果／失敗分類]
```

各SPEC branchはSibling blockであり、前のblockのAuthorityやEffectを暗黙に継承しない。UI契約はこれらの状態を利用者へ表すが、AuthorityやEffectを発行しない。

## 6. データ・状態・Interface

共通するIdentityとDataの関係はこの責務が管理する。ただし、状態Owner、AuthorityおよびEffectは入力単位で次のように分け、責務全体へ一律に拡張しない。

| 入力 | State Owner | Authority | Effect／非該当 |
|---|---|---|---|
| UI-000007 | MCP／CLI Transport Adapter | UI契約はAuthorityを発行しない。利用者操作: 依頼する／結果を受け取る／別入口で続ける | UI契約はEffectを定義しない。表示上の状態差: 受付前／受付済み／作用前失敗／作用後失敗／結果あり。導線: 入口→同じ公開要求→Runtime→同じ結果 |
| SPEC-000011 | MCP／CLI Transport Adapter | 呼出し元の既存Authorityだけを搬送する。TransportはAuthorityを追加しない | Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。 |

公開Interfaceは入力IDと対応する契約を保持し、別入力のAuthority、Effectまたはlifecycleを暗黙に継承しない。

## 7. 失敗・回復・観測

- SPEC-000011: Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。Effect: Transport自体は意味を変更しない。下流Effectは同じApplication契約で制御する。

- 入力SPECが固有Recoveryを定義しない場合、Architectureから追加しない。
- 結果には最後に確認できた状態、観測時点、不足および次の安全な行動を、入力契約が必要とする範囲で含める。

## 8. 品質・保護・運用

| 入力 | 保護する失敗境界 | 検証可能性 |
|---|---|---|
| UI-000007 | 利用者成果を壊す表示・操作: UIだけに正本、決定権限、業務ロジックまたは独自状態Storeを作らない。 | 利用者が状態差と次の行動を認識でき、UIからAuthorityやEffectが発行されないこと |
| SPEC-000011 | Transport固有値を意味契約へ混入せず、未対応入口を成立済みと表示しない。 | 固有のAuthority、Effect、失敗理由および終了状態を理由別に反証できること |

共通品質を理由に、入力固有の失敗、非該当Effectまたは終了条件を一つの成功状態へまとめない。

## 9. 互換性・移行・成立済み能力

| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |
|---|---|---|---|---|---|
| v0.20.1のMCP stdio／localhost HTTP | MCP stdio／Streamable HTTP Adapter | MCP／CLI Transport Adapter | 保持・拡張 | [mcp:system:stdio](../../../07_Quality/Registry/test-catalog.json)、[mcp:system:streamable-http](../../../07_Quality/Registry/test-catalog.json) | Workbench／Remote MCPは未実装 |

現行設計はこの比較だけに使い、UI／SPECにない望ましい意味を補わない。新規責務は基準版能力や実装Evidenceが存在するように表示しない。

## 10. 実装と検証への引き渡し

- 実装は「decode／encode、接続Lifecycle、公開Application Contractへの搬送」を所有するCoreと、外部境界を扱うPort／Adapterを分ける。
- 接続→decode→Application呼出し→encode→切断／終了観測を段階的な結合試験で確認する。
- Transport別Schema差、stderr混入、切断後の重複実行、閉じた結果fieldの欠落を理由別に反証する。
- Application固有Recoveryは所有しない。再取得可能な参照を意味変更せず搬送する。

## 11. 情報源と現行照合

正式入力は第2・3節のArchitecture分析だけである。次は成立済み能力とGapを照合するためにだけ参照する。

- [現行照合先](../../Details/mcp/01_Architecture.md)
- [現行照合先](../../Details/project-runtime/01_Architecture.md)
