import { DependencyContext } from "./DependencyContext.jsx";

import { useDependencyData } from "../useDependencyData";
import { useDependencyUIState } from "../useDependencyUIState";
import { useDependencyInteraction } from "../useDependencyInteraction";

export default function DependencyProvider({ projectId, children }) {

  // ---------- DATA ----------
  const data = useDependencyData(projectId);

  // ---------- UI ----------
  const ui = useDependencyUIState();

  // ---------- INTERACTION ----------
  const interaction = useDependencyInteraction({
    projectId,
    ...data,
    ...ui,
  });

  const value = {
    ...data,
    ...ui,
    ...interaction,
  };

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
}
