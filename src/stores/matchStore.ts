import { create } from 'zustand';
import { Unsubscribe } from 'firebase/firestore';
import { onMatchSnapshot, onInningsSnapshot } from '@/lib/firestore-service';
import { Match, Innings } from '@/types/cricket';

interface MatchState {
  match: Match | null;
  currentInnings: Innings | null;
  loading: boolean;
  error: string | null;
  unsubscribeMatch: Unsubscribe | null;
  unsubscribeInnings: Unsubscribe | null;
  
  subscribeToMatch: (matchId: string) => void;
  unsubscribeAll: () => void;
  clear: () => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  match: null,
  currentInnings: null,
  loading: true,
  error: null,
  unsubscribeMatch: null,
  unsubscribeInnings: null,

  subscribeToMatch: (matchId: string) => {
    get().unsubscribeAll();

    set({ loading: true, error: null });

    const unsubMatch = onMatchSnapshot(matchId, (match) => {
      if (!match) {
        set({ error: 'Match not found', loading: false });
        return;
      }

      set({ match, loading: false });

      // Subscribe to innings
      const currentUnsubInnings = get().unsubscribeInnings;
      if (currentUnsubInnings) {
        currentUnsubInnings();
      }

      const unsubInnings = onInningsSnapshot(matchId, match.currentInnings, (innings) => {
        set({ currentInnings: innings });
      });

      set({ unsubscribeInnings: unsubInnings });
    });

    set({ unsubscribeMatch: unsubMatch });
  },

  unsubscribeAll: () => {
    const { unsubscribeMatch, unsubscribeInnings } = get();
    if (unsubscribeMatch) unsubscribeMatch();
    if (unsubscribeInnings) unsubscribeInnings();
    set({ unsubscribeMatch: null, unsubscribeInnings: null });
  },

  clear: () => {
    get().unsubscribeAll();
    set({
      match: null,
      currentInnings: null,
      loading: false,
      error: null,
    });
  }
}));
