"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PROGRAMS = [
  { code:"CS",  name:"BS Computer Science",                     icon:"💻" },
  { code:"IT",  name:"BS Information Technology",               icon:"🌐" },
  { code:"IS",  name:"BS Information Systems",                  icon:"📊" },
  { code:"EMC", name:"BS Entertainment & Multimedia Computing",  icon:"🎮" },
];

export default function SetupPage() {
  const router  = useRouter();
  const [uid,    setUid]    = useState("");
  const [pick,   setPick]   = useState("");
  const [loading,setLoading]= useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off: any;
    import("firebase/auth").then(({ onAuthStateChanged }) => {
      import("@/lib/firebase").then(async ({ auth, db }) => {
        if (!auth || !db) { setLoading(false); return; }
        const { doc, getDoc } = await import("firebase/firestore");
        off = onAuthStateChanged(auth, async (u) => {
          if (!u) { router.replace("/"); return; }
          const snap = await getDoc(doc(db, "users", u.uid));
          if (!snap.exists()) { router.replace("/"); return; }
          const d = snap.data();
          if (d.role === "admin") { router.replace("/admin");   return; }
          if (d.program)          { router.replace("/student"); return; }
          setUid(u.uid);
          setLoading(false);
        });
      });
    });
    return () => { if (off) off(); };
  }, []);

  async function save() {
    if (!pick || !uid) return;
    setSaving(true);
    const { db }         = await import("@/lib/firebase");
    const { doc, updateDoc } = await import("firebase/firestore");
    if (!db) return;
    await updateDoc(doc(db, "users", uid), { program: pick });
    router.replace("/student");
  }

  if (loading) return <div className="loader"><div className="spin" /></div>;

  return (
    <main style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:"var(--bg)" }}>
      <div className="anim" style={{ width:"100%", maxWidth:500 }}>

        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ width:50, height:50, margin:"0 auto 13px", background:"linear-gradient(135deg,var(--blue),#0e3fa0)", borderRadius:13, display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 6px 22px rgba(29,107,243,0.3)" }}>
            <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
          <h1 style={{ fontSize:22, fontWeight:800, marginBottom:7 }}>Choose your program</h1>
          <p style={{ fontSize:13.5, color:"var(--text2)" }}>This helps us show you the right documents.</p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11, marginBottom:20 }}>
          {PROGRAMS.map(p => (
            <button key={p.code} onClick={() => setPick(p.code)} style={{
              padding:"18px 14px",
              background: pick===p.code ? "rgba(29,107,243,0.1)" : "var(--surface)",
              border:`1.5px solid ${pick===p.code ? "var(--blue)" : "var(--border)"}`,
              borderRadius:"var(--r)", cursor:"pointer", textAlign:"left",
              transition:"all 0.18s",
              boxShadow: pick===p.code ? "0 0 0 1px var(--blue),0 4px 16px rgba(29,107,243,0.12)" : "none",
            }}>
              <div style={{ fontSize:24, marginBottom:9 }}>{p.icon}</div>
              <div style={{ fontSize:19, fontWeight:800, color:pick===p.code?"var(--blue2)":"var(--text)", marginBottom:3 }}>{p.code}</div>
              <div style={{ fontSize:11.5, color:"var(--text2)", lineHeight:1.4 }}>{p.name}</div>
            </button>
          ))}
        </div>

        <button className="btn btn-blue btn-full" onClick={save} disabled={!pick || saving} style={{ padding:12, fontSize:15 }}>
          {saving
            ? <><div className="spin" style={{ width:16, height:16, borderTopColor:"white" }} />Setting up…</>
            : "Continue to Dashboard →"}
        </button>
      </div>
    </main>
  );
}
