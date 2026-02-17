


import { createContext, useContext } from "react";

export const DependencyContext = createContext(null);

export function useDependencyContext() {
  const ctx = useContext(DependencyContext);
  if (!ctx) {
    throw new Error("useDependencyContext must be used inside DependencyProvider");
  }
  return ctx;
}

export function useDependency() {
  const ctx = useContext(DependencyContext);
  if (!ctx) {
    throw new Error("useDependency must be used inside DependencyProvider");
  }
  return ctx;
}

export function DependencyProvider({ projectId, children }) {
  // Placeholder provider - state will be moved here in future refactoring
  const value = {
    projectId,
  };

  return (
    <DependencyContext.Provider value={value}>
      {children}
    </DependencyContext.Provider>
  );
}


