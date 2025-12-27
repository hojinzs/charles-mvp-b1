export {};

declare global {
  interface Keyword {
    id: number;
    keyword: string;
    url: string;
    last_rank: number | null;
    last_checked_at: string | null;
    created_at: string;
  }

  interface JoinedRanking {
    id: number;
    rank: number;
    checked_at: string;
    keyword: string;
    url: string;
  }

  interface Window {
    electronAPI: {
      setBackendUrl: (url: string) => Promise<boolean>;
      getBackendUrl: () => Promise<string>;
    };
  }
}
