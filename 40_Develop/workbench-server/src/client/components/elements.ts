/**
 * Workbench画面で共有する小さなReact表示部品。
 *
 * @packageDocumentation
 * @responsibility 画面固有の意味を所有せず、Panel、空状態、表およびForm Tokenの共通DOMだけを構築する。
 * @trace ARCH-000012
 * @boundary Workbench画面ComponentとReact DOM要素の境界。
 * @effect N/A: React要素を構築するだけである。
 * @security Raw HTMLを受け取らず、全ての動的値をReact Textとして描画する。
 */
import { createElement, type ReactElement, type ReactNode } from "react";

/**
 * Workbench Panelの共通表示入力を定義する。
 * @responsibility Panel Identity、見出し、状態および子要素の値契約を所有する。
 * @trace ARCH-000012
 * @shape id、eyebrow、title、status、任意className、任意childrenで構成する。
 * @invariant idはDocument内の安定な対象を表す。
 * @boundary 画面固有Componentと共通Panel Componentの境界。
 * @security Raw HTMLを型契約として受け取らない。
 * @compatibility React 19のReactNode契約を使用する。
 */
export type WorkbenchPanelProps = Readonly<{
  id: string;
  eyebrow: string;
  title: string;
  status: ReactNode;
  className?: string;
  children?: ReactNode;
}>;

/**
 * Workbenchの共通Panel枠を描画する。
 *
 * @responsibility 見出し、状態および内容を一つの意味領域として配置する。
 * @trace ARCH-000012
 * @input propsにPanel ID、見出し、状態、追加classおよび子要素を受け取る。
 * @returns Workbench PanelのReact要素を返す。
 * @precondition idは同一Document内で一意である。
 * @postcondition article直下にheaderと子要素を入力順で配置する。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: 外部I/Oを行わない。
 * @invariant 画面固有の状態や判断を生成しない。
 * @boundary 画面固有Componentと共通DOM構造の境界。
 * @security TextとReact要素だけを受け取り、HTML文字列を解釈しない。
 * @concurrency N/A: 同期的な純粋表示である。
 */
export function WorkbenchPanel(props: WorkbenchPanelProps): ReactElement {
  return createElement(
    "article",
    {
      className: `panel wide${props.className === undefined ? "" : ` ${props.className}`}`,
      id: props.id,
    },
    createElement(
      "header",
      null,
      createElement(
        "div",
        null,
        createElement("p", { className: "eyebrow" }, props.eyebrow),
        createElement("h2", null, props.title),
      ),
      createElement("span", null, props.status),
    ),
    props.children,
  );
}

/**
 * 欠測、未構成または0件の説明を表示する。
 *
 * @responsibility 空に見える状態の意味を説明文として保持する。
 * @trace ARCH-000012
 * @input childrenに状態理由を表すTextまたはReact要素を受け取る。
 * @returns empty-state classを持つ段落を返す。
 * @precondition 呼出元が未構成、観測不能および0件を区別している。
 * @postcondition 説明内容を省略せず一つの段落に配置する。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: 外部I/Oを行わない。
 * @invariant 状態を成功または0件へ再分類しない。
 * @boundary Read Model状態と利用者向け説明の境界。
 * @security HTML文字列を解釈しない。
 * @concurrency N/A: 同期的な純粋表示である。
 */
export function EmptyState({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return createElement("p", { className: "empty-state" }, children);
}

/**
 * Workbench操作TokenをFormへ配置する。
 *
 * @responsibility 起動単位のAction TokenをServer Action Formへ同じ形で搬送する。
 * @trace ARCH-000012
 * @input valueにWorkbench Serverが発行したAction Tokenを受け取る。
 * @returns hidden inputのReact要素を返す。
 * @precondition valueは現在のWorkbench起動単位にだけ有効である。
 * @postcondition field名actionTokenのhidden inputを返す。
 * @effect N/A: React要素を構築するだけである。
 * @failure N/A: 外部I/Oを行わない。
 * @invariant TokenからAuthorityを追加生成しない。
 * @boundary React FormとWorkbench Server Action検証の境界。
 * @security Tokenを可視Text、URLまたはlogへ変換しない。
 * @concurrency N/A: 同期的な純粋表示である。
 */
export function ActionTokenInput({
  value,
}: Readonly<{ value: string }>): ReactElement {
  return createElement("input", { type: "hidden", name: "actionToken", value });
}
