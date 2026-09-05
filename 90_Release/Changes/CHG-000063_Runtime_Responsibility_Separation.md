# 変更トレース: Runtime責務分離

変更ID: `CHG-000063`
状態: `Implementation in Progress`
担当責任者: Qual-Lab
対象版: `v0.20.0`
変更分類: `refactoring`
最終更新日: 2026-09-06

## 1. 結論と現在状態

v0.19で成立したProject Runtime、MCP stdioおよびCoordinatorは、意味上の責務を分けていた一方、実装と公開入口の多くをCoordinator package内部へ集約している。この状態では、Coordinator固有のProvider実行、Windows／Docker、Project lifecycle、MCP Transportおよび公開契約の変更が同じpackage境界へ伝播し、後続の限定分散実行、Project State投影およびMCP Streamable HTTPで変更理由と回帰範囲を分離しにくい。

本変更はProject RuntimeをProject-level execution lifecycleのApplication Core、Coordinatorを実行編成、MCPをTransport、実行知を観測・分析、Platform AccessをOS／Platform境界として分ける。物理移動を完成とせず、公開契約、依存方向、実装Adapter、利用側および自動回帰が同時に成立した場合だけ分離完了とする。

2026-09-05に最初の移行単位として、Project状態機械とPlatform Port契約を`40_Develop/project-runtime/`へ移し、続く移行単位でObjective要求と統合結果の公開契約、および一つのTask Attemptを要求するExecution Port契約を同packageへ移した。さらに、実行観測、候補統合、人間判断、Queue、StateおよびLeaseの意味型とPortをProject Runtimeの公開入口へ集約した。実行知、候補Store、Windows保護StoreおよびRepository-local永続化の実装はCoordinator側に保持し、Repository RootとBindingを構成時に閉じたState／Lease Adapterを追加した。Application移行では、再計画処理、Objective受付のPlan検証と公開結果生成、およびTask実行の状態調停をProject Runtimeへ移した。Task実行はRepository Pathと永続化関数への直接依存を除き、Objective受付が構成したBinding済みPersistence PortだけからStateとLeaseを操作する。時刻・安定Identity生成とcleanup不明時のProcess再利用禁止・Recovery Identity生成もProject RuntimeのPortへ分離し、Coordinator Host Adapterで実装を注入する。従来Task Authorityと誤称していた署名済みRuntime packageの一回限りCapabilityは、Task要求と`authorityBindingId`が担う意味上のTask Authorityから分離し、専用のExecution Authorization PortとCoordinator Adapterから発行・失効する契約改訂2へ変更した。構成RootとMCP Transportも独立した所有Pathへ移し、MCPがCoordinator内部moduleや人間判断契約文字列を複製しない依存へ切り替えた。2026-09-06には人間判断Recordの閉じた検証をProject Runtimeへ移し、Windows StoreがCoordinatorの判断Applicationを逆参照する依存を除去した。各単位で単体試験、公開入口、Coordinator利用側、設計対応、試験台帳および変更影響型回帰選択を同時に切り替えている。Objective受付の実行調停、Task Authorityの縮小生成、統合および人間判断Application本体は未移行であり、上位の責務分離は未完了である。

統合経路では、Project Runtimeが要求する統合記録Portを追加し、Repository Root、`.crdd`配置、Hash生成および不変公開をCoordinatorの統合記録Adapterへ分離した。同一記録の再試行、Identity衝突およびPath逸脱の拒否をAdapter契約試験で固定した。その後、状態・Queue・LeaseをBinding済みPortへ切り替え、候補の検証、競合判断、受入状態遷移および公開結果生成を含む統合Application本体をProject Runtimeへ移した。Coordinatorには候補生成、Repository観測、採用および統合記録の環境依存Adapterだけを残した。

人間判断経路では、判断Capabilityの秘密値生成とHashを専用Portへ分離し、Node暗号実装をCoordinator Adapterへ残した。判断ApplicationはBinding済みState Port、保護Store Port、回復Store Portおよび判断Capability Portだけを利用する形へ変更し、発行、適用、置換、無効化およびProcess loss後の回復をProject Runtimeへ移した。秘密値は保護Storeへ保存せず、Hashだけを記録する既存保証を維持する。

## 2. 人間が決定した範囲

- Project Runtimeは独立packageへ分ける。
- Project RuntimeはObjectiveをProject-level execution stateへ変換し、そのlifecycleを管理するApplication Coreとする。
- Project RuntimeはProvider、Coordinator、MCPまたはOS固有実装を直接参照せず、必要能力をPortとして要求する。
- Coordinatorは実行編成とProvider実行を所有し、Project RuntimeのExecution Portを実装するAdapterとなる。
- MCP stdioと後続のMCP Streamable HTTPは独立したTransport packageへ分け、Project Runtimeの公開アプリケーション契約だけを利用する。
- 公開アプリケーション契約は、独立した版管理の必要性が実証されるまでProject Runtimeが所有する。便利な共有箱として別packageを先に作らない。
- 実行知とPlatform Accessの既存独立境界を維持し、Project RuntimeまたはMCPへ再集約しない。

## 3. 目指さないこと

- v0.19の状態機械、Authority、Recovery、受入条件または公開結果の意味を変更すること。
- Folder移動だけで責務分離済みと表示すること。
- Project RuntimeへProvider orchestration、MCP Protocol、Windows／Docker実装、実行知Store、WBS、Topic、Risk、ForecastまたはProject Management正本を集約すること。
- 公開契約、domain、application、runtime core等の未実証packageを細分化すること。
- Linux、macOS、Remote Runtime、LAN／Internet公開または複数Repository対応を本変更から推定すること。

## 4. 設計と依存方向

- [Project Runtimeアーキテクチャ](../../06_Architecture/project-runtime/01_Architecture.md): Application Core、公開契約、Port、状態、依存規則および移行順序。
- [MCP Transportアーキテクチャ](../../06_Architecture/mcp/01_Architecture.md): MCP Protocol、stdio Transport、将来HTTPとの共通境界およびAuthority非生成。
- [Coordinator参照アーキテクチャ](../../06_Architecture/coordinator/01_Architecture.md): v0.19の実行編成、Provider、SecurityおよびRecoveryの既存保証。
- [Project Runtime詳細設計](../../06_Architecture/coordinator/03_Project_Runtime_Design.md): v0.19固定版の状態、資源、Lock、Authority、EffectおよびRecovery契約。移行中も意味の基準として保持する。

許可する上位依存方向は次とする。

```text
MCP / CLI Transport
        ↓
Project Runtime public contract
        ↓
Project Runtime application / core
        ↓
Ports
        ↑
Coordinator / persistence / platform / telemetry adapters
```

Project RuntimeからCoordinator、MCP、ProviderまたはOS固有moduleへの依存は禁止する。CoordinatorとMCPはProject Runtimeの内部Pathを使わず、packageの公開入口だけを使用する。

## 5. 移行単位

1. 現在のProject Runtime、MCP、Coordinator、Platformおよび実行知のmoduleと利用側を全数分類する。
2. `40_Develop/project-runtime/`へpackage、Core、Application、Portおよび公開契約を作る。
3. Project Runtimeが直接利用しているCoordinator／Repository／Windows／Docker／実行知機能をPortへ置き換え、既存実装をCoordinator側Adapterとして接続する。
4. `40_Develop/mcp/`へProtocolとstdio Transportを移し、Project Runtimeの公開入口だけを利用する。
5. CoordinatorのCLIを構成Rootとして、Project Runtime、Coordinator Adapter、Platform Adapter、Persistence Adapterおよび実行知Adapterを一度だけ結合する。
6. source、test、fixture、script、traceability、package設定、試験カタログ、文書参照およびRuntime実行Identityの依存閉包を同じ変更で更新する。
7. 内部Path参照、逆向き依存、二重定義および旧入口を機械検出し、CLI／MCP stdio／回復経路の意味回帰を実行する。

移行中の一時的な互換exportは作らない。旧Pathと新Pathを同時に正規入口として残すと、利用側閉包とRuntime実行Identityが二重化するため、移動単位ごとに全利用側を同じ変更で切り替える。

## 6. 正常・準正常・異常

| 区分 | 代表例 | 期待する処置 |
|---|---|---|
| 正常 | CLIまたはMCP stdioからObjectiveを受付け、Coordinator AdapterがTaskを実行 | v0.19と同じProject結果、Identity、cleanupおよびRecoveryを返す |
| 準正常 | Taskが人間判断、再計画またはRecoveryを要求 | TransportとCoordinatorを越えて同じProject状態を保持し、成功へ補正しない |
| 準正常 | 実行知の記録が利用不能 | Project結果を変更せず、非Authorityの観測不能として分離する |
| 異常 | Project RuntimeがCoordinatorまたはOS固有moduleをimport | 静的な依存検査で拒否する |
| 異常 | MCPがProject Authority、成功またはRepository Effectを生成 | 契約試験で拒否し、Project Runtimeを呼び出さない |
| 異常 | 旧内部Pathを利用側が参照 | 利用側閉包検査で拒否する |
| 異常 | Adapterの応答が欠落、未知またはIdentity不一致 | Project Runtimeは値を補完せずEffect不明またはRecovery義務を保持する |
| 異常 | 移行後の公開入口が旧結果Schemaと不一致 | CLI／MCPの総合試験で停止し、上位完成を主張しない |

## 7. 検証方針

- 単体試験: Project Runtimeの状態、計画、再計画、統合、公開投影およびPort結果の正常・準正常・異常。
- 結合試験: Project RuntimeとCoordinator／Persistence／Platform／実行知Adapterの接続、Identity、資源、Lock、取消、cleanupおよびRecovery。
- 総合試験: 公開CLIとMCP stdioから同じObjective／Decisionを搬送し、公開結果と終了後状態がv0.19契約を保持すること。
- 回帰選択: `project-runtime`、`mcp`または公開契約の変更から、Coordinator、CLI、MCP、traceability、署名依存閉包および文書利用側を逆向きに選択すること。
- 静的検査: Project RuntimeからCoordinator／MCP／Provider／OS固有実装への推移的依存0、公開入口を越えた内部Path参照0、移動前Path残存0。

実Provider、公式署名、性能試験および長時間試験は設計・移行中に自動発火しない。Runtime実行Identityを構成するsourceが変わるため、v0.20の正式候補では再署名と影響する正式E2Eが必要である。

## 8. 完成条件

- Project Runtime、Coordinator、MCP、実行知およびPlatform Accessの所有責務を文書と公開入口から一意に再構成できる。
- Project Runtime packageからCoordinator、Provider、MCPまたはOS固有実装への直接・推移的依存が0である。
- CoordinatorとMCPのProject Runtime内部Path参照が0である。
- 公開アプリケーション契約の意味定義が一つで、MCP Schemaが同じ意味を独立再定義しない。
- v0.19の状態、Authority、Identity、Effect、cleanup、RecoveryおよびAcceptanceの必須保証を移行後も保持する。
- CLIとMCP stdioの正常・準正常・異常の自動回帰が成功する。
- 試験カタログと変更影響型runnerが新packageと全利用側を選択する。
- Repository全体Checker、決定論的試験および独立レビューで未解決の必須指摘事項がない。

## 9. 公開済み文書の現行案内補正

責務分離で試験の所有Componentとファイル名が変わったため、v0.19.0で公開したCHG-000057の現在の試験案内だけを現行Pathへ補正する。公開時の本文、判断、結果および主張は変更しない。Checkerは公開tag上の原文Hash、置換前・途中・置換後の完全一致、置換数および現行参照先の実在を検証し、それ以外の本文差を拒否する。

<!-- crdd-released-navigation-correction: 1 -->
```json
{
  "schemaRevision": 1,
  "sourceRelease": "v0.19.0",
  "sourcePath": "90_Release/Changes/CHG-000057_Minimum_AI_Native_Project_Runtime.md",
  "sourceSha256": "e3ab9e61c2ab5b115438fab731937907452ab10b6153805895bebebbbc29f226",
  "replacements": [
    {
      "before": "[Project状態契約試験](../../40_Develop/coordinator/tests/project-runtime-state.contract.test.ts)",
      "after": "[Project状態契約試験](../../40_Develop/project-runtime/tests/unit/project-runtime-state.contract.test.ts)",
      "count": 1
    },
    {
      "before": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/mcp-project-runtime-adapter.contract.test.ts)",
      "via": "[MCP Adapter契約試験](../../40_Develop/coordinator/tests/unit/mcp-project-runtime-adapter.contract.test.ts)",
      "after": "[MCP Adapter契約試験](../../40_Develop/mcp/tests/unit/project-runtime-adapter.contract.test.ts)",
      "count": 1
    }
  ]
}
```
