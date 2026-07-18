import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface Workspace {
  id: number;
  name: string;
  dbId?: number;
}

interface WorkspaceContextType {
  activeWorkspaceId: number | null;
  activeWorkspace: Workspace | null;
  workspaces: Workspace[];
  setActiveWorkspaceId: (id: number | null) => void;
  setActiveWorkspace: (id: number | null) => void;
  loading: boolean;
  refreshWorkspaces: () => Promise<Workspace[]>;
  createWorkspace: (name: string) => Promise<void>;
  deleteWorkspace: (id: number) => Promise<Workspace[]>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Set up Axios request interceptor to automatically append the active context header to every outbound call
axios.interceptors.request.use((config) => {
  const activeWorkspaceDbId = localStorage.getItem('activeWorkspaceDbId') || localStorage.getItem('activeWorkspaceId');
  if (activeWorkspaceDbId && activeWorkspaceDbId !== 'null') {
    config.headers['X-Workspace-ID'] = activeWorkspaceDbId;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const WorkspaceProvider = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceState] = useState<number | null>(() => {
    const saved = localStorage.getItem('activeWorkspaceId');
    return saved && saved !== 'null' ? parseInt(saved, 10) : null;
  });
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const activeWorkspace = useMemo(() => {
    return workspaces.find(w => w.id === activeWorkspaceId) || null;
  }, [activeWorkspaceId, workspaces]);

  const setActiveWorkspaceId = (id: number | null) => {
    setActiveWorkspaceState(id);
    if (id === null) {
      localStorage.removeItem('activeWorkspaceId');
      localStorage.removeItem('activeWorkspaceDbId');
    } else {
      localStorage.setItem('activeWorkspaceId', String(id));
      const target = workspaces.find(w => w.id === id);
      if (target && target.dbId) {
        localStorage.setItem('activeWorkspaceDbId', String(target.dbId));
      } else {
        localStorage.setItem('activeWorkspaceDbId', String(id));
      }
    }
  };

  const setActiveWorkspace = (id: number | null) => {
    setActiveWorkspaceId(id);
  };

  const refreshWorkspaces = async () => {
    if (!token) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return [];
    }
    setLoading(true);
    try {
      const response = await axios.get<Workspace[]>('/api/v1/workspaces/', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const indexed = response.data.map((w, index) => ({
        ...w,
        id: index + 1,
        dbId: w.id
      }));
      setWorkspaces(indexed);
      
      if (indexed.length === 0) {
        setActiveWorkspaceId(null);
      } else {
        const saved = localStorage.getItem('activeWorkspaceId');
        const savedId = saved && saved !== 'null' ? parseInt(saved, 10) : null;
        const exists = indexed.some((w) => w.id === savedId);
        const nextId = (exists && savedId !== null) ? savedId : indexed[0].id;
        
        const target = indexed.find(w => w.id === nextId);
        setActiveWorkspaceState(nextId);
        localStorage.setItem('activeWorkspaceId', String(nextId));
        if (target && target.dbId) {
          localStorage.setItem('activeWorkspaceDbId', String(target.dbId));
        } else {
          localStorage.setItem('activeWorkspaceDbId', String(nextId));
        }
      }
      return indexed;
    } catch (error) {
      console.error('Failed to fetch workspaces:', error);
      setWorkspaces([]);
      setActiveWorkspaceId(null);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createWorkspace = async (name: string) => {
    try {
      await axios.post('/api/v1/workspaces/', { name });
      await refreshWorkspaces();
    } catch (error) {
      console.error('Failed to create workspace:', error);
      throw error;
    }
  };

  const deleteWorkspace = async (id: number) => {
    try {
      const target = workspaces.find(w => w.id === id);
      const dbId = target?.dbId || id;
      await axios.delete(`/api/v1/workspaces/${dbId}`);
      return await refreshWorkspaces();
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      throw error;
    }
  };

  // Re-fetch workspaces and flush when token changes
  useEffect(() => {
    if (!token) {
      setWorkspaces([]);
      setActiveWorkspaceId(null);
    } else {
      refreshWorkspaces();
    }
  }, [token]);

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspaceId,
      activeWorkspace,
      workspaces,
      setActiveWorkspaceId,
      setActiveWorkspace,
      loading,
      refreshWorkspaces,
      createWorkspace,
      deleteWorkspace
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
