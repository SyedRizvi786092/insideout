import { create } from 'zustand';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { getUser, upsertUser } from '@/lib/firestore-service';
import type { AppUser } from '@/types/cricket';
import { UserRole } from '@/types/cricket';

interface AuthState {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isScorer: (matchScorerId: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  appUser: null,
  loading: true,
  initialized: false,

  initialize: () => {
    onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser = await getUser(firebaseUser.uid);
        set({ user: firebaseUser, appUser, loading: false, initialized: true });
      } else {
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error('Failed to sign in anonymously:', error);
          set({ loading: false, initialized: true });
        }
      }
    });
  },

  signInWithGoogle: async () => {
    try {
      const provider = new GoogleAuthProvider();
      const currentUser = auth.currentUser;
      
      let userCredential;
      if (currentUser && currentUser.isAnonymous) {
        try {
          userCredential = await linkWithPopup(currentUser, provider);
        } catch (error: any) {
          if (error.code === 'auth/credential-already-in-use') {
            userCredential = await signInWithPopup(auth, provider);
          } else {
            throw error;
          }
        }
      } else {
        userCredential = await signInWithPopup(auth, provider);
      }

      const user = userCredential.user;
      
      const appUserUpdate: Partial<AppUser> & { uid: string } = {
        uid: user.uid,
        displayName: user.displayName || 'Anonymous',
        email: user.email || '',
        photoURL: user.photoURL,
        role: currentUser?.isAnonymous ? UserRole.Guest : UserRole.Pending,
      };

      await upsertUser(appUserUpdate);
      
      const appUser = await getUser(user.uid);
      set({ user, appUser });
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  },

  signOut: async () => {
    try {
      await firebaseSignOut(auth);
      // signInAnonymously will be triggered by onAuthStateChanged, 
      // but we can also explicitly call it if preferred.
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  isScorer: (matchScorerId: string) => {
    const { user, appUser } = get();
    if (!user) return false;
    if (appUser?.role === UserRole.Admin) return true;
    return user.uid === matchScorerId;
  },

  isAdmin: () => {
    return get().appUser?.role === UserRole.Admin;
  },
}));
