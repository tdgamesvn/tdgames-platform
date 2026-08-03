import { useState, useCallback } from 'react';
import { StudioInfo, StudioRecord } from '@/types';
import { useWorkspace, matchesWorkspace } from '@/services/WorkspaceContext';
import {
  fetchStudiosFromCloud,
  saveStudioToCloud,
  updateStudioInCloud,
  setDefaultStudioInCloud,
  deleteStudioFromCloud,
} from '../services/supabaseService';

type Notify = (msg: string, type?: 'success' | 'warning' | 'error') => void;

const EMPTY_STUDIO: StudioInfo = { name: '', address: '', email: '', taxCode: '' };

export function useStudioManager(notify: Notify, applyStudioToInvoice: (info: StudioInfo) => void) {
  const [allStudios, setStudios] = useState<StudioRecord[]>([]);
  const { workspace } = useWorkspace();
  // ponytail: filter theo sổ tại 1 điểm chung — dropdown + manager + default đều ăn theo
  const studios = allStudios.filter(s => matchesWorkspace(s.entity, workspace));
  const [showStudioManager, setShowStudioManager] = useState(false);
  const [editingStudioId, setEditingStudioId] = useState<string | null>(null);
  const [editingStudioData, setEditingStudioData] = useState<StudioInfo | null>(null);
  const [newStudio, setNewStudio] = useState<StudioInfo>(EMPTY_STUDIO);
  const [isLoading, setIsLoading] = useState(false);

  const loadStudios = useCallback(async () => {
    const data = await fetchStudiosFromCloud();
    setStudios(data);
    return data.filter(s => matchesWorkspace(s.entity, workspace));
  }, [workspace]);

  const handleAddStudio = async () => {
    if (!newStudio.name) {
      notify('Please enter a company name.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      await saveStudioToCloud(newStudio);
      setNewStudio(EMPTY_STUDIO);
      await loadStudios();
      notify('Studio saved!', 'success');
    } catch (e: any) {
      notify('Error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefaultStudio = async (id: string) => {
    try {
      await setDefaultStudioInCloud(id, studios);
      const updated = await loadStudios();
      const def = updated.find(s => s.id === id);
      if (def) {
        const { id: _i, isDefault: _d, entity: _e, ...info } = def;
        applyStudioToInvoice(info);
      }
      notify('Default studio set!', 'success');
    } catch (e: any) {
      notify('Error: ' + e.message, 'error');
    }
  };

  const handleDeleteStudio = async (id: string) => {
    if (!confirm('Delete this studio?')) return;
    setIsLoading(true);
    try {
      await deleteStudioFromCloud(id);
      await loadStudios();
      notify('Studio deleted.', 'success');
    } catch (e: any) {
      notify('Error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditStudio = (s: StudioRecord) => {
    setEditingStudioId(s.id);
    const { id, isDefault, entity, ...info } = s;
    setEditingStudioData(info);
  };

  const handleUpdateStudio = async () => {
    if (!editingStudioId || !editingStudioData) return;
    setIsLoading(true);
    try {
      await updateStudioInCloud(editingStudioId, editingStudioData);
      setEditingStudioId(null);
      setEditingStudioData(null);
      await loadStudios();
      notify('Studio updated!', 'success');
    } catch (e: any) {
      notify('Error: ' + e.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    studios, showStudioManager, setShowStudioManager,
    editingStudioId, setEditingStudioId,
    editingStudioData, setEditingStudioData,
    newStudio, setNewStudio,
    isStudioLoading: isLoading,
    loadStudios,
    handleAddStudio, handleSetDefaultStudio, handleDeleteStudio,
    handleEditStudio, handleUpdateStudio,
  };
}
