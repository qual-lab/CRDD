/**
 * 技術CatalogとRepositoryのAI選択を混同せず表示する。
 * @responsibility 技術対応・役割既定値と現在認証を分離する。
 * @trace ARCH-000012
 * @boundary 非秘密表示ModelとReact DOM。
 * @security 文字列はReactでescapeし、認証情報を扱わない。
 */
import type { ReactElement } from "react";
import { EmptyState, WorkbenchPanel } from "./elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";

/**
 * 五役割の設定と同梱モデル対応表を描画する。
 * @responsibility 未設定を利用可へ補完しない。
 * @trace ARCH-000012
 * @input 検査済みMain Model。
 * @returns 設定・技術対応のPanel。
 * @precondition Serverが対象Repositoryを現在認可済み。
 * @postcondition 認証・Quota・現在の実行可否は未観測と明示する。
 * @effect N/A: 表示だけ。
 * @failure blockedとmissingを分離表示する。
 * @invariant Catalog登録を利用許可としない。
 * @boundary 設定正本と人間向け表示。
 * @security Root・秘密値を表示しない。
 * @concurrency 一Snapshotを同期描画する。
 */
export function AiSelection({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  const surface = model.aiSelection;
  if (!surface)
    return (
      <WorkbenchPanel
        id="ai-selection"
        eyebrow="AI configuration"
        title="AI設定"
        status="未取得"
      >
        <EmptyState>今回のRepository設定は未取得です。</EmptyState>
      </WorkbenchPanel>
    );
  const config = surface.selection.snapshot?.config;
  return (
    <WorkbenchPanel
      id="ai-selection"
      eyebrow="AI configuration"
      title="AI設定"
      status={surface.selection.status}
    >
      <p>
        同梱Catalogは技術対応です。認証・Quota・現在の実行可否は未観測です。
      </p>
      {config ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>役割</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Effort</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(config.roleDefaults).map(([role, choice]) => (
                <tr key={role}>
                  <td>{role}</td>
                  <td>{choice.provider}</td>
                  <td>{choice.model}</td>
                  <td>{choice.effort}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>
          {surface.selection.status === "missing"
            ? "このRepositoryのAI選択は未設定です。"
            : "現在設定を確認できません。"}
        </EmptyState>
      )}
      <h3>技術対応モデル</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>用途</th>
              <th>Effort</th>
            </tr>
          </thead>
          <tbody>
            {surface.catalog.catalog.models.map((model) => (
              <tr key={model.provider + ":" + model.modelIdentifier}>
                <td>{model.provider}</td>
                <td>
                  {model.modelIdentifier}（{model.identifierKind}）
                </td>
                <td>{model.supportedPurposes.join(" / ")}</td>
                <td>{model.supportedEfforts.join(" / ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WorkbenchPanel>
  );
}
