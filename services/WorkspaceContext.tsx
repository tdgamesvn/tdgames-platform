import React, { createContext, useContext, useState, useEffect } from 'react';

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
  // ponytail: TD CONSULTING đã ngừng dùng và switcher đã gỡ. Nếu vẫn đọc localStorage,
  // ai từng chọn sổ đó sẽ BỊ KẸT vĩnh viễn ở sổ rỗng — không còn nút nào để đổi lại.
  // Ghim TD GAMES và dọn luôn key cũ.
  const [workspace, setWs] = useState<Workspace>('TD GAMES');
  useEffect(() => { localStorage.removeItem(KEY); }, []);
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
export const getWorkspace = (): Workspace => 'TD GAMES';
