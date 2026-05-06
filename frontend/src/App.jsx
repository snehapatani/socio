import { useState, useEffect, useCallback } from "react";
import { api, getConnectUrl } from "./lib/api.js";

// ── Helpers ──────────────────────────────────────────────────────────
const BID_KEY = "socio_business_id";
const getBid  = () => localStorage.getItem(BID_KEY);
const setBid  = (id) => { localStorage.setItem(BID_KEY, id); };

function fmt(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function num(n) {
  if (!n) return "0";
  return n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(n);
}

// ── Status pill ───────────────────────────────────────────────────────
const STATUS_STYLE = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  approved:  "bg-blue-50 text-blue-700 border-blue-200",
  scheduled: "bg-purple-50 text-purple-700 border-purple-200",
  published: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed:    "bg-red-50 text-red-700 border-red-200",
};
function StatusPill({ status }) {
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
      {status}
    </span>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────
function Logo({ size = 32 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "#1D9E75", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" fill="white" opacity=".95"/>
        <path d="M4 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="white" strokeWidth="1.6" strokeLinecap="round" opacity=".6"/>
        <circle cx="15.5" cy="5.5" r="2" fill="white" opacity=".45"/>
        <path d="M17.5 11c1.3 1.1 2.1 2.7 2.1 4.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity=".35"/>
      </svg>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────
function Toast({ msg, type = "ok", onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium z-50 flex items-center gap-2 ${type === "ok" ? "bg-emerald-600 text-white" : "bg-red-500 text-white"}`}>
      {type === "ok" ? "✓" : "✕"} {msg}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SCREEN 1 · Onboarding
// ═════════════════════════════════════════════════════════════════════
function Onboarding({ onDone }) {
  const [step, setStep]   = useState(1);
  const [busy, setBusy]   = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    name: "", business_type: "restaurant", specialty: "",
    brand_tone: "warm_friendly", weekly_specials: "", owner_email: "",
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const TONES = [
    { id: "warm_friendly", label: "Warm & friendly" },
    { id: "upbeat",        label: "Upbeat & fun" },
    { id: "elegant",       label: "Elegant & refined" },
    { id: "bold_casual",   label: "Bold & casual" },
  ];
  const TYPES = ["restaurant", "salon", "gym", "cafe", "retail", "other"];

  async function submit() {
    if (!form.name || !form.owner_email) { setToast({ msg: "Name and email are required", type: "err" }); return; }
    setBusy(true);
    try {
      const biz = await api.createBusiness({
          name:          form.name,
          owner_email:   form.owner_email,
          business_type: form.business_type,
          brand_tone:    form.brand_tone,
          business_context: {
              specialty:       form.specialty       || undefined,
              weekly_specials: form.weekly_specials || undefined,
          },
      });
      setBid(biz.id);
      onDone(biz.id);
    } catch (e) {
      setToast({ msg: e.message, type: "err" });
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col items-center justify-center p-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Logo size={40} />
          <div>
            <div className="text-xl font-semibold text-gray-900 tracking-tight">Socio</div>
            <div className="text-xs text-gray-400">AI social media manager</div>
          </div>
        </div>

        {/* Progress */}
        <div className="flex gap-1.5 mb-6">
          {[1,2,3].map(n => (
            <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= step ? "bg-[#1D9E75]" : "bg-gray-200"}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Step 1 */}
          {step === 1 && (
            <div className="p-6">
              <div className="text-[11px] font-semibold text-[#1D9E75] tracking-widest mb-1">STEP 1 OF 3</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-5">About your business</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">Business name *</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition" placeholder="e.g. Mia's Kitchen" value={form.name} onChange={e => set("name", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">Business type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {TYPES.map(t => (
                      <button key={t} onClick={() => set("business_type", t)} className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition ${form.business_type === t ? "bg-[#E1F5EE] border-[#1D9E75] text-[#085041]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">Specialty / cuisine</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition" placeholder="e.g. Italian, Hair & Color, CrossFit" value={form.cuisine_or_specialty} onChange={e => set("cuisine_or_specialty", e.target.value)} />
                </div>
              </div>
              <button onClick={() => { if (!form.name) { setToast({ msg: "Enter your business name", type: "err" }); return; } setStep(2); }} className="w-full mt-6 bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition">
                Continue →
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="p-6">
              <div className="text-[11px] font-semibold text-[#1D9E75] tracking-widest mb-1">STEP 2 OF 3</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Brand voice</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-2 block">Brand Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TONES.map(t => (
                      <button key={t.id} onClick={() => set("brand_tone", t.id)} className={`py-2.5 px-3 rounded-lg border text-xs font-medium transition ${form.brand_tone === t.id ? "bg-[#E1F5EE] border-[#1D9E75] text-[#085041]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{t.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1.5 block">Weekly specials or promotions</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition resize-none h-20" placeholder="Happy hour 4–7pm Mon–Fri, new truffle pasta, live music Fridays…" value={form.weekly_specials} onChange={e => set("weekly_specials", e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setStep(1)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition">← Back</button>
                <button onClick={() => setStep(3)} className="flex-[2] bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition">Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="p-6">
              <div className="text-[11px] font-semibold text-[#1D9E75] tracking-widest mb-1">STEP 3 OF 3</div>
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Your email for approvals</h2>
              <div className="bg-[#F7F8F6] rounded-xl p-4 mb-5 text-xs text-gray-500 leading-relaxed">
                Every Sunday evening you'll get an email with 3 ready-to-post captions. One tap to approve the whole week. No login needed.
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Owner email *</label>
                <input type="email" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#1D9E75] transition" placeholder="you@yourbusiness.com" value={form.owner_email} onChange={e => set("owner_email", e.target.value)} />
              </div>
              <div className="flex gap-2 mt-6">
                <button onClick={() => setStep(2)} className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50 transition">← Back</button>
                <button onClick={submit} disabled={busy} className="flex-[2] bg-[#1D9E75] text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition disabled:opacity-60">
                  {busy ? "Setting up…" : "Get started →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SCREEN 2 · Connect Instagram
// ═════════════════════════════════════════════════════════════════════
function ConnectInstagram({ businessId, business, onConnected }) {
  const params = new URLSearchParams(window.location.search);
  const error  = params.get("error");

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <Logo size={48} />
        <h2 className="text-xl font-semibold text-gray-900 mt-5 mb-2">Connect Instagram</h2>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          Link <strong>{business?.name}</strong>'s Instagram Business account so Socio can publish posts on your behalf.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5 text-xs text-red-700">
            Connection failed: {error.replace(/_/g, " ")}. Please try again.
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-5 text-left space-y-3">
          {["Instagram must be a Professional (Business or Creator) account", "Must be linked to a Facebook Page", "Facebook account must be an admin of that Page"].map((req, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-4 h-4 rounded-full bg-[#E1F5EE] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="#1D9E75" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span className="text-xs text-gray-600 leading-relaxed">{req}</span>
            </div>
          ))}
        </div>

        <a href={getConnectUrl(businessId)} className="block w-full bg-[#1D9E75] text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition text-center">
          Connect with Facebook →
        </a>
        <button onClick={onConnected} className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition">
          Skip for now (use test data)
        </button>
      </div>
    </div>
  );
}


// ═════════════════════════════════════════════════════════════════════
// Upload Photos
// ═════════════════════════════════════════════════════════════════════
function UploadMedia({ businessId, business, onReady }) {
  const [media, setMedia] = useState([]); // [{url, name, type}]
  const [uploading, setUpl] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleFile(file) {
    if (media.length >= 3) return;
    setUpl(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.uploadMedia(businessId, fd);

      // Store the file type to decide how to render the preview
      setMedia(m => [...m, {
        url: res.media_url,
        name: file.name,
        type: file.type
      }]);

      if (res.ready) setToast({ msg: "All 3 media uploaded! Socio will generate your posts tonight." });
    } catch(e) {
      setToast({ msg: e.message, type: "err" });
    } finally { setUpl(false); }
  }

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col items-center justify-center p-4">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Logo size={44} />
          <h2 className="text-xl font-semibold text-gray-900 mt-4 mb-2">Upload 3 media files</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            Socio will write captions for your photos and videos and schedule them for the best times.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {[0, 1, 2].map(i => (
            <label key={i} className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition ${
              media[i]
                ? "border-[#1D9E75] bg-[#E1F5EE]"
                : "border-dashed border-gray-300 bg-white hover:border-[#1D9E75]"
            }`}>
              {media[i] ? (
                <>
                  {/* Conditional rendering for Photo vs Video preview */}
                  {media[i].type.startsWith("video") ? (
                    <video src={media[i].url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <img src={media[i].url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div>
                    <div className="text-xs font-semibold text-[#085041]">
                      {media[i].type.startsWith("video") ? "Video" : "Photo"} {i + 1} uploaded ✓
                    </div>
                    <div className="text-[11px] text-[#0F6E56] truncate max-w-[200px]">{media[i].name}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-xl">{i + 1}</span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">
                      {uploading && media.length === i ? "Uploading…" : `Media ${i + 1}`}
                    </div>
                    <div className="text-xs text-gray-400">Tap to choose photo or video</div>
                  </div>
                </>
              )}
              <input
                type="file"
                accept="image/*,video/*" // Now accepts both
                className="hidden"
                disabled={!!media[i] || uploading}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          ))}
        </div>

        {media.length === 3 ? (
          <button onClick={onReady} className="w-full bg-[#1D9E75] text-white py-3.5 rounded-xl font-semibold text-sm hover:opacity-90 transition">
            Done — go to dashboard →
          </button>
        ) : (
          <div className="text-center text-sm text-gray-400">
            {3 - media.length} more item{3 - media.length !== 1 ? "s" : ""} needed
          </div>
        )}

        <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
          Socio generates posts at 8pm Sunday. You can mix and match photos and videos.
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SCREEN 3 · Posts tab
// ═════════════════════════════════════════════════════════════════════
function PostsTab({ businessId, igPage, onUploadMore }) {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [generating, setGen]    = useState(false);
  const [generatingImage, setGenAI]    = useState(false);
  const [toast, setToast]       = useState(null);
  const [editPost, setEditPost] = useState(null);   // { id, caption, media_url }
  const [uploading, setUploading] = useState({});
  const [uploadNewPhotos, setUploadNewPhotos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPosts(await api.listPosts(businessId)); }
    catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setLoading(false); }
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGen(true);
    try {
      await api.generatePosts(businessId);
      await load();
      setToast({ msg: "3 posts generated!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setGen(false); }
  }

  async function generateImage() {
    setGenAI(true);
    try {
      await api.generateAIImage(businessId);
      await load();
      setToast({ msg: "3 posts generated!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setGenAI(false); }
  }


  async function handleButtonClick() {
    setUploadNewPhotos(true);
    try {
      onUploadMore();
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setUploadNewPhotos(false); }
  }

  async function uploadImage(postId, file) {
    setUploading(u => ({ ...u, [postId]: true }));
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await api.uploadMedia(businessId, fd);
      await api.updatePost(postId, { media_url: res.media_url, media_storage_path: res.media_storage_path });
      await load();
      setToast({ msg: "Image uploaded!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setUploading(u => ({ ...u, [postId]: false })); }
  }

  async function sendApproval() {
    const pending = posts.filter(p => p.status === "pending").map(p => p.id);
    if (!pending.length) { setToast({ msg: "No pending posts to approve", type: "err" }); return; }
    try {
      await api.sendApproval({ business_id: businessId, post_ids: pending });
      setToast({ msg: "Approval email sent!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
  }

  async function saveEdit() {
    try {
      await api.updatePost(editPost.id, { caption: editPost.caption });
      setEditPost(null);
      await load();
      setToast({ msg: "Caption saved" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
  }

  const pending   = posts.filter(p => p.status === "pending");
  const rest      = posts.filter(p => p.status !== "pending");

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* Actions bar */}
      <div className="flex gap-2 mb-5">
        <button onClick={handleButtonClick} disabled={uploadNewPhotos} className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition flex items-center justify-center gap-2">
          {uploadNewPhotos ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Upload Media</> : "Upload Image"}
        </button>
        <button onClick={generateImage} disabled={generatingImage} className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition flex items-center justify-center gap-2">
          {generatingImage ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Generating…</> : "✦ Generate AI Image"}
        </button>
        <button onClick={generate} disabled={generating} className="flex-1 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition flex items-center justify-center gap-2">
          {generating ? <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Generating…</> : "✦ Generate this week's posts"}
        </button>
        {pending.length > 0 && (
          <button onClick={sendApproval} className="px-4 py-2.5 border border-[#1D9E75] text-[#1D9E75] rounded-xl text-sm font-semibold hover:bg-[#E1F5EE] transition">
            Send approval email
          </button>
        )}
      </div>
      {/* No IG warning */}
      {!igPage?.is_active && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700 flex items-center gap-2">
          ⚠ Instagram not connected — posts will be saved but not published until you connect.
        </div>
      )}

      {loading && <div className="text-sm text-gray-400 text-center py-12">Loading posts…</div>}

      {!loading && posts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">✦</div>
          <div className="text-sm text-gray-500">No posts yet. Hit generate to create this week's content.</div>
        </div>
      )}

      {/* Pending posts */}
      {pending.length > 0 && (
        <>
          <div className="text-[11px] font-semibold text-gray-400 tracking-widest mb-3">NEEDS APPROVAL</div>
          {pending.map(post => <PostCard key={post.id} post={post} onEdit={setEditPost} onUpload={uploadImage} uploading={uploading[post.id]} onRefresh={load} setToast={setToast} />)}
        </>
      )}

      {/* Other posts */}
      {rest.length > 0 && (
        <>
          <div className="text-[11px] font-semibold text-gray-400 tracking-widest mb-3 mt-6">SCHEDULED / PUBLISHED</div>
          {rest.map(post => <PostCard key={post.id} post={post} onEdit={setEditPost} onUpload={uploadImage} uploading={uploading[post.id]} onRefresh={load} setToast={setToast} />)}
        </>
      )}

      {/* Edit modal */}
      {editPost && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-end" onClick={() => setEditPost(null)}>
          <div className="bg-white w-full rounded-t-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="text-sm font-semibold text-gray-900 mb-3">Edit caption</div>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-32 outline-none focus:border-[#1D9E75]" value={editPost.caption} onChange={e => setEditPost(ep => ({ ...ep, caption: e.target.value }))} />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setEditPost(null)} className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm text-gray-600">Cancel</button>
              <button onClick={saveEdit} className="flex-[2] bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onEdit, onUpload, uploading, onRefresh, setToast }) {
  const hasImage = !!post.media_url;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3">
      {/* Image area */}
      {post.media_type === "VIDEO" ? (
        <div className="w-full h-full relative">
          {/* Video Thumbnail: #t=0.1 seekers the first frame */}
          <video src={`${post.media_url}#t=0.1`} className="w-full h-full object-cover" preload="metadata"/>

          {/* Play Icon Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/10">
            <div className="bg-white/90 p-2.5 rounded-full shadow-lg group-hover:scale-110 transition-transform duration-200">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1D9E75">
                <path d="M8 5.14v14l11-7-11-7z" />
              </svg>
            </div>
          </div>

          {(
          <label className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-medium">Change Video</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])} />
          </label>
        )}
        </div>
        ) : (
        <div className="w-full h-36 bg-gray-50 flex items-center justify-center relative group overflow-hidden">
        {hasImage ? (
          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-1.5 text-gray-300 hover:text-gray-400 transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21,15 16,10 5,21"/></svg>
            <span className="text-[11px]">{uploading ? "Uploading…" : "Upload photo"}</span>
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])} />
          </label>
        )}
        {hasImage && (
          <label className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-medium">Change photo</span>
            <input type="file" accept="video/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])} />
          </label>
        )}
      </div>
        )}

      {/* <div className="w-full h-36 bg-gray-50 flex items-center justify-center relative group overflow-hidden">
        {hasImage ? (
          <img src={post.media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-1.5 text-gray-300 hover:text-gray-400 transition">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21,15 16,10 5,21"/></svg>
            <span className="text-[11px]">{uploading ? "Uploading…" : "Upload photo"}</span>
            <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])} />
          </label>
        )}
        {hasImage && (
          <label className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100">
            <span className="text-white text-xs font-medium">Change photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && onUpload(post.id, e.target.files[0])} />
          </label>
        )}
      </div> */}



      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-gray-400">{fmt(post.scheduled_at)}</span>
          <StatusPill status={post.status} />
        </div>
        <p className="text-sm text-gray-700 leading-relaxed line-clamp-3 mb-3">{post.caption}</p>
        {post.hashtags?.length > 0 && (
          <p className="text-[11px] text-blue-500 mb-3">{post.hashtags.slice(0,5).map(h => `#${h}`).join(" ")}</p>
        )}
        {post.post_theme && (
          <p className="text-[11px] text-gray-400 mb-3 italic">💡 {post.post_theme}</p>
        )}
        {post.ig_permalink && (
          <a href={post.ig_permalink} target="_blank" rel="noreferrer" className="text-[11px] text-[#1D9E75] hover:underline">View on Instagram →</a>
        )}
        {post.status === "pending" && (
          <div className="flex gap-2 mt-1">
            <button onClick={() => onEdit(post)} className="flex-1 border border-gray-200 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 transition">Edit</button>
          </div>
        )}
        {post.status === "failed" && post.error_message && (
          <div className="mt-2 text-[10px] text-red-500 bg-red-50 rounded-lg p-2">{post.error_message}</div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SCREEN 4 · Dashboard tab
// ═════════════════════════════════════════════════════════════════════
function DashboardTab({ businessId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);

  useEffect(() => {
    api.getDashboard(businessId)
       .then(setData)
       .catch(e => setToast({ msg: e.message, type: "err" }))
       .finally(() => setLoading(false));
  }, [businessId]);

  if (loading) return <div className="text-sm text-gray-400 text-center py-16">Loading…</div>;
  if (!data)   return <div className="text-sm text-gray-400 text-center py-16">No data</div>;

  const ig  = data.instagram_page;
  const s   = data.status_counts;

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* IG profile strip */}
      {ig && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center gap-3">
          {ig.profile_picture_url ? (
            <img src={ig.profile_picture_url} alt="" className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#378ADD] flex items-center justify-center text-white text-sm font-bold">IG</div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">@{ig.ig_username}</div>
            <div className="text-xs text-gray-400">{ig.followers_count?.toLocaleString()} followers</div>
          </div>
          <div className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ig.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {ig.is_active ? "Connected" : "Disconnected"}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { label: "Published",  val: data.total_published },
          { label: "Est. reach", val: num(data.total_reach) },
          { label: "Saves",      val: num(data.total_saves) },
        ].map(({ label, val }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <div className="text-xl font-semibold text-gray-900">{val}</div>
            <div className="text-[11px] text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Post pipeline */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-3">Post pipeline</div>
        <div className="space-y-2">
          {[["pending","Pending approval"],["approved","Approved"],["scheduled","Scheduled"],["published","Published"],["failed","Failed"]].map(([k, label]) => (
            <div key={k} className="flex items-center gap-2.5">
              <StatusPill status={k} />
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#1D9E75] rounded-full transition-all" style={{ width: `${Math.min(100, (s[k] || 0) * 20)}%` }} />
              </div>
              <span className="text-xs text-gray-500 w-4 text-right">{s[k] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* This week's posts */}
      {data.posts_this_week?.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="text-xs font-semibold text-gray-500 mb-3">This week</div>
          <div className="space-y-2.5">
            {data.posts_this_week.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-700 truncate">{p.caption?.slice(0,60)}…</div>
                  <div className="text-[10px] text-gray-400">{fmt(p.scheduled_at)}</div>
                </div>
                <StatusPill status={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// SCREEN 5 · Settings tab
// ═════════════════════════════════════════════════════════════════════
function SettingsTab({ businessId, business, igPage }) {
  const [form, setForm]   = useState({ weekly_specials: business?.business_context?.weekly_specials || "", brand_tone: business?.brand_tone || "warm_friendly" });
  const [saving, setSav]  = useState(false);
  const [toast, setToast] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const TONES = [["warm_friendly","Warm & friendly"],["upbeat","Upbeat & fun"],["elegant","Elegant & refined"],["bold_casual","Bold & casual"]];

  async function save() {
    setSav(true);
    try {
      await api.updateBusiness(businessId, form);
      setToast({ msg: "Saved!" });
    } catch (e) { setToast({ msg: e.message, type: "err" }); }
    finally { setSav(false); }
  }

  return (
    <div className="p-4 max-w-2xl mx-auto pb-24">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="text-xs font-semibold text-gray-500 mb-4">Brand voice</div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-gray-500 font-medium mb-2 block">Brand Tone</label>
            <div className="grid grid-cols-2 gap-2">
              {TONES.map(([id, label]) => (
                <button key={id} onClick={() => set("brand_tone", id)} className={`py-2 px-3 rounded-lg border text-xs font-medium transition ${form.brand_tone === id ? "bg-[#E1F5EE] border-[#1D9E75] text-[#085041]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Weekly specials / promotions</label>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 outline-none focus:border-[#1D9E75]" value={form.weekly_specials} onChange={e => set("weekly_specials", e.target.value)} />
          </div>
        </div>
        <button onClick={save} disabled={saving} className="mt-4 w-full bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition">
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {/* IG connection */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="text-xs font-semibold text-gray-500 mb-3">Instagram connection</div>
        {igPage?.is_active ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1D9E75] to-[#378ADD] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">IG</div>
            <div>
              <div className="text-sm font-medium text-gray-900">@{igPage.ig_username}</div>
              <div className="text-xs text-gray-400">Connected · {igPage.followers_count?.toLocaleString()} followers</div>
            </div>
          </div>
        ) : (
          <a href={getConnectUrl(businessId)} className="block w-full text-center bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition">
            Connect Instagram →
          </a>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════
// MAIN APP SHELL
// ═════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "dashboard", label: "Dashboard", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on?"#1D9E75":"#9ca3af"} strokeWidth="1.5"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>
  )},
  { id: "posts", label: "Posts", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on?"#1D9E75":"#9ca3af"} strokeWidth="1.5"><rect x="2" y="2" width="16" height="16" rx="2.5"/><path d="M5 7h10M5 10.5h7M5 14h5" strokeLinecap="round"/></svg>
  )},
  { id: "settings", label: "Settings", icon: (on) => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={on?"#1D9E75":"#9ca3af"} strokeWidth="1.5"><circle cx="10" cy="10" r="2.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" strokeLinecap="round"/></svg>
  )},
];

export default function App() {
  const [businessId, setBusinessId] = useState(() => getBid());
  const [business,   setBusiness]   = useState(null);
  const [igPage,     setIgPage]     = useState(null);
  const [appState,   setAppState]   = useState("loading"); // resolved below
  const [tab,        setTab]        = useState("dashboard");
//  const [goToUpload, setUploadState]   = useState("upload_photos");

  const goToUpload = () => {
    console.log("Switching to upload state...");
    setAppState("upload_photos");
  };
  // ── Resolve app state on mount + after OAuth return ──────────────
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const connected  = params.get("connected") === "true";
    const oauthError = params.get("error");

    // Clean query string immediately so refresh doesn't re-trigger
    if (connected || oauthError) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    // No business yet → straight to onboarding
    if (!businessId) {
      setAppState("onboarding");
      return;
    }

    // Have a businessId — load data to determine next state
    api.getBusiness(businessId)
      .then(d => {
        setBusiness(d);
        const ig = d.instagram_page || null;
        setIgPage(ig);
        if (connected) {
          if (!ig?.is_active) {
              setAppState("connect_ig");
              return;
          }
          api.mediaLibrary(d.id).then(media => {
              const hasPosts = /* check if any posts exist this week */ false;
              if (!media.ready && !hasPosts) {
                  setAppState("upload_photos");
              } else {
                  setAppState("dashboard");
              }
          }).catch(() => setAppState("dashboard"));
        } else if (!ig?.is_active) {
          // Has business but no active IG — must connect first
          setAppState("connect_ig");
        } else {
          setAppState("dashboard");
        }
      })
      .catch(() => {
        // businessId in localStorage is stale/invalid — reset
        localStorage.removeItem(BID_KEY);
        setBusinessId(null);
        setAppState("onboarding");
      });

  }, []); // run once on mount only

  // ── After onboarding: save id + go to connect_ig ─────────────────
  function handleOnboarded(id) {
    setBid(id);
    setBusinessId(id);
    setAppState("connect_ig");
  }

  // ── After IG connected successfully ──────────────────────────────
  function handleIgConnected() {
    // Reload business data then enter dashboard
    api.getBusiness(businessId).then(d => {
      setBusiness(d);
      setIgPage(d.instagram_page || null);
      setAppState("upload_photos");
    });
  }

  // ── After IG connected successfully ──────────────────────────────
  function handleUploadMedia() {
    // Reload business data then enter dashboard
    api.getBusiness(businessId).then(d => {
      setBusiness(d);
      setIgPage(d.instagram_page || null);
      setAppState("dashboard");
    });
  }




  // ── Loading splash ────────────────────────────────────────────────
  if (appState === "loading") {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Logo size={44} />
          <div className="flex gap-1.5">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-[#1D9E75] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (appState === "onboarding") return <Onboarding onDone={handleOnboarded} />;

  if (appState === "connect_ig") return (
    <ConnectInstagram
      businessId={businessId}
      business={business}
      onConnected={handleIgConnected}
    />
  );

  if (appState === "upload_photos") return (
    <UploadMedia
      businessId={businessId}
      business={business}
      onReady={handleUploadMedia}
    />
  );

  // ── Main dashboard shell ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">{business?.name || "Socio"}</div>
            {igPage?.ig_username && <div className="text-[10px] text-gray-400">@{igPage.ig_username}</div>}
          </div>
        </div>
        {/* Token expiry warning */}
        {igPage && !igPage.is_active && (
          <a href={getConnectUrl(businessId)} className="text-[11px] bg-amber-50 text-amber-700 font-semibold px-3 py-1.5 rounded-lg border border-amber-200 hover:opacity-80 transition">
            Reconnect IG
          </a>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "dashboard" && <DashboardTab businessId={businessId} />}
        {tab === "posts"     && <PostsTab     businessId={businessId} igPage={igPage} onUploadMore={goToUpload}/>}
        {tab === "settings"  && <SettingsTab  businessId={businessId} business={business} igPage={igPage} />}
      </div>

      {/* Bottom nav */}
      <div className="bg-white border-t border-gray-100 px-4 py-2 flex sticky bottom-0 z-10">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 transition ${tab === t.id ? "text-[#1D9E75]" : "text-gray-400"}`}>
            {t.icon(tab === t.id)}
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
