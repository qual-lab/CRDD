# Docker Isolation

一回の隔離実行に使うDocker資源と所有子Processの技術処理を担当する。

現在はCoordinatorからの責務抽出中である。通常実行・診断・認証と固定資源回収を接続し、実Dockerで五資源の作成・別Process清掃・不存在を確認した。上位の回復試験接続と固定候補の全回帰・最終レビューは未完了であり、Package完成や実Provider E2E成立は主張しない。

- 公開入口は`src/index.ts`だけ。
- 再起動の固定入口は`restartDockerRuntime`。上位は元要求、取消、現在許可、発行前checkpointと同期通知だけを渡し、Native Session・OS別phase・コマンドは受け取らない。現在は上位の旧修復・再起動Consumerを新入口へ切り替える途中で、深いprivate Source参照が残るため本番切替完了とは扱わない。
- 再入場は固定Executorの発見・実ID回収・不存在確認だけを公開し、任意DockerコマンドのcallbackはPackage内部へ閉じる。
- Task、モデル選定、送信同意、Provider結果の解釈、業務状態は所有しない。
- Server、CLI、永続State、共有Registry、新しいLock／Recovery Frameworkを追加しない。
- Containerを復元せず、所有資源の終端と安全な新規実行のための技術的観測を返す。

正本は[詳細設計](../../06_Architecture/Details/docker-isolation/01_Architecture.md)。抽出・Consumer追従・実境界・独立レビューの完了は[CHG-000082の計画](../../99_Roadmap/Changes/CHG-000082/second-stage-plan.md)で追跡する。
