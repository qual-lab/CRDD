import type { CheckerRule } from "./rule-registry.ts";

export type CurrentProfileRuleCallbacks = Readonly<{
  workLifecycle: () => void;
  discovery: () => void;
  ux: () => void;
  ia: () => void;
  ui: () => void;
  spec: () => void;
  architecture: () => void;
  quality: () => void;
  phaseDiagrams: () => void;
}>;

export function currentProfileRules(
  callbacks: CurrentProfileRuleCallbacks,
): readonly CheckerRule[] {
  const orderedRules: ReadonlyArray<readonly [string, () => void]> = [
    ["01-work-lifecycle", callbacks.workLifecycle],
    ["02-discovery", callbacks.discovery],
    ["03-ux", callbacks.ux],
    ["04-ia", callbacks.ia],
    ["05-ui", callbacks.ui],
    ["06-spec", callbacks.spec],
    ["07-architecture", callbacks.architecture],
    ["08-quality", callbacks.quality],
    ["09-phase-diagrams", callbacks.phaseDiagrams],
  ];
  return orderedRules.map(([id, executeRule]) => ({
    id: `current-profile.${id}`,
    stage: "special-rules" as const,
    run: executeRule,
  }));
}
