// src/firebase/firebaseConfig.js
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBoou_q39UFp_MUPhkqCvjso2GuxtbElOA",
  authDomain: "playswithguru-27598.firebaseapp.com",
  projectId: "playswithguru-27598",
  storageBucket: "playswithguru-27598.appspot.com",
  messagingSenderId: "751529029573",
  appId: "1:751529029573:web:0a9dfacb9cfb42b21c25ac",
  measurementId: "G-JN6L4GD073",
};

console.log("Firebase Init Config:", { ...firebaseConfig, apiKey: "[redacted]" });

export const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

console.log("[firebase] Using production Firebase.");
