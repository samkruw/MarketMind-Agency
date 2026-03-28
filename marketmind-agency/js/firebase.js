// ============================================================
//  firebase.js  –  MarketMind Agency
//  Alle Firebase-Operationen zentral hier
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, collection,
  setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE CONFIG ──────────────────────────────────────────
// Ersetze diese Werte mit deiner eigenen Firebase-Konfiguration
// Firebase Console → Projekteinstellungen → Deine Apps → Web-App
const firebaseConfig = {
  apiKey: "AIzaSyDKquqF6FUYkQXx0xdjYgjXlDFEkz_lfJs",
  authDomain: "marketmind-agency.firebaseapp.com",
  projectId: "marketmind-agency",
  storageBucket: "marketmind-agency.firebasestorage.app",
  messagingSenderId: "352344619592",
  appId: "1:352344619592:web:86767ed649d8c106ae767d"
};

// ── INIT ─────────────────────────────────────────────────────
const app  = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── CURRENT USER ─────────────────────────────────────────────
let currentUser = null;
let userProfile = null;

export function getCurrentUser()    { return currentUser; }
export function getUserProfile()    { return userProfile; }
export function getUid()            { return currentUser?.uid || null; }

// ── AUTH STATE LISTENER ───────────────────────────────────────
export function onAuthReady(callback) {
  return onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
      userProfile = await loadUserProfile(user.uid);
    } else {
      userProfile = null;
    }
    callback(user);
  });
}

// ── AUTH FUNCTIONS ────────────────────────────────────────────
export async function register(email, password, name) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: name });
  // Create user profile in Firestore
  await setDoc(doc(db, 'users', cred.user.uid), {
    name, email,
    plan: 'free',
    createdAt: serverTimestamp(),
    settings: { lang: 'de', tone: 'Professionell' }
  });
  return cred.user;
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

// ── USER PROFILE ──────────────────────────────────────────────
async function loadUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() : null;
}

export async function updateUserProfile(data) {
  if (!currentUser) return;
  await updateDoc(doc(db, 'users', currentUser.uid), data);
  userProfile = { ...userProfile, ...data };
}

// ── GENERIC CRUD (pro User-Collection) ───────────────────────
// Alle Daten liegen unter: users/{uid}/{collection}/{docId}

function userCol(colName) {
  return collection(db, 'users', getUid(), colName);
}
function userDoc(colName, id) {
  return doc(db, 'users', getUid(), colName, id);
}

// SAVE (upsert)
export async function dbSave(colName, id, data) {
  await setDoc(userDoc(colName, id), {
    ...data,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// LOAD ALL
export async function dbLoadAll(colName, orderField = 'updatedAt') {
  try {
    const q = query(userCol(colName), orderBy(orderField, 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // Fallback ohne ordering wenn Index fehlt
    const snap = await getDocs(userCol(colName));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

// LOAD ONE
export async function dbLoad(colName, id) {
  const snap = await getDoc(userDoc(colName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ADD (auto-id)
export async function dbAdd(colName, data) {
  const ref = await addDoc(userCol(colName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

// DELETE
export async function dbDelete(colName, id) {
  await deleteDoc(userDoc(colName, id));
}

// REALTIME LISTENER
export function dbListen(colName, callback) {
  return onSnapshot(userCol(colName), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(items);
  });
}

// ── SETTINGS (spezieller Doc) ─────────────────────────────────
export async function saveSettings(data) {
  await updateUserProfile({ settings: data });
}

export async function loadSettings() {
  return userProfile?.settings || {};
}

// ── API KEYS (nur localStorage, nie in DB) ───────────────────
export const Keys = {
  groq: {
    get: ()  => localStorage.getItem('mm_gk') || '',
    set: (v) => localStorage.setItem('mm_gk', v),
    ok:  ()  => (localStorage.getItem('mm_gk') || '').length > 10
  },
  openrouter: {
    get: ()  => localStorage.getItem('mm_ok') || '',
    set: (v) => localStorage.setItem('mm_ok', v),
    ok:  ()  => (localStorage.getItem('mm_ok') || '').length > 10
  }
};

export { db, auth };
