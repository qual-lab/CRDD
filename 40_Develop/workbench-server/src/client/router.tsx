/**
 * Workbenchの画面遷移と表示要求をReact Routerへ接続する。
 * @packageDocumentation
 * @responsibility 既知Route・履歴・取消を標準Routerへ委譲し、非秘密表示だけを描画する。
 * @trace ARCH-000012
 * @boundary 同Origin Navigation、Router Signal、既存表示API。
 * @effect 既知Routeで表示APIを一回読み、pending／固定エラー／検査済み画面を描画する。
 * @security 認可はServerに維持し、秘密をLoader DataやHistoryへ保存しない。
 */
import { useLayoutEffect, type ReactElement } from "react";
import {
  createBrowserRouter,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigation,
} from "react-router";
import type {
  WorkbenchClientModel,
  WorkbenchTopicMeetingResultView,
} from "../shared/view/types.ts";
import { WorkbenchApp } from "./app.tsx";
import { readWorkbenchClientModel } from "./api/view.ts";
import { readWorkbenchConnectionGeneration } from "./api/connection.ts";

const modelRoutes = new Set([
  "/",
  "/index.html",
  "/project",
  "/topic",
  "/meeting",
  "/change",
  "/owner-artifact",
]);

/**
 * 通常のCSR表示として扱う既知Pathを判定する。
 * @responsibility 未知Path・別の操作入口をNavigationへ取り込まない。
 * @trace ARCH-000012
 * @input URLのpathname。
 * @returns 既存の7Pathだけtrue。
 * @precondition 同OriginのWorkbench Document内で使用する。
 * @postcondition 古い表示を現在の成功へ補完しない。
 * @effect N/A: 固定集合の照合だけ。
 * @failure 対象外はfalse。
 * @invariant URLとRouter状態を認可の証明にしない。
 * @boundary Browser Navigationと既存表示API。
 * @security 資格・業務SnapshotをURL・Historyへ保存しない。
 * @concurrency N/A: 同期の純粋判定。
 */
export function isWorkbenchRoute(pathname: string): boolean {
  return modelRoutes.has(pathname);
}

/**
 * 当該Documentだけの標準Browser Routerを構成する。
 * @responsibility 既存取得をRouter Signalへ接続し、pending時に旧画面を外す。
 * @trace ARCH-000012
 * @input 当該DocumentのReact Root要素。
 * @returns 履歴・要求取消・破棄を所有する標準Router。
 * @precondition 同OriginのWorkbench Document内で使用する。
 * @postcondition 古い表示を現在の成功へ補完しない。
 * @effect 初回と既知の遷移で一回取得する。Router以外のHistory監視を作らない。
 * @failure 取得失敗は遷移先URLの固定エラーへ渡す。
 * @invariant URLとRouter状態を認可の証明にしない。
 * @boundary Browser Navigationと既存表示API。
 * @security 資格・業務SnapshotをURL・Historyへ保存しない。
 * @concurrency Routerが旧要求を取消し、dispose後の結果を採用しない。
 */
export function createWorkbenchRouter(root: HTMLElement) {
  let deletion: Readonly<{
    target: string;
    repositoryId: string | null;
    result: WorkbenchTopicMeetingResultView;
    generation: number;
  }> | null = null;

  /**
   * 削除後の確定通知だけを同じ一覧への一回遷移へ渡す。
   * @responsibility 取得OwnerをRouterへ移し、独自履歴変更と二重GETを作らない。
   * @trace ARCH-000012
   * @input 同Originの一覧URL、対象Repository、非秘密の削除結果。
   * @returns Router replaceとfresh取得の完了。
   * @precondition Record Ownerが削除結果と引渡し前Signalを検査済み。
   * @postcondition 通知は当該Router・目的URL・Repository・接続世代だけへ搬送する。
   * @effect 標準Router replaceとGET一回。
   * @failure 遷移失敗では通知を成功画面へ重ねず固定エラーとする。
   * @invariant Model全体・資格をHistory・Queryへ保存しない。
   * @boundary Recordの完了通知と次Loaderの表示。
   * @security 一件の非秘密通知を別Repository・接続へ渡さない。
   * @concurrency 引渡し後はRouter Signalが取得Owner。旧finallyは新通知を解放しない。
   */
  async function replaceDeletedRecord(
    target: URL,
    repositoryId: string | null,
    result: WorkbenchTopicMeetingResultView,
  ): Promise<void> {
    if (target.origin !== location.origin || target.pathname !== "/")
      throw new Error("workbench_view_unavailable");
    const notice = {
      target: target.pathname + target.search,
      repositoryId,
      result,
      generation: readWorkbenchConnectionGeneration(),
    };
    deletion = notice;
    try {
      await router.navigate(target.pathname + target.search + target.hash, {
        replace: true,
        flushSync: true,
      });
      if (router.state.errors) throw new Error("workbench_view_unavailable");
    } finally {
      if (deletion === notice) deletion = null;
    }
  }
  /**
   * 現在の表示要求が保留中であることだけを示す。
   * @responsibility 旧画面を表示せず、読取り中の状態を明示する。
   * @trace ARCH-000012
   * @input N/A: 同Routerの保留状態。
   * @returns 固定の待機表示。
   * @precondition 同OriginのWorkbench Document内で使用する。
   * @postcondition 古い表示を現在の成功へ補完しない。
   * @effect DOMの非秘密な表示状態をloadingにする。
   * @failure N/A: 外部I/Oを行わない。
   * @invariant URLとRouter状態を認可の証明にしない。
   * @boundary Browser Navigationと既存表示API。
   * @security 資格・業務SnapshotをURL・Historyへ保存しない。
   * @concurrency 待機表示のcommit時に状態を同期する。
   */
  function LoadingView(): ReactElement {
    useLayoutEffect(() => {
      root.dataset.workbenchClient = "loading";
    }, []);
    return <p role="status">現在の情報を確認しています。</p>;
  }

  /**
   * 遷移先の取得失敗を固定文で示す。
   * @responsibility 自由な例外本文と古いModelを描画しない。
   * @trace ARCH-000012
   * @input N/A: Routerが確定したエラー。
   * @returns 固定のblocked表示。
   * @precondition 同OriginのWorkbench Document内で使用する。
   * @postcondition 古い表示を現在の成功へ補完しない。
   * @effect DOMの非秘密な表示状態をblockedにする。
   * @failure 例外詳細を表示・記録しない。
   * @invariant URLとRouter状態を認可の証明にしない。
   * @boundary Browser Navigationと既存表示API。
   * @security 資格・業務SnapshotをURL・Historyへ保存しない。
   * @concurrency 取消済みのLoader結果はRouterが破棄する。
   */
  function FailedView(): ReactElement {
    useLayoutEffect(() => {
      root.dataset.workbenchClient = "blocked";
    }, []);
    return (
      <p role="alert">
        Workbenchの現在表示を取得できません。未観測を正常状態として扱わず、Server接続を確認してください。
      </p>
    );
  }

  /**
   * 現在Routeの検査済みModelだけを描画する。
   * @responsibility 通常の表示取得では画面を再生成し、hash-onlyでは画面内入力を維持する。
   * @trace ARCH-000012
   * @input Routerから受領した非秘密Model。
   * @returns 現在位置に結合したWorkbench画面。
   * @precondition 同OriginのWorkbench Document内で使用する。
   * @postcondition 古い表示を現在の成功へ補完しない。
   * @effect DOMの非秘密な表示状態をreadyにする。
   * @failure 不正な応答はLoaderの検査で拒否済み。
   * @invariant URLとRouter状態を認可の証明にしない。
   * @boundary Browser Navigationと既存表示API。
   * @security 資格・業務SnapshotをURL・Historyへ保存しない。
   * @concurrency 通常の取得ではpendingで再生成し、hash-onlyでは画面内入力を維持する。
   */
  function CurrentView(): ReactElement {
    const model = useLoaderData<WorkbenchClientModel>();
    const location = useLocation();
    useLayoutEffect(() => {
      root.dataset.workbenchClient = "ready";
    }, []);
    return (
      <WorkbenchApp
        key={location.pathname + location.search}
        model={model}
        replaceDeletedRecord={replaceDeletedRecord}
      />
    );
  }

  /**
   * Navigationの保留中は表示Treeを同期的に切り替える。
   * @responsibility 古いOutletをEffectで後追い非表示にせず描画対象から外す。
   * @trace ARCH-000012
   * @input Routerの現在Navigation状態。
   * @returns 待機表示または現在RouteのOutlet。
   * @precondition 同OriginのWorkbench Document内で使用する。
   * @postcondition 古い表示を現在の成功へ補完しない。
   * @effect 旧画面Componentの終了をReactへ渡す。
   * @failure 下位の固定Error Boundaryへ接続する。
   * @invariant URLとRouter状態を認可の証明にしない。
   * @boundary Browser Navigationと既存表示API。
   * @security 資格・業務SnapshotをURL・Historyへ保存しない。
   * @concurrency 旧Componentの所有要求は既存のunmount処置で取消す。
   */
  function NavigationView(): ReactElement {
    const navigation = useNavigation();
    return navigation.state === "idle" ? <Outlet /> : <LoadingView />;
  }

  const router = createBrowserRouter([
    {
      id: "workbench",
      Component: NavigationView,
      HydrateFallback: LoadingView,
      ErrorBoundary: FailedView,
      children: [...modelRoutes].map((path) => ({
        path,
        caseSensitive: true,
        loader: async ({ request }: { request: Request }) => {
          const notice = deletion;
          const url = new URL(request.url);
          if (
            notice &&
            notice.target !== url.pathname + url.search &&
            deletion === notice
          )
            deletion = null;
          try {
            const model = await readWorkbenchClientModel(url, request.signal);
            if (notice && deletion === notice) {
              deletion = null;
              if (
                !request.signal.aborted &&
                model.view === "main" &&
                notice.generation === readWorkbenchConnectionGeneration() &&
                model.selectedRepositoryId === notice.repositoryId
              )
                return { ...model, topicMeetingResult: notice.result };
            }
            return model;
          } catch (error) {
            if (deletion === notice) deletion = null;
            throw error;
          }
        },
        shouldRevalidate: () => true,
        Component: CurrentView,
        ErrorBoundary: FailedView,
      })),
    },
  ]);
  const dispose = router.dispose;
  // Router破棄時にも短命通知を解放し、次Documentへ引き継がない。
  router.dispose = () => {
    deletion = null;
    dispose();
  };
  return router;
}
