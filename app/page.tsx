"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router  = useRouter();
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");
  const [ready, setReady] = useState(false);

  // Check if Firebase is configured
  const configured = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );

  useEffect(() => {
    // Only try to check auth state if Firebase is configured
    if (!configured) { setReady(true); return; }

    let cancelled = false;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(({ auth }) => {
        if (!auth) { setReady(true); return; }
        const off = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          if (user) {
            await routeUser(user.uid);
          } else {
            setReady(true);
          }
        });
        return () => { cancelled = true; off(); };
      });
    });
  }, []);

  async function routeUser(uid: string) {
    const { db } = await import("@/lib/firebase");
    const { doc, getDoc } = await import("firebase/firestore");
    if (!db) { setReady(true); return; }
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (!snap.exists()) { setReady(true); return; }
      const d = snap.data();
      if (d.isBlocked) {
        const { auth } = await import("@/lib/firebase");
        const { signOut } = await import("firebase/auth");
        if (auth) await signOut(auth);
        setErr("Your account has been blocked. Contact the admin.");
        setReady(true); return;
      }
      if (d.role === "admin")  router.replace("/admin");
      else if (!d.program)     router.replace("/setup");
      else                     router.replace("/student");
    } catch {
      setReady(true);
    }
  }

  async function signIn() {
    if (!configured) {
      setErr("Firebase is not configured yet. Please fill in your .env.local file.");
      return;
    }
    setErr(""); setBusy(true);
    try {
      const { auth, googleProvider } = await import("@/lib/firebase");
      const { signInWithPopup }      = await import("firebase/auth");
      const { db }                   = await import("@/lib/firebase");
      const { doc, getDoc, getDocs, setDoc, addDoc, collection, query, where, serverTimestamp } = await import("firebase/firestore");

      if (!auth || !db) { setErr("Firebase not ready."); setBusy(false); return; }

      const result = await signInWithPopup(auth, googleProvider);
      const user   = result.user;
      const email  = user.email ?? "";

      if (!email.endsWith("@neu.edu.ph")) {
        await (await import("firebase/auth")).signOut(auth);
        setErr("Only @neu.edu.ph accounts are allowed.");
        setBusy(false); return;
      }

      // Record login
      await addDoc(collection(db, "logins"), {
        userId: user.uid, email,
        timestamp: serverTimestamp(),
      });

      // Check if user doc exists
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) { await routeUser(user.uid); return; }

      // Pre-registered admin?
      const q = await getDocs(query(
        collection(db, "users"),
        where("email", "==", email),
        where("role", "==", "admin"),
      ));
      if (!q.empty) {
        await setDoc(doc(db, "users", user.uid), {
          ...q.docs[0].data(),
          uid:         user.uid,
          displayName: user.displayName ?? "",
          photoURL:    user.photoURL ?? "",
        });
        router.replace("/admin"); return;
      }

      // New student
      await setDoc(doc(db, "users", user.uid), {
        uid:         user.uid,
        email,
        displayName: user.displayName ?? email.split("@")[0],
        photoURL:    user.photoURL ?? "",
        role:        "student",
        program:     "",
        isBlocked:   false,
        createdAt:   serverTimestamp(),
      });
      router.replace("/setup");

    } catch (e: any) {
      if (e.code !== "auth/popup-closed-by-user") {
        setErr("Sign-in failed: " + (e.message ?? "Unknown error"));
      }
      setBusy(false);
    }
  }

  // Show spinner while checking existing session
  if (!ready && configured) {
    return <div className="loader"><div className="spin" /></div>;
  }

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center",
      justifyContent: "center", padding: 24, background: "var(--bg)",
      overflow: "hidden", position: "relative",
    }}>
      {/* Background */}
      <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)", backgroundSize:"50px 50px", opacity:0.3, pointerEvents:"none" }} />
      <div style={{ position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)", width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle,rgba(29,107,243,0.07) 0%,transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", bottom:"-10%", right:"10%", width:350, height:350, borderRadius:"50%", background:"radial-gradient(circle,rgba(16,201,129,0.05) 0%,transparent 70%)", pointerEvents:"none" }} />

      <div className="anim" style={{ width:"100%", maxWidth:400, position:"relative", zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:30 }}>
          <div style={{ width:56, height:56, margin:"0 auto 14px", background:"linear-gradient(135deg,var(--blue),#0e3fa0)", borderRadius:16, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 8px 28px rgba(29,107,243,0.35)" }}>
            <svg width="26" height="26" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.5px", marginBottom:6 }}>CICS Vault</h1>
          <p style={{ fontSize:13, color:"var(--text2)", lineHeight:1.6 }}>
            New Era University<br/>College of Information and Computer Studies
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ boxShadow:"0 8px 48px rgba(0,0,0,0.7)" }}>
          <h2 style={{ fontSize:17, fontWeight:700, marginBottom:5 }}>Welcome back</h2>
          <p style={{ fontSize:13, color:"var(--text2)", marginBottom:20 }}>
            Sign in with your NEU Google account to access official CICS documents.
          </p>

          {/* Show setup warning if not configured yet */}
          {!configured && (
            <div className="alert alert-info" style={{ marginBottom:16 }}>
              ⚙️ Firebase not configured yet — fill in your <code style={{ fontFamily:"monospace" }}>.env.local</code> file, then restart the server.
            </div>
          )}

          {err && <div className="alert alert-error">{err}</div>}

          <button
            onClick={signIn}
            disabled={busy}
            style={{
              width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
              gap:10, padding:"12px 20px",
              background: busy ? "var(--surface2)" : "white",
              color:"#111", border:"none", borderRadius:"var(--rsm)",
              fontFamily:"var(--font)", fontSize:14, fontWeight:700,
              cursor: busy ? "not-allowed" : "pointer",
              boxShadow:"0 2px 10px rgba(0,0,0,0.2)", transition:"all 0.18s",
            }}
          >
            {busy ? (
              <><div className="spin" style={{ width:17, height:17, borderTopColor:"var(--blue)" }} />Signing in…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#4285F4" d="M44.5 20H24v8.5h11.8C34.3 33.6 29.7 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c11.1 0 20.1-8 20.1-21 0-1.3-.2-2.7-.6-4z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:16 }}>
            <div style={{ flex:1, height:1, background:"var(--border)" }} />
            <span style={{ fontSize:11.5, color:"var(--text3)" }}>@neu.edu.ph only</span>
            <div style={{ flex:1, height:1, background:"var(--border)" }} />
          </div>
        </div>

        <p style={{ textAlign:"center", marginTop:18, fontSize:11.5, color:"var(--text3)" }}>
          © {new Date().getFullYear()} NEU · CICS Department
        </p>
      </div>
    </main>
  );
}
