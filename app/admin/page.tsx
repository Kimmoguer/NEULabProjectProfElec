"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const CATS  = ["Announcement","Form","Guideline","Memo","Syllabus","Thesis","Others"];
const PROGS = ["CS","IT","IS","EMC"];
const CAT_COL: Record<string,string> = {
  Announcement:"#3b82f6", Form:"#10c981", Guideline:"#fbbf24",
  Memo:"#8b5cf6", Syllabus:"#f05252", Thesis:"#06b6d4", Others:"#6b7280",
};
type Tab  = "dashboard"|"upload"|"documents"|"students"|"logs";
type Doc  = { id:string; title:string; category:string; programs:string[]; fileURL:string; storagePath:string; createdAt:any; };
type User = { id:string; displayName:string; email:string; photoURL:string; program:string; isBlocked:boolean; createdAt:any; };
type Log  = { id:string; documentTitle:string; userEmail:string; timestamp:any; };
type Login= { id:string; email:string; timestamp:any; };

export default function AdminPage() {
  const router = useRouter();
  const [admin,   setAdmin]   = useState<any>(null);
  const [tab,     setTab]     = useState<Tab>("dashboard");
  const [docs,    setDocs]    = useState<Doc[]>([]);
  const [users,   setUsers]   = useState<User[]>([]);
  const [logs,    setLogs]    = useState<Log[]>([]);
  const [logins,  setLogins]  = useState<Login[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState({ msg:"", ok:true });

  // Upload
  const [file,   setFile]   = useState<File|null>(null);
  const [title,  setTitle]  = useState("");
  const [cat,    setCat]    = useState("Announcement");
  const [progs,  setProgs]  = useState<string[]>(["All"]);
  const [uping,  setUping]  = useState(false);
  const [upPct,  setUpPct]  = useState(0);
  const [upErr,  setUpErr]  = useState("");

  // Filters
  const [ds,  setDs]  = useState("");
  const [us,  setUs]  = useState("");
  const [per, setPer] = useState("all");

  useEffect(() => {
    let off: any;
    (async () => {
      const { auth, db } = await import("@/lib/firebase");
      if (!auth || !db) { router.replace("/"); return; }
      const { onAuthStateChanged } = await import("firebase/auth");
      const { doc, getDoc } = await import("firebase/firestore");
      off = onAuthStateChanged(auth, async (u) => {
        if (!u) { router.replace("/"); return; }
        const snap = await getDoc(doc(db,"users",u.uid));
        if (!snap.exists() || snap.data().role!=="admin") { router.replace("/"); return; }
        setAdmin({ ...snap.data(), uid:u.uid });
        await Promise.all([loadDocs(db), loadUsers(db), loadLogs(db), loadLogins(db)]);
        setLoading(false);
      });
    })();
    return () => { if (off) off(); };
  }, []);

  async function loadDocs(db:any)   { const { collection,getDocs,query,orderBy } = await import("firebase/firestore"); const s=await getDocs(query(collection(db,"documents"),orderBy("createdAt","desc")));    setDocs(s.docs.map(d=>({id:d.id,...d.data()} as Doc))); }
  async function loadUsers(db:any)  { const { collection,getDocs,query,orderBy } = await import("firebase/firestore"); const s=await getDocs(query(collection(db,"users"),orderBy("createdAt","desc")));         setUsers(s.docs.map(d=>({id:d.id,...d.data()} as User)).filter(u=>(u as any).role==="student")); }
  async function loadLogs(db:any)   { const { collection,getDocs,query,orderBy,limit } = await import("firebase/firestore"); const s=await getDocs(query(collection(db,"logs"),orderBy("timestamp","desc"),limit(300)));   setLogs(s.docs.map(d=>({id:d.id,...d.data()} as Log))); }
  async function loadLogins(db:any) { const { collection,getDocs,query,orderBy,limit } = await import("firebase/firestore"); const s=await getDocs(query(collection(db,"logins"),orderBy("timestamp","desc"),limit(300))); setLogins(s.docs.map(d=>({id:d.id,...d.data()} as Login))); }

  function flash(msg:string,ok=true) { setToast({msg,ok}); setTimeout(()=>setToast({msg:"",ok:true}),3500); }

  function fmt(ts:any)  { if(!ts?.toDate) return "—"; return ts.toDate().toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"}); }
  function fmtT(ts:any) { if(!ts?.toDate) return "—"; return ts.toDate().toLocaleString("en-PH",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}); }

  function filterPeriod<T extends {timestamp:any}>(list:T[]):T[] {
    if(per==="all") return list;
    const cut=new Date();
    if(per==="daily")   cut.setDate(cut.getDate()-1);
    if(per==="weekly")  cut.setDate(cut.getDate()-7);
    if(per==="monthly") cut.setMonth(cut.getMonth()-1);
    return list.filter(l=>{const t=l.timestamp?.toDate?.()??new Date(l.timestamp);return t>=cut;});
  }

  async function upload() {
    if (!file || !title.trim()) return;
    setUping(true); setUpErr(""); setUpPct(10);
    try {
      const { supabase } = await import("@/lib/supabase");
      const path = `docs/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("cics-documents").upload(path, file, { contentType:file.type });
      if (error) throw new Error(error.message);
      setUpPct(70);
      const { data:{ publicUrl } } = supabase.storage.from("cics-documents").getPublicUrl(path);
      setUpPct(90);
      const { db } = await import("@/lib/firebase");
      if (!db) throw new Error("DB not ready");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      const programs = progs.includes("All") ? ["CS","IT","IS","EMC"] : progs;
      await addDoc(collection(db,"documents"), {
        title:title.trim(), category:cat, programs,
        fileURL:publicUrl, storagePath:path,
        uploadedBy:admin.uid, createdAt:serverTimestamp(),
      });
      setUpPct(100);
      flash(`"${title}" uploaded!`);
      setFile(null); setTitle(""); setCat("Announcement"); setProgs(["All"]);
      await loadDocs(db);
    } catch (e:any) {
      setUpErr(e.message||"Upload failed. Try again.");
    } finally { setUping(false); setUpPct(0); }
  }

  async function delDoc(d:Doc) {
    if (!confirm(`Delete "${d.title}"?`)) return;
    const { supabase } = await import("@/lib/supabase");
    const { db }       = await import("@/lib/firebase");
    if (!db) return;
    const { doc, deleteDoc } = await import("firebase/firestore");
    await supabase.storage.from("cics-documents").remove([d.storagePath]);
    await deleteDoc(doc(db,"documents",d.id));
    flash(`"${d.title}" deleted.`,false);
    await loadDocs(db);
  }

  async function toggleBlock(u:User) {
    const { db }      = await import("@/lib/firebase");
    if (!db) return;
    const { doc, updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(db,"users",u.id),{ isBlocked:!u.isBlocked });
    flash(u.isBlocked?`${u.displayName} unblocked.`:`${u.displayName} blocked.`, u.isBlocked);
    await loadUsers(db);
  }

  async function logout() {
    const { auth } = await import("@/lib/firebase");
    if (!auth) return;
    const { signOut } = await import("firebase/auth");
    await signOut(auth);
    router.replace("/");
  }

  if (loading) return <div className="loader"><div className="spin" /></div>;

  const fd  = docs.filter(d=>!ds||d.title.toLowerCase().includes(ds.toLowerCase()));
  const fu  = users.filter(u=>!us||u.displayName?.toLowerCase().includes(us.toLowerCase())||u.email?.toLowerCase().includes(us.toLowerCase()));
  const fl  = filterPeriod(logs);
  const fli = filterPeriod(logins);
  const today = new Date().toDateString();
  const LABELS:Record<Tab,string> = {dashboard:"Dashboard",upload:"Upload Document",documents:"Documents",students:"Students",logs:"Activity Logs"};

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
          <div><div className="sb-brand">CICS Vault</div><div className="sb-sub" style={{ color:"var(--green2)" }}>Admin Panel</div></div>
        </div>

        <nav className="sb-nav">
          {(["dashboard","upload","documents","students","logs"] as Tab[]).map(t=>(
            <button key={t} className={`sb-item${tab===t?" on":""}`} onClick={()=>setTab(t)}>
              {t==="dashboard" && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
              {t==="upload"    && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>}
              {t==="documents" && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>}
              {t==="students"  && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
              {t==="logs"      && <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
              {LABELS[t]}
            </button>
          ))}
        </nav>

        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-av">{(admin?.displayName||"A")[0]}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div className="sb-name">{admin?.displayName}</div>
              <div className="sb-sub" style={{ color:"var(--green2)" }}>Administrator</div>
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
          <span className="topbar-title">{LABELS[tab]}</span>
          <span className="badge b-green">Admin</span>
        </header>

        <div className="page">

          {/* DASHBOARD */}
          {tab==="dashboard" && (
            <div className="anim">
              <div className="ph"><div><div className="ph-h">Dashboard</div><div className="ph-sub">System overview</div></div></div>
              <div className="stats">
                {[
                  {lbl:"Total Documents",val:docs.length,  col:"#3b82f6"},
                  {lbl:"Students",       val:users.length,  col:"#10c981"},
                  {lbl:"Downloads",      val:logs.length,   col:"#fbbf24"},
                  {lbl:"Logins Today",   val:logins.filter(l=>l.timestamp?.toDate?.()?.toDateString()===today).length, col:"#8b5cf6"},
                ].map(s=>(
                  <div key={s.lbl} className="stat">
                    <div className="stat-ico" style={{ background:`${s.col}18`, color:s.col }}>
                      <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                    </div>
                    <div><div className="stat-val">{s.val}</div><div className="stat-lbl">{s.lbl}</div></div>
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
                <div className="card">
                  <div style={{ fontSize:13.5, fontWeight:700, marginBottom:13 }}>Recent uploads</div>
                  {docs.slice(0,6).map(d=>(
                    <div key={d.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--green)", flexShrink:0 }}/>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12.5, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.title}</div>
                        <div style={{ fontSize:11, color:"var(--text2)" }}>{d.category} · {fmt(d.createdAt)}</div>
                      </div>
                    </div>
                  ))}
                  {docs.length===0 && <p style={{ fontSize:13, color:"var(--text2)" }}>No documents yet.</p>}
                </div>
                <div className="card">
                  <div style={{ fontSize:13.5, fontWeight:700, marginBottom:13 }}>Recent logins</div>
                  {logins.slice(0,6).map((l,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 0", borderBottom:"1px solid var(--border)" }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:"var(--blue2)", flexShrink:0 }}/>
                      <div><div style={{ fontSize:12.5, fontWeight:600 }}>{l.email}</div><div style={{ fontSize:11, color:"var(--text2)" }}>{fmtT(l.timestamp)}</div></div>
                    </div>
                  ))}
                  {logins.length===0 && <p style={{ fontSize:13, color:"var(--text2)" }}>No logins yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* UPLOAD */}
          {tab==="upload" && (
            <div className="anim" style={{ maxWidth:600 }}>
              <div className="ph"><div><div className="ph-h">Upload Document</div><div className="ph-sub">Add a PDF to CICS Vault</div></div></div>
              <div className="card">
                {upErr && <div className="alert alert-error">{upErr}</div>}
                <div
                  className={`drop${file?" ready":""}`}
                  onClick={()=>document.getElementById("fi")?.click()}
                  onDragOver={e=>e.preventDefault()}
                  onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f?.type==="application/pdf")setFile(f);else setUpErr("Only PDF files allowed.");}}
                >
                  <svg width="32" height="32" fill="none" stroke={file?"var(--green)":"var(--text2)"} strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin:"0 auto 9px", display:"block" }}>
                    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
                    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
                  </svg>
                  {file
                    ? <><div style={{ fontWeight:700, fontSize:14, color:"var(--green)" }}>{file.name}</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>{(file.size/1024/1024).toFixed(2)} MB · <button style={{ color:"var(--red)", background:"none", border:"none", cursor:"pointer", fontSize:12 }} onClick={e=>{e.stopPropagation();setFile(null);}}>Remove</button></div></>
                    : <><div style={{ fontWeight:700, fontSize:14 }}>Drop PDF here or click to browse</div><div style={{ fontSize:12, color:"var(--text2)", marginTop:4 }}>PDF only · Max 50MB</div></>}
                </div>
                <input id="fi" type="file" accept=".pdf" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)setFile(f);}}/>

                <div className="field">
                  <label className="label">Document Title *</label>
                  <input className="input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Course Syllabus — CS 401"/>
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
                  <div className="field">
                    <label className="label">Category *</label>
                    <select className="select" value={cat} onChange={e=>setCat(e.target.value)}>
                      {CATS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="label">Programs</label>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:5, paddingTop:5 }}>
                      {["All",...PROGS].map(p=>(
                        <button key={p} onClick={()=>{
                          if(p==="All"){setProgs(["All"]);return;}
                          const cur=progs.filter(x=>x!=="All");
                          const nxt=cur.includes(p)?cur.filter(x=>x!==p):[...cur,p];
                          setProgs(nxt.length===0?["All"]:nxt);
                        }} style={{
                          padding:"4px 9px", borderRadius:5, fontSize:12, fontWeight:700, cursor:"pointer",
                          background:progs.includes(p)?"rgba(29,107,243,0.13)":"var(--surface2)",
                          border:`1px solid ${progs.includes(p)?"var(--blue)":"var(--border)"}`,
                          color:progs.includes(p)?"var(--blue2)":"var(--text2)",
                          transition:"all 0.15s",
                        }}>{p}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {uping && (
                  <div style={{ marginBottom:15 }}>
                    <div className="prog-wrap"><div className="prog-bar" style={{ width:`${upPct}%` }}/></div>
                    <div style={{ fontSize:12, color:"var(--text2)", marginTop:5 }}>Uploading… {upPct}%</div>
                  </div>
                )}

                <div style={{ display:"flex", gap:9 }}>
                  <button className="btn btn-green" onClick={upload} disabled={!file||!title.trim()||uping} style={{ flex:1, padding:11 }}>
                    {uping?<><div className="spin" style={{ width:14, height:14, borderTopColor:"white" }}/>Uploading…</>:"Upload Document"}
                  </button>
                  <button className="btn btn-ghost" onClick={()=>{setFile(null);setTitle("");setUpErr("");}}>Clear</button>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS */}
          {tab==="documents" && (
            <div className="anim">
              <div className="ph">
                <div><div className="ph-h">Documents</div><div className="ph-sub">{fd.length} total</div></div>
                <button className="btn btn-blue btn-sm" onClick={()=>setTab("upload")}>+ Upload New</button>
              </div>
              <div style={{ marginBottom:14 }}>
                <div className="search" style={{ maxWidth:300 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input className="input" value={ds} onChange={e=>setDs(e.target.value)} placeholder="Search…"/>
                </div>
              </div>
              <div className="tbl">
                <table>
                  <thead><tr><th>Title</th><th>Category</th><th>Programs</th><th>Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {fd.length===0
                      ? <tr><td colSpan={5}><div style={{ padding:"26px 0", textAlign:"center", color:"var(--text2)", fontSize:13 }}>No documents yet.</div></td></tr>
                      : fd.map(d=>(
                          <tr key={d.id}>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                                <div style={{ width:28, height:28, background:"rgba(240,82,82,0.1)", borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                                  <svg width="12" height="12" fill="none" stroke="#f05252" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
                                </div>
                                <span style={{ fontWeight:600 }}>{d.title}</span>
                              </div>
                            </td>
                            <td><CatBadge c={d.category}/></td>
                            <td><span style={{ fontSize:12, color:"var(--text2)" }}>{d.programs?.join(", ")||"All"}</span></td>
                            <td><span style={{ fontSize:12, color:"var(--text2)" }}>{fmt(d.createdAt)}</span></td>
                            <td>
                              <div style={{ display:"flex", gap:6 }}>
                                <a href={d.fileURL} target="_blank" style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:30, height:30, background:"var(--surface2)", border:"1.5px solid var(--border)", borderRadius:6, color:"var(--text2)", textDecoration:"none" }}>
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </a>
                                <button onClick={()=>delDoc(d)} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:30, height:30, background:"rgba(240,82,82,0.08)", border:"1.5px solid rgba(240,82,82,0.2)", borderRadius:6, color:"var(--red)", cursor:"pointer" }}>
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STUDENTS */}
          {tab==="students" && (
            <div className="anim">
              <div className="ph"><div><div className="ph-h">Students</div><div className="ph-sub">{fu.length} registered</div></div></div>
              <div style={{ marginBottom:14 }}>
                <div className="search" style={{ maxWidth:300 }}>
                  <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <input className="input" value={us} onChange={e=>setUs(e.target.value)} placeholder="Search by name or email…"/>
                </div>
              </div>
              <div className="tbl">
                <table>
                  <thead><tr><th>Student</th><th>Program</th><th>Joined</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {fu.length===0
                      ? <tr><td colSpan={5}><div style={{ padding:"26px 0", textAlign:"center", color:"var(--text2)", fontSize:13 }}>No students yet.</div></td></tr>
                      : fu.map(u=>(
                          <tr key={u.id}>
                            <td>
                              <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                                {u.photoURL
                                  ? <img src={u.photoURL} alt="" style={{ width:28, height:28, borderRadius:7, objectFit:"cover" }}/>
                                  : <div style={{ width:28, height:28, borderRadius:7, background:"var(--surface3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"var(--blue2)" }}>{(u.displayName||"?")[0]}</div>}
                                <div>
                                  <div style={{ fontSize:13.5, fontWeight:600 }}>{u.displayName}</div>
                                  <div style={{ fontSize:11, color:"var(--text2)" }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td><span className="badge b-blue">{u.program||"—"}</span></td>
                            <td><span style={{ fontSize:12, color:"var(--text2)" }}>{fmt(u.createdAt)}</span></td>
                            <td><span className={`badge ${u.isBlocked?"b-red":"b-green"}`}>{u.isBlocked?"Blocked":"Active"}</span></td>
                            <td>
                              <button className={`btn btn-sm ${u.isBlocked?"btn-green":"btn-danger"}`} onClick={()=>toggleBlock(u)}>
                                {u.isBlocked?"Unblock":"Block"}
                              </button>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* LOGS */}
          {tab==="logs" && (
            <div className="anim">
              <div className="ph">
                <div><div className="ph-h">Activity Logs</div><div className="ph-sub">Monitor downloads and logins</div></div>
                <select className="select" value={per} onChange={e=>setPer(e.target.value)} style={{ width:"auto" }}>
                  <option value="all">All time</option>
                  <option value="daily">Last 24 hours</option>
                  <option value="weekly">Last 7 days</option>
                  <option value="monthly">Last 30 days</option>
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:700, marginBottom:11 }}>Downloads <span className="badge b-yellow" style={{ marginLeft:6 }}>{fl.length}</span></div>
                  <div className="tbl">
                    <table>
                      <thead><tr><th>Student</th><th>Document</th><th>Time</th></tr></thead>
                      <tbody>
                        {fl.length===0
                          ? <tr><td colSpan={3}><div style={{ padding:"16px 0", textAlign:"center", color:"var(--text2)", fontSize:13 }}>No downloads yet.</div></td></tr>
                          : fl.map((l,i)=>(
                              <tr key={i}>
                                <td style={{ fontSize:12.5 }}>{l.userEmail?.split("@")[0]||"—"}</td>
                                <td style={{ fontSize:12, color:"var(--text2)", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{l.documentTitle||"—"}</td>
                                <td style={{ fontSize:11.5, color:"var(--text2)" }}>{fmtT(l.timestamp)}</td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:13.5, fontWeight:700, marginBottom:11 }}>Logins <span className="badge b-blue" style={{ marginLeft:6 }}>{fli.length}</span></div>
                  <div className="tbl">
                    <table>
                      <thead><tr><th>Email</th><th>Time</th></tr></thead>
                      <tbody>
                        {fli.length===0
                          ? <tr><td colSpan={2}><div style={{ padding:"16px 0", textAlign:"center", color:"var(--text2)", fontSize:13 }}>No logins yet.</div></td></tr>
                          : fli.map((l,i)=>(
                              <tr key={i}>
                                <td style={{ fontSize:12.5 }}>{l.email}</td>
                                <td style={{ fontSize:11.5, color:"var(--text2)" }}>{fmtT(l.timestamp)}</td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {toast.msg && (
        <div id="toasts">
          <div className={`toast ${toast.ok?"toast-ok":"toast-err"}`}>
            <div className="dot" style={{ background:toast.ok?"var(--green)":"var(--red)" }}/>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function CatBadge({c}:{c:string}) {
  const col=CAT_COL[c]||"#6b7280";
  return <span style={{ padding:"2px 8px", background:`${col}18`, border:`1px solid ${col}30`, borderRadius:5, fontSize:11, fontWeight:700, color:col }}>{c}</span>;
}
