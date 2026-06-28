import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD4l3Jc6ubtaAo7uwIOfrCmYDCYTM0r584",
  authDomain: "couple-budget-52957.firebaseapp.com",
  projectId: "couple-budget-52957",
  storageBucket: "couple-budget-52957.firebasestorage.app",
  messagingSenderId: "1042576621024",
  appId: "1:1042576621024:web:0c5d7d035ac794b30c7f85"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function fbSet(key, value) {
  await setDoc(doc(db, "couple-budget", key), { value: JSON.stringify(value) });
}

export async function fbGet(key, fallback) {
  try {
    const snap = await getDoc(doc(db, "couple-budget", key));
    return snap.exists() ? JSON.parse(snap.data().value) : fallback;
  } catch { return fallback; }
}

export { onSnapshot, doc };
