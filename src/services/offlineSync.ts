import { createCollection, submitQualityTest, createDispatch } from './api';
import { v4 as uuidv4 } from 'uuid';

export interface PendingAction {
  id: string;
  type: 'collection' | 'quality' | 'dispatch';
  data: any;
  timestamp: number;
}

const STORAGE_KEY = 'pending_actions';

export const getPendingActions = (): PendingAction[] => {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const savePendingAction = (type: PendingAction['type'], data: any) => {
  const actions = getPendingActions();
  const newAction: PendingAction = {
    id: uuidv4(),
    type,
    data,
    timestamp: Date.now(),
  };
  actions.push(newAction);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  return newAction.id;
};

export const syncActions = async () => {
  const actions = getPendingActions();
  if (actions.length === 0) return;

  const remainingActions: PendingAction[] = [];

  for (const action of actions) {
    try {
      if (action.type === 'collection') {
        await createCollection({ ...action.data, offline_id: action.id });
      } else if (action.type === 'quality') {
        await submitQualityTest({ ...action.data, offline_id: action.id });
      } else if (action.type === 'dispatch') {
        await createDispatch({ ...action.data, offline_id: action.id });
      }
      // Success - don't add to remaining
    } catch (error) {
      console.error(`Failed to sync action ${action.id}:`, error);
      remainingActions.push(action);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingActions));
};

export const isOnline = () => navigator.onLine;

window.addEventListener('online', () => {
  console.log('Online restored, syncing...');
  syncActions();
});
