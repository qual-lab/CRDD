import {
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
} from "./project-runtime-composition-root.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../security/project-runtime-windows-decision-store.ts";

export {
  runProjectRuntimePublicDecision,
  runProjectRuntimePublicObjective,
  runProjectRuntimePublicStateQuery,
};

export function observeRuntimeOwnedProjectClientPrincipal() {
  const observed = openRuntimeOwnedWindowsProjectDecisionStore();
  return observed.status === "completed"
    ? Object.freeze({
        status: "verified" as const,
        principalId: observed.principalId,
      })
    : Object.freeze({ status: "unknown" as const });
}
