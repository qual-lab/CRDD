# UX-000017 Runtime Dataを安全に保持・清掃する

成果物種別: UX Definition
UX ID: `UX-000017`
状態: Canonical
維持責任者: Qual-Lab

## 利用者成果

保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる

```text
Runtime導入・運用者
        │ Runtime Dataを作成または清掃する時
        ▼
Runtime Dataの所有場所とLifecycleを理解する
        │
        ▼
残存・清掃・回復を別Repositoryへ波及させず扱える
```

## 利用者・状況・Goal

| 項目 | 内容 |
|---|---|
| Primary Persona／Context | [Product横断の利用者像](../../02_Personas.md)の「Runtime導入・運用者」 |
| Trigger／Situation | Runtime Dataを作成または清掃する時 |
| Goal | Runtime Dataの所有場所とLifecycleを理解する |
| Outcome | 残存・清掃・回復を別Repositoryへ波及させず扱える |

## 成立条件

- 保存場所の内部構造を推測せず、保持すべき状態と一時物を区別して安全に作業を継続・終了できる
- 重要場面「永続化または削除の直前」で、避ける失敗を利用者が正常状態や完了として誤認しない。
- 入口、実装または利用主体が変わっても、この利用者成果の意味を維持する。

## 重要な体験と品質期待

```text
Runtime Dataを作成または清掃する時
        ↓
Runtime Dataの所有場所とLifecycleを理解する
        │
        ├─ ★ Critical: 永続化または削除の直前
        ├─ ⚠ Failure:  subdirectoryや別Rootへ同名データを作る
        └─ ✓ Quality:  用途別領域とcleanup条件を明示する
        ↓
残存・清掃・回復を別Repositoryへ波及させず扱える
```

## 必要な情報

Data Owner、Root、Durability、Retention、Cleanupを関連付ける

## 制約

- 画面、Transport、内部Componentまたは特定の実装方式をUX成果そのものにしない。
- 下流工程は利用者成果を弱めず、情報構造、操作、振る舞いおよび実現方式へ具体化する。
- 想定した利用者、状況またはGoalが誤っていると判明した場合は、Source AnalysisとDiscoveryへ戻す。

## 検証意図

用途不明の書込み、名前や時間だけの削除および別Repositoryへの波及を反証する

具体的なTest Level、Scenarioおよび期待結果はQualityで設計し、このDefinitionには実行結果を書き込まない。

## 下流への引き渡し

IAはRoot、用途、Owner、Lifecycleを分け、ArchitectureとMaintenanceはPath契約と清掃を定める。

## 関係

- Source REQ Analysis: [REQ-000015](../../Analysis/REQ-000015/ux_analysis.md)、[REQ-000022](../../Analysis/REQ-000022/ux_analysis.md)
- Cross-cutting Synthesis: [Personas](../../02_Personas.md)、[Experience Map](../../03_Experience_Map.md)、[Service Blueprint](../../04_Service_Blueprint.md)、[Quality Expectations](../../05_Quality_Expectations.md)

