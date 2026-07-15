"use client";

import { ArrowRight, BookOpen, Check, Github, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { type FormEvent, useState } from "react";

export function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const homePath = `${basePath}/`;

  const startOAuth = (provider: "google" | "github") => {
    if (!supabaseUrl) return setMessage("Supabase authentication is not configured in this environment.");
    const redirect = `${window.location.origin}${homePath}`;
    window.location.assign(`${supabaseUrl}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirect)}`);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabaseUrl || !anonKey) return setMessage("Supabase authentication is not configured in this environment.");
    setBusy(true);
    setMessage(mode === "signin" ? "Signing you in..." : "Creating your account...");
    try {
      const path = mode === "signin" ? "/auth/v1/token?grant_type=password" : "/auth/v1/signup";
      const response = await fetch(`${supabaseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.msg || payload.error_description || payload.message || "Authentication failed.");
      const session = payload.access_token ? payload : payload.session;
      if (!session) {
        setMessage("Account created. Check your email to confirm it, then sign in.");
        setMode("signin");
        return;
      }
      const storage = remember ? window.localStorage : window.sessionStorage;
      storage.setItem("coursecraft_session", JSON.stringify(session));
      window.location.assign(homePath);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "We could not complete authentication.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="sign-in-page">
    <section className="sign-in-story"><div className="sign-in-brand"><span>c</span>coursecraft.</div><div className="sign-in-story-copy"><span className="eyebrow">Your private learning workspace</span><h1>Learn deeply.<br />Remember longer.</h1><p>Turn the documents that matter into courses designed around how you learn.</p><div className="sign-in-points"><span><Check size={14} /> Source-grounded AI companion</span><span><Check size={14} /> Progress that follows you</span><span><Check size={14} /> Private by design</span></div></div><div className="sign-in-orbit"><BookOpen size={28} /><i /><i /><i /></div><small>CourseCraft · Designed for focused minds</small></section>
    <section className="sign-in-form-wrap"><div className="sign-in-form"><div className="form-icon"><Sparkles size={20} /></div><span className="eyebrow">Welcome to CourseCraft</span><h2>{mode === "signin" ? "Continue your learning" : "Create your workspace"}</h2><p>{mode === "signin" ? "Sign in to access your courses, progress, and AI companion." : "Use an email and password to start your private learning library."}</p><div className="oauth-grid"><button onClick={() => startOAuth("google")}><strong>G</strong> Continue with Google</button><button onClick={() => startOAuth("github")}><Github size={17} /> Continue with GitHub</button></div><div className="or-divider"><span />or continue with email<span /></div><form onSubmit={submit}><label><span>Email address</span><div><Mail size={16} /><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label><label><span>Password</span><div><LockKeyhole size={16} /><input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></div></label><div className="form-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label><button type="button" onClick={() => setMessage("Password recovery will be sent through Supabase once email delivery is configured.")}>Forgot password?</button></div><button className="primary-button wide" disabled={busy} type="submit">{busy ? "Please wait..." : mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={15} /></button></form>{message && <div className="auth-message" role="status">{message}</div>}<button className="demo-access" onClick={() => { setMode((value) => value === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}</button><button className="demo-access" onClick={() => window.location.assign(homePath)}>Open preview workspace <ArrowRight size={14} /></button><small>By continuing, you agree to the Terms and Privacy Policy.</small></div></section>
  </main>;
}
