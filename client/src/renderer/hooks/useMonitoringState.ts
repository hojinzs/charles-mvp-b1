import { useSearch, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';

export type SortField = 'created' | 'lastChecked' | 'keyword' | 'rank';
export type SortOrder = 'asc' | 'desc';

interface MonitoringState {
  page: number;
  limit: number;
  sortBy: SortField;
  order: SortOrder;
  search: string;
}

export function useMonitoringState() {
  const navigate = useNavigate({ from: '/' });
  const searchParams = useSearch({ from: '/' });

  const state: MonitoringState = {
    page: searchParams.page,
    limit: searchParams.limit,
    sortBy: searchParams.sortBy as SortField,
    order: searchParams.order,
    search: searchParams.search,
  };

  const updateState = useCallback((updates: Partial<MonitoringState>) => {
    navigate({
      search: (prev) => ({
        ...prev,
        ...updates,
      }),
      replace: true, // Replace history entry to avoid clutter
    });
  }, [navigate]);

  const setPage = (page: number) => updateState({ page });
  const setLimit = (limit: number) => updateState({ limit, page: 1 });
  const setSort = (sortBy: SortField, order: SortOrder) => updateState({ sortBy, order, page: 1 });
  const setSearch = (search: string) => updateState({ search, page: 1 });

  return {
    ...state,
    setPage,
    setLimit,
    setSort,
    setSearch,
  };
}
