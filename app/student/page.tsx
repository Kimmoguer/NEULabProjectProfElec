"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATS  = ["All","Announcement","Form","Guideline","Memo","Syllabus","Thesis","Others"];
const PROGS = ["All","CS","IT","IS","EMC"];
const CAT_COL: Record<string,string> = {
  Announcement:"#3b82f6", Form:"#10c981", Guideline:"#fbbf24",
  Memo:"#8b5cf6", Syllabus:"#f05252", Thesis:"#06b6d4", Others:"#6b7280",
};

type Doc  = { id:string; title:string; category:string; programs:string[]; fileURL:string; createdAt:any; };
type User = { uid:string; displayName:string; email:string; photoURL:string; program:string; };

export default function StudentPage() {
  const router = useRouter();
  const [user,    setUser]    = useState<User|null>(null);
  const [all,     setAll]     = useState<Doc[]>([]);
  const [shown,   setShown]   = useState<Doc[]>([]);
  const [tab,     setTab]     = useState<"home"|"library">("home");
  const [search,  setSearch]  = useState("");
  const [cat,     setCat]     = useState("All");
  const [prog,    setProg]    = useState("All");
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState("");

  useEffect(() => {
    let off: any;
    (async () => {
      const { auth, db } = await import("@/lib/firebase");
      if (!auth || !db) { router.replace("/"); return; }
      const { onAuthStateChanged, signOut } = await import("firebase/auth");
      const { doc, getDoc, collection, getDocs, query, orderBy } = await import("firebase/firestore");
      off = onAuthStateChanged(auth, async (u) => {
        if (!u) { router.replace("/"); return; }
        const snap = await getDoc(doc(db, "users", u.uid));
        if (!snap.exists()) { router.replace("/"); return; }
        const d = snap.data();
        if (d.isBlocked)       { await signOut(auth); router.replace("/"); return; }
        if (d.role === "admin"){ router.replace("/admin");   return; }
        if (!d.program)        { router.replace("/setup");   return; }
        setUser({ uid:u.uid, displayName:d.displayName, email:d.email, photoURL:d.photoURL, program:d.program });
        const s = await getDocs(query(collection(db,"documents"), orderBy("createdAt","desc")));
        const list = s.docs.map(x => ({ id:x.id, ...x.data() } as Doc));
        setAll(list); setShown(list);
        setLoading(false);
      });
    })();
    return () => { if (off) off(); };
  }, []);

  useEffect(() => {
    let r = [...all];
    if (search) r = r.filter(d => d.title.toLowerCase().includes(search.toLowerCase()));
    if (cat  !== "All") r = r.filter(d => d.category === cat);
    if (prog !== "All") r = r.filter(d => d.programs?.includes(prog) || d.programs?.includes("All"));
    setShown(r);
  }, [search, cat, prog, all]);

  async function openDoc(d: Doc) {
    if (!user) return;
    const { db } = await import("@/lib/firebase");
    if (!db) return;
    const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
    await addDoc(collection(db,"logs"), {
      userId:user.uid, documentId:d.id,
      documentTitle:d.title, userEmail:user.email,
      timestamp:serverTimestamp(),
    });
    window.open(d.fileURL,"_blank");
    flash("Opening document…");
  }

  function flash(msg:string) { setToast(msg); setTimeout(()=>setToast(""),3000); }

  async function logout() {
    const { auth } = await import("@/lib/firebase");
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
    router.replace("/");
  }

  if (loading) return <div className="loader"><div className="spin" /></div>;

  const hr = new Date().getHours();
  const greet = hr<12?"Good morning":hr<18?"Good afternoon":"Good evening";

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sb-head">
          <div className="sb-icon">
            <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
            </svg>
          </div>
          <div><div className="sb-brand">CICS Vault</div><div className="sb-sub">Student Portal</div></div>
        </div>

        <nav className="sb-nav">
          <button className={`sb-item${tab==="home"?" on":""}`} onClick={()=>setTab("home")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
            Home
          </button>
          <button className={`sb-item${tab==="library"?" on":""}`} onClick={()=>setTab("library")}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            Document Library
          </button>
        </nav>

        <div className="sb-foot">
          <div className="sb-user">
            {user?.photoURL
              ? <img src={user.photoURL} className="sb-av" alt="" />
              : <div className="sb-av">{(user?.displayName||"S")[0]}</div>}
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-name">{user?.displayName}</div>
              <div className="sb-sub">{user?.program} · Student</div>
            </div>
          </div>
          <button className="sb-item" onClick={logout}>
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{tab==="home"?"Home":"Document Library"}</span>
          <span className="badge b-green">Student</span>
        </header>

        <div className="page">
          {/* HOME */}
          {tab==="home" && (
            <div className="anim">
              <div style={{ marginBottom:22 }}>
                <div className="ph-h">{greet}, {user?.displayName?.split(" ")[0]} 👋</div>
                <div className="ph-sub">Here are the latest CICS documents.</div>
              </div>
              <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"6px 13px", background:"var(--blue-glow)", border:"1px solid rgba(29,107,243,0.2)", borderRadius:8, marginBottom:20 }}>
                <span style={{ fontSize:12, color:"var(--blue2)", fontWeight:700 }}>📚 {user?.program}</span>
                <span style={{ fontSize:11, color:"var(--text2)" }}>your program</span>
              </div>
              <div style={{ fontSize:14, fontWeight:700, marginBottom:13 }}>Recently uploaded</div>
              {all.length===0
                ? <div className="empty"><svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg><p>No documents uploaded yet.</p></div>
                : <div className="doc-grid">{all.slice(0,6).map(d=><DocCard key={d.id} d={d} onOpen={openDoc}/>)}</div>}
            </div>
          )}

          {/* LIBRARY */}
          {tab==="library" && (
            <div className="anim">
              <div className="ph">
                <div><div className="ph-h">Document Library</div><div className="ph-sub">{shown.length} document{shown.length!==1?"s":""} found</div></div>
              </div>
              <div style={{ display:"flex", gap:9, marginBottom:17, flexWrap:"wrap" }}>
                <div className="search" style={{ flex:1, minWidth:200 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search documents…" />
                </div>
                <select className="select" value={cat}  onChange={e=>setCat(e.target.value)}  style={{ width:"auto" }}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
                <select className="select" value={prog} onChange={e=>setProg(e.target.value)} style={{ width:"auto" }}>{PROGS.map(p=><option key={p}>{p}</option>)}</select>
              </div>
              {shown.length===0
                ? <div className="empty"><svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg><p>No documents match your search.</p></div>
                : <div className="doc-grid">{shown.map(d=><DocCard key={d.id} d={d} onOpen={openDoc}/>)}</div>}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div id="toasts"><div className="toast toast-ok"><div className="dot" style={{ background:"var(--green)" }}/>{toast}</div></div>
      )}
    </div>
  );
}

function DocCard({ d, onOpen }: { d:Doc; onOpen:(d:Doc)=>void }) {
  const c = CAT_COL[d.category]||"#6b7280";
  return (
    <div className="doc-card">
      <div style={{ display:"flex", alignItems:"flex-start", gap:11 }}>
        <div className="doc-ico">
          <svg width="17" height="17" fill="none" stroke="#f05252" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="doc-name" style={{ overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", marginBottom:6 }}>{d.title}</div>
          <span style={{ display:"inline-block", padding:"2px 8px", background:`${c}18`, border:`1px solid ${c}30`, borderRadius:5, fontSize:11, fontWeight:700, color:c }}>{d.category}</span>
        </div>
      </div>
      <div className="doc-foot">
        <span style={{ fontSize:11, color:"var(--text2)" }}>{d.programs?.join(", ")||"All"}</span>
        <button className="btn btn-blue btn-sm" onClick={()=>onOpen(d)}>
          <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/></svg>
          Open
        </button>
      </div>
    </div>
  );
}
