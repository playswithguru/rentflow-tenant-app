// src/LoginPage.jsx
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { app } from "../firebase/firebaseConfig";
import { useAuth } from "../firebase/AuthContext";

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "linear-gradient(to bottom, #001f3f, #0074D9)",
  },
  card: {
    backgroundColor: "#fff",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    width: "100%",
    maxWidth: "420px",
    textAlign: "center",
  },
  logoWrapper: {
    marginBottom: "1rem",
    width: "200px",
    height: "200px",
    marginLeft: "auto",
    marginRight: "auto",
    borderRadius: "50%",
    backgroundColor: "#fff",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 0 30px rgba(0, 0, 0, 0.3)",
  },
  logo: { width: "150px" },
  title: {
    marginBottom: "1rem",
    fontSize: "1.6rem",
    fontWeight: "bold",
    color: "#003366",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.8rem" },
  input: {
    padding: "0.8rem",
    fontSize: "1rem",
    borderRadius: "6px",
    border: "1px solid #ccc",
  },
  button: {
    padding: "0.8rem",
    fontSize: "1rem",
    backgroundColor: "#003366",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  googleButton: {
    marginTop: "1rem",
    padding: "0.8rem",
    fontSize: "1rem",
    backgroundColor: "#4285F4",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
  toggleText: { marginTop: "1rem", fontSize: "0.9rem" },
  divider: {
    marginTop: "1rem",
    marginBottom: "1rem",
    height: "1px",
    backgroundColor: "#ccc",
  },
  error: { color: "red", fontSize: "0.85rem", marginBottom: "1rem" },
};

const auth = getAuth(app);
const db = getFirestore(app);

// 🔒 DEFAULT LOCKED-DOWN PROFILE FOR NEW USERS
const DEFAULT_USER_PROFILE = (email) => ({
  email,
  role: "observer",
  status: "pending", // invite-only workflow; change to "active" if you want open access
  features: {
    pwg: false,
    export: false,
    teg: false,
  
    // sports (pills)
    nba: false,
    mlb: false,
    wnba: false,
    soccer: false,
    nhl: false,
    nfl: false,
    cfb: false,
    mma: false,
  },
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});


const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState("");

  const { user: authUser, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tracks whether we've ensured the Firestore user doc for the CURRENT auth user
  const [roleEnsured, setRoleEnsured] = useState(false);

  // Ensure Firestore user doc after sign-in (covers redirect flows + refresh)
  useEffect(() => {
    const run = async () => {
      if (authLoading) return;
      if (!authUser) return;

      // if auth user changes, we should ensure again
      if (roleEnsured) return;

      try {
        await ensureUserDoc(authUser.uid, authUser.email);
        setRoleEnsured(true);

        // ✅ only navigate AFTER ensure completes (prevents “open access” race)
        router.push("/");
      } catch (e) {
        console.error("LoginPage: ensureUserDoc failed:", e);
        setError("Login succeeded but profile setup failed. Please refresh.");
      }
    };
    run();
  }, [authLoading, authUser, roleEnsured, router]);

  // If user logs out, reset flag
  useEffect(() => {
    if (!authUser) setRoleEnsured(false);
  }, [authUser]);

  const ensureUserDoc = async (uid, emailAddr) => {
    if (!uid || !emailAddr) return;

    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {
      // Create brand-new locked profile
      await setDoc(userRef, DEFAULT_USER_PROFILE(emailAddr));
      console.log("LoginPage: Created NEW user doc (observer + no features).");
      return;
    }

    // Backfill missing fields for old users safely (merge)
    const data = snap.data() || {};
    const patch = {
      updatedAt: serverTimestamp(),
    };

    if (!("email" in data)) patch.email = emailAddr;
    if (!("role" in data)) patch.role = "observer";
    if (!("status" in data)) patch.status = "pending";

    // Ensure features object exists and has all keys
    const existingFeatures = typeof data.features === "object" && data.features ? data.features : {};
    patch.features = {
      pwg: existingFeatures.pwg ?? false,
      export: existingFeatures.export ?? false,
      teg: existingFeatures.teg ?? false,
    
      nba: existingFeatures.nba ?? false,
      mlb: existingFeatures.mlb ?? false,
      wnba: existingFeatures.wnba ?? false,
      soccer: existingFeatures.soccer ?? false,
      nhl: existingFeatures.nhl ?? false,
      nfl: existingFeatures.nfl ?? false,
      cfb: existingFeatures.cfb ?? false,
      mma: existingFeatures.mma ?? false,
    };
    

    // Only write if something is missing (avoid unnecessary writes)
    const needsWrite =
      !("email" in data) ||
      !("role" in data) ||
      !("status" in data) ||
      typeof data.features !== "object" ||
      data.features?.pwg === undefined ||
      data.features?.export === undefined ||
      data.features?.teg === undefined ||

      data.features?.nba === undefined ||
      data.features?.mlb === undefined ||
      data.features?.wnba === undefined ||
      data.features?.soccer === undefined ||
      data.features?.nhl === undefined ||
      data.features?.nfl === undefined ||
      data.features?.cfb === undefined ||
      data.features?.mma === undefined;

    if (needsWrite) {
      await setDoc(userRef, patch, { merge: true });
      console.log("LoginPage: Backfilled missing user fields (merge).");
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const cred = isLogin
        ? await signInWithEmailAndPassword(auth, email, password)
        : await createUserWithEmailAndPassword(auth, email, password);

      // Ensure doc now, then navigate
      await ensureUserDoc(cred.user.uid, cred.user.email);
      setRoleEnsured(true);
      router.push("/");
    } catch (err) {
      let msg = "Something went wrong. Please try again.";
      if (err.code === "auth/email-already-in-use") msg = "Email already in use. Try logging in instead.";
      else if (err.code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
      else if (err.code === "auth/user-not-found") msg = "No account found with this email.";
      else if (err.code === "auth/invalid-email") msg = "Invalid email format.";
      else if (err.code === "auth/invalid-credential") msg = "Invalid email or password. Please try again.";
      else if (err.code === "auth/too-many-requests") msg = "Too many attempts. Please wait and try again later.";
      setError(msg);
      console.error("LoginPage: Email/Password error:", err);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    try {
      // Desktop popup
      const cred = await signInWithPopup(auth, provider);

      // ✅ ensure doc BEFORE navigate
      await ensureUserDoc(cred.user.uid, cred.user.email);
      setRoleEnsured(true);
      router.push("/");
    } catch (err) {
      // popup blocked/closed -> redirect
      if (err?.code === "auth/popup-blocked" || err?.code === "auth/popup-closed-by-user") {
        try {
          await signInWithRedirect(auth, provider);
          // Redirect flow will be handled by the useEffect when authUser appears
        } catch (e) {
          console.error("Google redirect initiation error:", e);
          setError("Google login failed. Please try again.");
        }
      } else {
        console.error("Google popup error:", err);
        setError("Google login failed. Please try again.");
      }
    }
  };

    if (authLoading && authUser) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <p style={styles.title}>Loading...</p>
            <p>Checking authentication status. Please wait.</p>
          </div>
        </div>
      );
    }

  // If user exists, the useEffect will navigate after ensuring role; render nothing to avoid flicker.
  if (authUser) return null;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoWrapper}>
          <img src="/playswithguru-logo.png" alt="PlaysWithGuru" style={styles.logo} />
        </div>

        <h2 style={styles.title}>{isLogin ? "Log In" : "Sign Up"} to PlaysWithGuru</h2>
        {error && <p style={styles.error}>{error}</p>}

        <form onSubmit={handleEmailLogin} style={styles.form}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.button}>
            {isLogin ? "Log In" : "Sign Up"}
          </button>
        </form>

        <div style={styles.divider} />

        <button onClick={handleGoogleLogin} style={styles.googleButton}>
          Sign in with Google
        </button>

        <div style={styles.toggleText}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            style={{
              marginLeft: 8,
              background: "none",
              border: "none",
              color: "#0276aa",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isLogin ? "Sign Up" : "Log In"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
