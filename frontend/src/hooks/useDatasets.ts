import { useState, useCallback } from 'react';
import axios, { AxiosProgressEvent } from 'axios';
import { useWorkspace } from '../context/WorkspaceContext';

export interface Dataset {
  id: number;
  uuid: string;
  filename: string;
  storage_path: string;
  file_size: number;
  content_type: string;
  row_count: number | null;
  column_count: number | null;
  health_score: number | null;
  health_report: {
    health_score: number;
    summary: {
      total_rows: number;
      total_columns: number;
      total_cells: number;
      missing_cells: number;
      missing_percentage: number;
      duplicate_rows: number;
      duplicate_percentage: number;
    };
    columns: Record<string, {
      type: string;
      inferred_type: string;
      missing_count: number;
      missing_percentage: number;
      mismatch_count: number;
    }>;
    suggested_actions: string[];
  } | null;
  workspace_id: number;
  uploaded_by_id: number | null;
  created_at: string;
  template_key?: string;
}

export interface HealResponse {
  dataset_uuid: string;
  original_health_score: number;
  new_health_score: number;
  changes_made: {
    duplicates_removed: number;
    columns_imputed: Record<string, {
      count: number;
      strategy: string;
      value: any;
    }>;
    types_coerced: string[];
  };
  healed_filename: string;
}

export const useDatasets = () => {
  const { activeWorkspaceId } = useWorkspace();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'X-Workspace-ID': activeWorkspaceId
    };
  }, [activeWorkspaceId]);

  const fetchDatasets = useCallback(async () => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Dataset[]>('/api/v1/datasets/', {
        headers: getHeaders()
      });
      const enriched = response.data.map(d => ({
        ...d,
        template_key: localStorage.getItem(`dataset_template_${d.uuid}`) || 'productivity_time'
      }));
      setDatasets(enriched);
      return enriched;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to fetch datasets');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const getDataset = useCallback(async (uuid: string) => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Dataset>(`/api/v1/datasets/${uuid}`, {
        headers: getHeaders()
      });
      const enriched = {
        ...response.data,
        template_key: localStorage.getItem(`dataset_template_${response.data.uuid}`) || 'productivity_time'
      };
      return enriched;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dataset details');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const uploadDataset = useCallback(async (file: File, dropDuplicates: boolean = false, fillMissing: boolean = false, mappings?: string, templateId?: number) => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    if (mappings) {
      formData.append('mappings', mappings);
    }
    if (templateId) {
      formData.append('template_id', String(templateId));
    }

    try {
      const response = await axios.post<Dataset>(
        `/api/v1/datasets/upload?drop_duplicates=${dropDuplicates}&fill_missing=${fillMissing}`, 
        formData, 
        {
          headers: {
            ...getHeaders(),
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent: AxiosProgressEvent) => {
            const percentCompleted = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            setUploadProgress(percentCompleted);
          },
        }
      );

      await fetchDatasets();
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'File upload failed');
      throw err;
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  }, [activeWorkspaceId, fetchDatasets, getHeaders]);

  const healDataset = useCallback(async (uuid: string) => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<HealResponse>(
        `/api/v1/datasets/${uuid}/heal`, 
        null, 
        {
          headers: getHeaders()
        }
      );
      await fetchDatasets();
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to auto-heal dataset');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, fetchDatasets, getHeaders]);

  const generateReport = useCallback(async (uuid: string, title?: string, notes?: string) => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(
        '/api/v1/reports/generate',
        {
          dataset_uuid: uuid,
          title: title || 'Datalyze AI - Data Audit & Profiling Report',
          custom_notes: notes || null,
        },
        {
          responseType: 'blob', // Expect binary file back
          headers: getHeaders()
        }
      );
      
      const contentType = (response.headers['content-type'] as string) || 'application/pdf';
      const fileExtension = contentType.includes('text/html') ? 'html' : 'pdf';
      const blob = new Blob([response.data], { type: contentType });
      
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `datalyze_report_${uuid}.${fileExtension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setError('Failed to generate dataset quality report');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const getAiSummary = useCallback(async (uuid: string): Promise<string> => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<{ summary: string }>(`/api/v1/datasets/${uuid}/ai-summary`, {
        headers: getHeaders()
      });
      return response.data.summary;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load AI health summary');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const submitNlpQuery = useCallback(async (uuid: string, question: string): Promise<NLPQueryResponse> => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post<NLPQueryResponse>(
        `/api/v1/datasets/${uuid}/nlp-query`, 
        { question },
        { headers: getHeaders() }
      );
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to process natural language query');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const getDatasetRecords = useCallback(async (uuid: string): Promise<Record<string, any>[]> => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get<Record<string, any>[]>(`/api/v1/datasets/${uuid}/records`, {
        headers: getHeaders()
      });
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load dataset records');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  const downloadHealedDataset = useCallback(async (datasetId: string, filename: string): Promise<void> => {
    if (!activeWorkspaceId) throw new Error("No active workspace selected");
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`/api/v1/datasets/${datasetId}/download-healed`, {
        responseType: 'blob',
        headers: getHeaders()
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename.startsWith('healed_') ? filename : `healed_${filename}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      setError('Failed to download healed dataset spreadsheet');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [activeWorkspaceId, getHeaders]);

  return {
    datasets,
    loading,
    uploadProgress,
    error,
    fetchDatasets,
    getDataset,
    uploadDataset,
    healDataset,
    generateReport,
    getAiSummary,
    submitNlpQuery,
    getDatasetRecords,
    downloadHealedDataset,
  };
};

export interface NLPFilter {
  column: string;
  operator: string;
  value: any;
}

export interface NLPQueryResponse {
  target_column: string | null;
  aggregation: string;
  filters: NLPFilter[];
  status?: string | null;
  calculated_value?: any;
  matched_rows_count?: number | null;
  error_message?: string | null;
}
