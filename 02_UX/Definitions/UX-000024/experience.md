# UX-000024 外部利用の送信・持帰り・昇格を制御する

成果物種別: UX Definition
UX ID: `UX-000024`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

外部Effect前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える

```text
外部Contextの所有者
        │ 外部AI・検索・公開Communication・管理対象依存を利用する時
        ▼
送信範囲と内部へ戻す際の昇格条件を理解する
        │
        ▼
不要情報を漏らさず人間判断を保って外部連携できる
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「外部Contextの所有者」 |
| Trigger／Situation | 外部AI・検索・公開Communication・管理対象依存を利用する時 |
| Goal | 送信範囲と内部へ戻す際の昇格条件を理解する |
| Outcome | 不要情報を漏らさず人間判断を保って外部連携できる |

## 成立条件

- 外部Effect前に送信先・目的・操作・情報分類・許可範囲を理解し、外部情報・反応・依存新版を出典付き候補として扱える
- 重要場面「外部Effect前と結果昇格時」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
外部AI・検索・公開Communication・管理対象依存を利用する時
        ↓
送信範囲と内部へ戻す際の昇格条件を理解する
        │
        ├─ ★ Critical: 外部Effect前と結果昇格時
        ├─ ⚠ Failure:  接続済みを包括許可とし、外部反応や依存新版を要求・因果・Policyへ自動昇格する
        └─ ✓ Quality:  Consent・Projection・Promotionを分離する
        ↓
不要情報を漏らさず人間判断を保って外部連携できる
```

## 必要な情報

Destination、Purpose、Classification、Consent、Candidateを結ぶ

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

接続済み・過去同意からの包括許可、不要情報送信、外部反応・依存新版の要求／因果／Policyへの自動昇格を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはInformation、Purpose、Authority、Sourceを分け、Communication／SPEC／Architectureは送受信境界を具体化する。

## 関係

- Source REQ Analysis: [REQ-000027](../../Analysis/REQ-000027/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)
