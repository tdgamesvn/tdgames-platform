import React from 'react';
import { useWorkspace, Workspace } from '@/services/WorkspaceContext';

const WS_DOT: Record<Workspace, string> = { 'TD GAMES': 'bg-primary', 'TD CONSULTING': 'bg-blue-400' };
const WS_LABEL: Record<Workspace, string> = { 'TD GAMES': 'TD Games', 'TD CONSULTING': 'TD Consulting' };

interface WorkspaceSwitcherProps {
  variant?: 'compact' | 'pill';
  theme?: string;
}

export const WorkspaceSwitcher: React.FC<WorkspaceSwitcherProps> = ({ variant = 'compact', theme = 'dark' }) => {
  const { workspace, setWorkspace } = useWorkspace();

  if (variant === 'pill') {
    return (
      <div className="flex items-center gap-1 bg-surface/60 border border-white/10 rounded-full p-1">
        {(['TD GAMES', 'TD CONSULTING'] as Workspace[]).map(w => (
          <button
            key={w}
            type="button"
            onClick={() => setWorkspace(w)}
            title="Chọn sổ sách"
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${
              workspace === w
                ? w === 'TD GAMES'
                  ? 'bg-primary/20 border-primary text-primary'
                  : 'bg-blue-500/20 border-blue-400 text-blue-400'
                : 'text-white/40 border-transparent'
            }`}
          >
            {WS_LABEL[w]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative flex items-center gap-1.5 ${theme === 'dark' ? 'bg-surface border border-white/10' : 'bg-gray-100 border border-gray-200'} rounded-lg px-2 py-1`}>
      <span className={`w-2 h-2 rounded-full ${WS_DOT[workspace]}`} />
      <select
        value={workspace}
        onChange={e => setWorkspace(e.target.value as Workspace)}
        className={`bg-transparent text-[10px] font-black uppercase tracking-wider ${theme === 'dark' ? 'text-white' : 'text-black'} outline-none cursor-pointer appearance-none pr-4`}
        title="Chọn sổ sách"
      >
        <option value="TD GAMES" className="bg-[#1a1a1a]">Sổ TD Games</option>
        <option value="TD CONSULTING" className="bg-[#1a1a1a]">Sổ TD Consulting</option>
      </select>
    </div>
  );
};
