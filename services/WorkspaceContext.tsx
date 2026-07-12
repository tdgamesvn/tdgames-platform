import React, { createContext, useContext, useState } from 'react';

export type Workspace = 'TD GAMES' | 'TD CONSULTING';

const KEY = 'workspace_entity';

// Record cũ/null coi là TD GAMES. 'Cá nhân' (chỉ có ở expense) thuộc sổ gốc TD GAMES.
export function matchesWorkspace(entity: string | null | undefined, w: Workspace): boolean {
  return (entity || 'TD GAMES') === w || (w === 'TD GAMES' && entity === 'Cá nhân');
}

const WorkspaceContext = createContext<{
  workspace: Workspace;
  setWorkspace: (w: Workspace) => void;
}>({ workspace: 'TD GAMES', setWorkspace: () => {} });

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspace, setWs] = useState<Workspace>(() => {
    const saved = localStorage.getItem(KEY);
    return saved === 'TD CONSULTING' ? saved : 'TD GAMES'; // 'all' cũ trong localStorage tự về TD GAMES
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

// Đọc workspace ngoài React — service dùng để tag entity lúc insert
export const getWorkspace = (): Workspace =>
  localStorage.getItem(KEY) === 'TD CONSULTING' ? 'TD CONSULTING' : 'TD GAMES';
