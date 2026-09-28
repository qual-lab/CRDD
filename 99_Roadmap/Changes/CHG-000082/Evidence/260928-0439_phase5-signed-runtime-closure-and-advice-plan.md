# 署名Runtime閉包とWorkbench助言Execution Plan

## 結論

Coordinatorの署名済み実行閉包を、実際の静的依存とWorkbench専用責務に沿って是正した。MCPが実行時に到達するAI Runtime Catalog Core、CROSおよびProject Operationは兄弟Componentとして署名対象へ含める。一方、Workbench専用CompositionはCoordinator package公開入口から外し、Sourceの存在だけで署名済み公開APIまたはRuntime到達性を作らない。

Workbench読取り助言では、Provider Executorへ未検証の自由入力を渡さず、Provider Adapterが専用Execution Planを必ず生成してから一方のExecutorへ渡す。実Provider Effectはまだ接続していない。

## 原因と是正

| 観点 | 原因 | 是正 |
|---|---|---|
| Coordinator公開入口 | Workbench専用CompositionをCoordinator rootから再公開し、既存package契約を広げていた | Workbench専用exportとroot package exportを除去した |
| 署名済み兄弟Component | MCPの新しい実依存が署名閉包の許可集合へ未登録だった | AI Runtime、CROS、Project Operationを実到達する兄弟Componentとして登録した |
| AI Runtime依存 | Catalog利用が公開root経由でStore／管理Surfaceまで到達し得た | `catalog.ts`／`types.ts`を直接参照し、実行時に必要な最小Coreへ限定した |
| Provider Executor入力 | exact Profileの平坦値はあったが、mount／Tool／Session／fallback境界が一つの計画になっていなかった | `workbench_advice`専用Execution Planを追加し、Adapterから必須経由にした |

## 固定したExecution Plan

```text
verified Task Packet + resolved Profile
                  ↓
Provider Adapter
                  ↓ validate exact identity
Workbench Advice Execution Plan
├ mode: workbench_advice
├ prompt transport: stdin
├ repository/workspace mounted: false
├ tools/session persistence: false
├ API key/paid fallback: false
└ exact task/projection hash
                  ↓
fixed provider executor（未接続）
```

Catalog Revision、Provider、Profile ID、exact Model、推論強度、Offering、Task HashおよびProjection Hashの不一致、未知Propertyまたは不正HashはExecutor Effect前に拒否する。採用CatalogはOwnerごとに改訂可能なため既定Catalogへ固定せず、その依頼で解決済みのProfile Identityと照合する。

## 確認結果

| 確認 | 結果 |
|---|---|
| Coordinator型検査 | Pass |
| Execution Plan／Provider Adapter／Dispatch局所試験 | 16件Pass |
| Codex／Claude exact Profile計画 | 2経路Pass |
| Offering／Model／Provider／Hash／未知Property反例 | 全件Effect 0で拒否 |
| 署名Runtime依存閉包の局所試験 | 3件Pass |
| Workbench全試験 | 18件Pass（本Evidence前の同一実装系列） |
| 実Provider Effect | 0 |

Coordinator全portable回帰は、追加した兄弟Componentを各Fixtureで再構成・Hash化するため長時間化した。実行中に見つかった既存FixtureのProfile入力不足は是正し、該当試験単体をPassさせたが、この時点では全portable回帰完走を主張しない。固定Executor実装後の署名候補前に一度だけ全回帰を完走する。

## Checklist

- [x] Workbench専用CompositionをCoordinator公開APIへ混入させていない。
- [x] 実到達する兄弟Componentだけを署名閉包へ登録した。
- [x] Catalog管理SurfaceをCatalog参照だけで署名閉包へ引き込んでいない。
- [x] Provider Executorが未検証の自由入力を直接受け取らない。
- [x] Repository／Workspace／Tool／Session／fallback境界を明示した。
- [x] 実Provider Effectを発行していない。
- [ ] OPEN: 固定Codex／Claude Executor、署名候補、全portable回帰完走および実Provider E2Eは未成立。Executor接続後に再評価する。
