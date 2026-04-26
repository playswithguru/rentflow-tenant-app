// src/firebase/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getAuth,
  onIdTokenChanged,
  setPersistence,
  browserLocalPersistence,
  getRedirectResult,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { app } from "./firebaseConfig";

function hasCachedFirebaseUser() {
  try {
    if (typeof window === "undefined") return false;
    return Object.keys(window.localStorage || {}).some((k) =>
      k.startsWith("firebase:authUser:")
    );
  } catch {
    return false;
  }
}

const isPermDenied = (e) =>
  (e && (e.code === "permission-denied" || e.code === "failed-precondition")) ||
  false;

const DEFAULT_USER_DOC = (email) => ({
  email: email || null,
  role: "observer",
  status: "pending",

  apps: {
    rentflow: false,
  },

  rentflowAccess: {
    dashboard: false,
    role: "landlord",
    landlordId: null,
  },

  features: {
    pwg: false,
    teg: false,
    export: false,
  },

  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

const AuthContext = createContext({
  user: null,
  loading: true,
  authloading: true,
  authInitialized: false,
  userDoc: null,
  userDocLoading: false,
  subscription: null,
  isSubscribed: false,
  firestoreBlocked: false,
});

const db = getFirestore(app);

async function ensureUserDoc(uid, email) {
  if (!uid) return { ok: false, reason: "no-uid" };

  const ref = doc(db, "users", uid);

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, DEFAULT_USER_DOC(email), { merge: true });
    } else {
      const data = snap.data() || {};
      const patch = {
        updatedAt: serverTimestamp(),
      };

      if (email && data.email !== email) patch.email = email;
      if (!("role" in data)) patch.role = "observer";
      if (!("status" in data)) patch.status = "pending";

      patch.apps = {
        ...(data.apps || {}),
        rentflow:
          typeof data.apps?.rentflow === "boolean"
            ? data.apps.rentflow
            : false,
      };

      patch.rentflowAccess = {
        ...(data.rentflowAccess || {}),
        dashboard:
          typeof data.rentflowAccess?.dashboard === "boolean"
            ? data.rentflowAccess.dashboard
            : false,
        role: data.rentflowAccess?.role || "landlord",
        landlordId:
          data.rentflowAccess?.landlordId === undefined
            ? null
            : data.rentflowAccess.landlordId,
      };

      patch.features = {
        ...(data.features || {}),
        pwg: typeof data.features?.pwg === "boolean" ? data.features.pwg : false,
        teg: typeof data.features?.teg === "boolean" ? data.features.teg : false,
        export:
          typeof data.features?.export === "boolean"
            ? data.features.export
            : false,
      };

      await setDoc(ref, patch, { merge: true });
    }

    return { ok: true, ref };
  } catch (e) {
    if (isPermDenied(e)) {
      console.warn("ensureUserDoc blocked by Firestore permissions/AppCheck", {
        code: e.code,
        message: e.message,
        uid,
      });
      return { ok: false, ref, err: e, reason: "perms" };
    }

    console.error("ensureUserDoc error:", e);
    return { ok: false, ref, err: e, reason: "other" };
  }
}

export const AuthProvider = ({ children }) => {
  const auth = getAuth(app);

  const [user, setUser] = useState(null);
  const [authloading, setAuthLoading] = useState(hasCachedFirebaseUser());
  const [authInitialized, setAuthInitialized] = useState(false);
  const [userDoc, setUserDoc] = useState(null);
  const [userDocLoading, setUserDocLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [firestoreBlocked, setFirestoreBlocked] = useState(false);

  useEffect(() => {
    let unsubAuth = () => {};
    let unsubUserDoc = () => {};

    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);

        try {
          await getRedirectResult(auth);
        } catch (e) {
          console.warn("AuthContext: getRedirectResult:", e?.code || e);
        }

        unsubAuth = onIdTokenChanged(auth, async (fbUser) => {
          try {
            try {
              unsubUserDoc();
            } catch {}

            if (!fbUser) {
              setUser(null);
              setUserDoc(null);
              setUserDocLoading(false);
              setSubscription(null);
              setFirestoreBlocked(false);
              return;
            }

            const token = await fbUser.getIdToken();
            const u = {
              uid: fbUser.uid,
              email: fbUser.email,
              displayName: fbUser.displayName,
              photoURL: fbUser.photoURL,
              token,
              _fb: fbUser,
            };

            setUser(u);
            setUserDocLoading(true);

              console.log("AUTH USER UID:", u.uid);
              console.log("AUTH USER EMAIL:", u.email);
            const res = await ensureUserDoc(u.uid, u.email);

            if (res.ok && res.ref) {
              setFirestoreBlocked(false);

              unsubUserDoc = onSnapshot(
                res.ref,
                (snap) => {
                  const data = snap.data() || null;
                  setUserDoc(data);
                  setSubscription(data?.subscription || null);
                  setUserDocLoading(false);
                },
                (err) => {
                  console.error("AuthContext: user doc listener error:", err);
                  setUserDoc(null);
                  setSubscription(null);
                  setUserDocLoading(false);
                  if (isPermDenied(err)) setFirestoreBlocked(true);
                }
              );
            } else {
              setUserDoc(null);
              setSubscription(null);
              setUserDocLoading(false);
              setFirestoreBlocked(res.reason === "perms");
            }
          } finally {
            setAuthLoading(false);
            setAuthInitialized(true);
          }
        });
      } catch (e) {
        console.error("AuthContext init error:", e?.code || e);
        setAuthLoading(false);
        setAuthInitialized(true);
        setFirestoreBlocked(isPermDenied(e));
      }
    })();

    return () => {
      try {
        unsubAuth();
      } catch {}
      try {
        unsubUserDoc();
      } catch {}
    };
  }, [auth]);

  const isSubscribed =
    !!subscription &&
    ["active", "trialing"].includes(
      String(subscription?.status || "").toLowerCase()
    );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading: authloading,
        authloading,
        authInitialized,
        userDoc,
        userDocLoading,
        subscription,
        isSubscribed,
        firestoreBlocked,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
