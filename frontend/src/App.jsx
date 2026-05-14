import { useState, useEffect } from "react";
import { api } from "./lib/api.js";
import { getSession, getProfile, onAuthChange, signOut } from "./lib/auth";

import Loading          from "./components/Common/Loading.jsx";
import Landing          from "./components/Landing/Landing";
import SignIn           from "./components/Landing/SignIn";
import Onboarding       from "./components/Onboarding/Onboarding";
import ConnectInstagram from "./components/Onboarding/ConnectInstagram";
import UploadMedia      from "./components/Onboarding/UploadMedia";
import Dashboard        from "./components/Dashboard/Dashboard";
import Admin            from "./components/Admin/Admin";

// ═════════════════════════════════════════════════════════════════════
// App  —  top-level router.
//
// Source of truth = Supabase session. localStorage businessId is gone.
//
//   no session  → landing | sign_in
//   session, admin role → admin
//   session, business role, no business yet → onboarding
//   session, business role, has business → connect_ig / upload_photos / dashboard
// ═════════════════════════════════════════════════════════════════════

export default function App() {
  // /admin route is fully separate — Admin handles its own auth check
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return <Admin />;
  }

  const [session, setSession] = useState("checking");
  const [profile,    setProfile]    = useState(null);
  const [business,   setBusiness]   = useState(null);
  const [igPage,     setIgPage]     = useState(null);
  const [appState,   setAppState]   = useState("loading");


  console.log({ session, appState });
  // ── Track auth state ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const s = await getSession();
      // If s is null (no session), this still marks the check as finished
      if (!cancelled) setSession(s || false);
    })();

    const unsubscribe = onAuthChange(s => {
      if (!cancelled) setSession(s || false);
    });

    return () => { cancelled = true; unsubscribe(); };
  }, []);

  // ── Resolve state when session changes ───────────────────────────
  useEffect(() => {
    if (session === "checking") return;

    const params    = new URLSearchParams(window.location.search);
    const connected = params.get("connected") === "true";
    if (params.get("connected") || params.get("error")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (!session) {
      setProfile(null);
      setBusiness(null);
      setIgPage(null);
      setAppState("landing");
      return;
    }

    // Have a session → fetch profile + business
    (async () => {
      try {
        console.log("==========Session User ID-----------" + session.user.id)
        const prof = await getProfile(session.user.id);
        setProfile(prof);

        // Admin role → admin is reached at /admin URL, but a top-level
        // admin signing in from the main app gets redirected there.
        if (prof.role === "admin") {
          window.location.href = "/admin";
          return;
        }

        // Business owner → look up their business
        const biz = await api.getMyBusiness();   // see api.js note below
        if (!biz) {
          setAppState("onboarding");
          return;
        }
        setBusiness(biz);
        const ig = biz.instagram_page || null;
        setIgPage(ig);

        if (connected) {
          if (!ig?.is_active) { setAppState("connect_ig"); return; }
          const media = await api.mediaLibrary(biz.id).catch(() => null);
          setAppState(media && !media.ready ? "upload_photos" : "dashboard");
        } else if (!ig?.is_active) {
          setAppState("connect_ig");
        } else {
          setAppState("dashboard");
        }
      } catch (err) {
        console.error("Session resolution failed:", err);
        setAppState("landing");
      }
    })();
  }, [session]);

  // ── Transitions ──────────────────────────────────────────────────
  const goToOnboarding = () => setAppState("onboarding");
  const goToSignIn     = () => setAppState("sign_in");
  const goToLanding    = () => setAppState("landing");

  function handleSignedIn() {
    // Supabase auth state change effect above will re-run and route us.
    // Nothing else to do here.
  }

  async function handleOnboarded(biz) {
    setBusiness(biz);
    setIgPage(biz.instagram_page || null);
    setAppState("connect_ig");
  }

  async function refreshBusiness() {
    const biz = await api.getMyBusiness();
    setBusiness(biz);
    setIgPage(biz?.instagram_page || null);
  }

  async function handleIgConnected() {
    await refreshBusiness();
    setAppState("upload_photos");
  }

  async function handleUploadDone() {
    await refreshBusiness();
    setAppState("dashboard");
  }

  async function handleSignOut() {
    await signOut();
    // session listener clears state and routes back to landing
  }

  // ── Render ────────────────────────────────────────────────────────
  if (appState === "loading")       return <Loading />;
  if (appState === "landing")       return <Landing onGetStarted={goToOnboarding} onSignIn={goToSignIn} />;
  if (appState === "sign_in")       return <SignIn onSignedIn={handleSignedIn} onBack={goToLanding} onCreateInstead={goToOnboarding} />;
  if (appState === "onboarding")    return <Onboarding onDone={handleOnboarded} />;
  if (appState === "connect_ig")    return <ConnectInstagram businessId={business?.id} business={business} onConnected={handleIgConnected} />;
  if (appState === "upload_photos") return <UploadMedia businessId={business?.id} business={business} onReady={handleUploadDone} />;

  return (
    <Dashboard
      businessId={business?.id}
      business={business}
      igPage={igPage}
      profile={profile}
      onUploadMore={() => setAppState("upload_photos")}
      onSignOut={handleSignOut}
    />
  );
}
