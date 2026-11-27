/** Serverの公開経路型を、同一オリジンに送るパスへ変換する。 @trace ARCH-000012 */
import type { WorkbenchHttpRoute } from "@qual-lab/crdd-server";

export const RESOURCE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

type PathParameters<T extends string> = T extends `${infer First}/${infer Rest}`
  ? PathParameters<First> | PathParameters<Rest>
  : T extends `:${infer Name}`
    ? Name
    : never;

/** パス引数は、生の値を一つのセグメントとして符号化する。 */
export function workbenchPath<const Route extends WorkbenchHttpRoute>(
  route: Route,
  ...args: RouteArguments<Route>
): string {
  const [parameters] = args;
  return route[1].replace(/:(\w+)/gu, (_match, name: string) => {
    const value = (
      parameters as Readonly<Record<string, string>> | undefined
    )?.[name];
    if (!value || value === "." || value === "..")
      throw new Error("workbench_route_input_invalid");
    return encodeURIComponent(value);
  });
}

type RouteArguments<Route extends WorkbenchHttpRoute> =
  PathParameters<Route[1]> extends never
    ? []
    : [Readonly<Record<PathParameters<Route[1]>, string>>];

/** 送信するメソッドとパスを同じ経路から取り出す。 */
export function workbenchRequest<const Route extends WorkbenchHttpRoute>(
  route: Route,
  ...args: RouteArguments<Route>
): { method: Route[0]; path: string } {
  return { method: route[0], path: workbenchPath(route, ...args) };
}

/** ページ遷移を伴うログイン・連携フォームも公開経路に結び付ける。 */
export function workbenchPostForm<
  const Route extends WorkbenchHttpRoute & readonly ["POST", string],
>(route: Route, ...args: RouteArguments<Route>) {
  return { method: "post", action: workbenchPath(route, ...args) } as const;
}
