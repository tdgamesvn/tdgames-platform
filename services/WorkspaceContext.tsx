import React, { createContext, useContext, useState } from 'react';

export type Workspace = 'TD GAMES' | 'TD CONSULTING' | 'all';

const KEY = 'workspace_entity';

// Record cũ/null coi là TD GAMES. 'Cá nhân' chỉ hiện ở workspace 'all'.
export function matchesWorkspace(entity: string | null | undefined, w: Workspace): boolean {
  if (w === 'all') return true;
  return (entity || 'TD GAMES') === w;
}

const WorkspaceContext = createContext<{
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
}>({ workspace: 'TD GAMES', setWorkspace: () => {} });

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWs] = useState<Workspace>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === 'TD CONSULTING' || saved === 'all' ? saved : 'TD GAMES';
  });
  const setWorkspace = (w: Workspace) => {
    localStorage.setItem(KEY, w);
    setWs(w);
  };
  return (
    <WorkspaceContext.Provider value={{ workspace, setWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => useContext(WorkspaceContext);
