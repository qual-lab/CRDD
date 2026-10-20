/**
 * WorkbenchのAiProfilesを描画する。
 * @packageDocumentation
 * @responsibility 検査済み表示値と既存の操作境界を使い、当該画面・部品を構成する。
 * @trace ARCH-000012
 * @boundary 非秘密の表示ModelとBrowser DOM。
 * @security Reactのtext escapingと既存の資格非永続化を維持する。
 */
import type { ReactElement } from "react";
import { EmptyState, WorkbenchPanel } from "./elements.ts";
import type { WorkbenchMainViewModel } from "../../shared/view/types.ts";

/**
 * AI Profile設定と現在観測を別の列で表示する。
 * @responsibility ConfiguredとAvailableを混同せずProfile別に示す。
 * @trace ARCH-000010
 * @input modelにCatalogと利用可能性観測を受け取る。
 * @returns AI Profile Panelを返す。
 * @precondition CatalogはAI Runtimeで検証済みである。
 * @postcondition 未観測軸をunknownと表示する。
 * @effect N/A: 表示要素の構築だけを行う。
 * @failure 設定済みを実行可能へ変換しない。
 * @invariant Profile Identityとexact Modelを再解釈しない。
 * @boundary AI Profile CatalogとBrowser表示の境界。
 * @security Credential・Provider Home・Host Pathを表示しない。
 * @concurrency N/A: 不変Snapshotを描画する。
 */
export function AiProfiles({
  model,
}: {
  model: WorkbenchMainViewModel;
}): ReactElement {
  if (model.aiProfiles === null)
    return (
      <WorkbenchPanel
        id="ai-profiles"
        eyebrow="AI configuration"
        title="AI Profiles"
        status="未取得"
      >
        <EmptyState>
          共有AI
          Profile情報は未取得です。Profileの不存在や利用不可を意味しません。
        </EmptyState>
      </WorkbenchPanel>
    );
  const observations = new Map(
    model.aiProfiles.observations.map((entry) => [
      entry.profileId,
      entry.availability,
    ]),
  );
  return (
    <WorkbenchPanel
      id="ai-profiles"
      eyebrow="AI configuration"
      title="AI Profiles"
      status={`${model.aiProfiles.catalog.profiles.length} configured`}
    >
      <p className="scene-summary">
        Configuredは実行可能を意味しません。Adapter登録、Host利用可能性、認証および実行Authorityを別々に表示します。
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Adapter</th>
              <th>Model</th>
              <th>Reasoning</th>
              <th>Availability axes</th>
            </tr>
          </thead>
          <tbody>
            {model.aiProfiles.catalog.profiles.map((profile) => {
              const availability = observations.get(profile.profileId);
              return (
                <tr key={profile.profileId}>
                  <td>
                    <code>{profile.profileId}</code>
                  </td>
                  <td>{profile.adapterId}</td>
                  <td>{profile.exactModelId}</td>
                  <td>{profile.defaultReasoningEffort}</td>
                  <td>
                    {availability === undefined
                      ? "unknown"
                      : `adapter=${String(availability.adapterRegistered)}, host=${String(availability.hostAvailable)}, auth=${String(availability.authenticated)}, authority=${String(availability.executionAuthorized)}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </WorkbenchPanel>
  );
}
