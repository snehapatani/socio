// Auth helpers — thin wrappers around supabase.auth that throw plain Errors.

import { supabase } from "./supabase";

export async function signUp({ email, password, fullName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } }, // saved to user_metadata
  });
  if (error) throw new Error(error.message);
  return data; // { user, session }
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data; // { user, session }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session; // null if not signed in
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// Fetch the role from public.profiles (set during onboarding by trigger or backend).
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Subscribe to auth changes (sign-in / sign-out / token refresh).
// Returns the subscription's unsubscribe function for useEffect cleanup.
export function onAuthChange(callback) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

// Reset password via email
export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
}
