import Store from 'electron-store';

interface StoreSchema {
  backendUrl: string;
}

const store = new Store<StoreSchema>({
  defaults: {
    backendUrl: '',
  },
});

export const getBackendUrl = (): string => {
  return store.get('backendUrl');
};

export const setBackendUrl = (url: string): void => {
  store.set('backendUrl', url);
};

export const clearBackendUrl = (): void => {
  store.delete('backendUrl');
};
