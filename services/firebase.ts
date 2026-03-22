

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User as FirebaseUser, Auth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Firestore,
  initializeFirestore, 
  persistentLocalCache,
  updateDoc 
} from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";
import { Project, SavedStory, NovelSettings, SavedStyle, IdeaSession } from '../types.ts';

const firebaseConfig = {
  // FIXED: Do not use process.env.API_KEY here. It is for Gemini. Use the dedicated Firebase key.
  apiKey: "AIzaSyA6LdNrWRS_-75LYtJDx8Br-TEYaujGVcM", 
  authDomain: "ainovel-ec773.firebaseapp.com",
  projectId: "ainovel-ec773",
  storageBucket: "ainovel-ec773.firebasestorage.app",
  messagingSenderId: "785236614672",
  appId: "1:785236614672:web:d6529080979fb5bbfc3495",
  measurementId: "G-HEN9Y0M48E"
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    
    // ⭐ PERFORMANCE FIX: Enable Offline Persistence
    // This allows the app to load data instantly from local storage while syncing in background.
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: undefined 
      })
    });

    if (typeof window !== 'undefined') {
        getAnalytics(app);
    }
} catch (error) {
    console.error("Firebase initialization error", error);
}

// Helper to remove undefined values which Firestore rejects
const sanitizeData = <T>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

// --- Quota / Error Handling ---
let quotaExceededCallback: (() => void) | null = null;

export const setQuotaExceededCallback = (cb: () => void) => {
  quotaExceededCallback = cb;
};

const handleFirestoreError = (e: any) => {
  console.error("Firestore Operation Error:", e);
  // Check for resource-exhausted error (Quota exceeded)
  if (e && (e.code === 'resource-exhausted' || e.message?.includes('Quota exceeded'))) {
    if (quotaExceededCallback) quotaExceededCallback();
  }
};

export const signInWithGoogle = async () => {
  if (!auth) return;
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Error signing in", error);
    throw error;
  }
};

export const signOut = async () => {
  if (!auth) return;
  try {
      await firebaseSignOut(auth);
  } catch (error) {
      console.error("Error signing out", error);
      throw error;
  }
};

export const subscribeToAuthChanges = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
      callback(null);
      return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const saveProjectToFirestore = async (userId: string, project: Project) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId, 'projects', project.id), sanitizeData(project));
  } catch (e) {
    handleFirestoreError(e);
    throw e; // Re-throw to let UI handle it
  }
};

// SOFT DELETE
export const deleteProjectFromFirestore = async (userId: string, projectId: string) => {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', userId, 'projects', projectId), { deletedAt: Date.now() });
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

// RESTORE
export const restoreProjectToFirestore = async (userId: string, projectId: string) => {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', userId, 'projects', projectId), { deletedAt: null });
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

// HARD DELETE
export const permanentDeleteProjectFromFirestore = async (userId: string, projectId: string) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'projects', projectId));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const saveStoryToFirestore = async (userId: string, story: SavedStory) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId, 'stories', story.id), sanitizeData(story));
  } catch (e) {
    handleFirestoreError(e);
    throw e; // Re-throw to let UI handle it
  }
};

// SOFT DELETE
export const deleteStoryFromFirestore = async (userId: string, storyId: string) => {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', userId, 'stories', storyId), { deletedAt: Date.now() });
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

// RESTORE
export const restoreStoryToFirestore = async (userId: string, storyId: string) => {
  if (!db) return;
  try {
    await updateDoc(doc(db, 'users', userId, 'stories', storyId), { deletedAt: null });
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

// HARD DELETE
export const permanentDeleteStoryFromFirestore = async (userId: string, storyId: string) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'stories', storyId));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const subscribeToUserData = (
  userId: string, 
  onProjectsUpdate: (projects: Project[]) => void,
  onStoriesUpdate: (stories: SavedStory[]) => void
) => {
  if (!db) return () => {};

  // With persistentLocalCache, this listener fires immediately with cached data.
  // We fetch ALL projects/stories including deleted ones, and filter in the App logic.
  // This allows the TrashBin to work properly.
  const qProjects = query(collection(db, 'users', userId, 'projects'), orderBy('createdAt', 'desc'));
  const unsubProjects = onSnapshot(qProjects, { includeMetadataChanges: true }, (snapshot) => {
    const projects = snapshot.docs.map(doc => doc.data() as Project);
    onProjectsUpdate(projects);
  });

  const qStories = query(collection(db, 'users', userId, 'stories'), orderBy('createdAt', 'desc'));
  const unsubStories = onSnapshot(qStories, { includeMetadataChanges: true }, (snapshot) => {
    const stories = snapshot.docs.map(doc => doc.data() as SavedStory);
    onStoriesUpdate(stories);
  });

  return () => {
    unsubProjects();
    unsubStories();
  };
};

// --- Idea Sessions Persistence (New) ---

export const saveIdeaSessionToFirestore = async (userId: string, session: IdeaSession) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId, 'ideaSessions', session.id), sanitizeData(session));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const deleteIdeaSessionFromFirestore = async (userId: string, sessionId: string) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'ideaSessions', sessionId));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const subscribeToIdeaSessions = (
  userId: string,
  onUpdate: (sessions: IdeaSession[]) => void
) => {
  if (!db) return () => {};
  const q = query(collection(db, 'users', userId, 'ideaSessions'), orderBy('updatedAt', 'desc'));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const sessions = snapshot.docs.map(doc => doc.data() as IdeaSession);
      onUpdate(sessions);
  });
};

// --- Styles Persistence ---

export const saveStyleToFirestore = async (userId: string, style: SavedStyle) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId, 'styles', style.id), sanitizeData(style));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const deleteStyleFromFirestore = async (userId: string, styleId: string) => {
  if (!db) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'styles', styleId));
  } catch (e) {
    handleFirestoreError(e);
    throw e;
  }
};

export const subscribeToStyles = (
  userId: string,
  onUpdate: (styles: SavedStyle[]) => void
) => {
  if (!db) return () => {};
  const q = query(collection(db, 'users', userId, 'styles'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
      const styles = snapshot.docs.map(doc => doc.data() as SavedStyle);
      onUpdate(styles);
  });
};

// --- Global Settings Persistence ---

export const saveUserGlobalSettings = async (userId: string, settings: NovelSettings) => {
  if (!db) return;
  try {
    await setDoc(doc(db, 'users', userId, 'settings', 'global'), sanitizeData(settings));
  } catch (e) {
    handleFirestoreError(e);
    // Global settings failure is less critical, but we should still log/throw if needed
    // For now, let's allow it to fail silently or log, as it doesn't block main user flow like Story Save does.
    // But to be consistent:
    console.error("Global settings save failed", e);
  }
};

export const subscribeToGlobalSettings = (
  userId: string,
  onUpdate: (settings: NovelSettings) => void
) => {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'users', userId, 'settings', 'global'), (doc) => {
    if (doc.exists()) {
      onUpdate(doc.data() as NovelSettings);
    }
  });
};

export type { FirebaseUser as User };