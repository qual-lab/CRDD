# 新しいAIモデルが出るたびに、Coreを書き換えない

探索ID: `EXP-000016`
状態: 要求採用
主な情報源: Provider modelの更新、Coordinatorの運用
判断する人: Qual-Lab
記録の性質: Provider更新経験、Coordinator実装およびAI Runtime構想から再構成

## きっかけ

AI Providerは新しいモデルや推論強度を頻繁に追加する。そのたびにCoordinatorのコードへモデル名を書き足し、Runtimeを再配布する運用は避けたいという要求が出た。

変化には種類がある。既存CLIが受け付けるモデル名やProfileが増える変更と、認証、起動、取消、結果取得のLifecycle自体が異なるRuntime追加では、必要な実装が違う。両方を同じ「モデル追加」と扱うと、設定が任意Code実行の入口になるか、単純なCatalog更新にもCore改修が必要になる。

```text
モデル名・Profileだけが変わる
    → 検証済み設定で更新したい

起動・認証・取消・結果契約が変わる
    → Adapterとして実装・検証したい
```

## 本当の問題

更新が多いこと自体ではない。モデル名やRoleへの割当と、CLIの起動方法、結果の受け渡し、取消を扱うAdapterのLifecycleが同じコードに結び付いていたことが問題だった。

## 置いた仮説

既存Adapterで動くモデル、Profile、Role割当、CLI配置は、検証可能な設定から選べるようにする。起動やLifecycleの意味が異なる新しいRuntimeだけは、新しいAdapterとして実装する。

| 方向 | 評価 | 採否 |
|---|---|---|
| 全モデルをCoreへ列挙する | 安全な閉集合になるが、更新のたびにBuild／配布が必要 | 不採用 |
| 設定から任意Executableと引数を許す | 柔軟だが、Trustと実行境界を失う | 不採用 |
| 検証済みAdapterの範囲内だけ外部構成する | Catalog更新とLifecycle変更を分離できる | 採用 |

設定変更が署名・Trust Policyを迂回する、未知のCLIを起動する、またはHostで使えない構成を利用可能と表示する場合、この方向は成立しない。

## 守ること

- 設定へSecretを書かない。
- 設定に書けることを理由に、任意のExecutableや引数を許可しない。
- 登録済み、Hostで利用可能、認証済み、実行許可済みを分ける。
- 費用だけでモデルを自動選択しない。

## 現在の判断

AI Runtime RegistryとモデルProfileの外部構成をv0.21へ採用する。未知のRuntimeを動的に見つけるPlugin Frameworkは初期範囲に入れない。

## 次工程で確かめること

既存Adapterへのモデル追加、Profile変更、CLI配置変更が設定だけで完結することを確認する。未知Runtime、認証不足、Operationで不許可のモデルは実行前に拒否する。

## 採用した要求

`REQ-000016`: 既存Provider Adapterの意味を変えないモデル、Profile、Role割当およびCLI配置は、Coreの改修を伴わず、検証可能な設定として更新できなければならない。

`REQ-000023`: 認証、起動、取消、結果取得または回復のLifecycleが既存Provider Adapterと異なるAI Runtimeは、設定だけで任意実行せず、新しいAdapterとして実装・検証しなければならない。
