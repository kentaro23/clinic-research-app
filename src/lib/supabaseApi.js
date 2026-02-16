import { supabase } from "./supabaseClient";

export const getSessionUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
};

export const signUpWithEmail = async ({ email, pass }) => {
  return supabase.auth.signUp({
    email,
    password: pass,
  });
};

export const signInWithEmail = async ({ email, pass }) => {
  return supabase.auth.signInWithPassword({
    email,
    password: pass,
  });
};

export const signOutSession = async () => {
  return supabase.auth.signOut();
};

export const upsertProfile = async (profile) => {
  return supabase.from("profiles").upsert(profile).select().single();
};

export const getProfileById = async (id) => {
  return supabase.from("profiles").select("*").eq("id", id).single();
};

export const listClinicProfiles = async () => {
  return supabase.from("clinics").select("*").order("updated_at", { ascending: false });
};

export const upsertClinic = async (clinic) => {
  return supabase.from("clinics").upsert(clinic).select().single();
};

export const listBookings = async () => {
  return supabase.from("bookings").select("*").order("created_at", { ascending: false });
};

export const insertBooking = async (booking) => {
  return supabase.from("bookings").insert(booking).select().single();
};

export const insertReviewReport = async (report) => {
  return supabase.from("review_reports").insert(report);
};

export const insertAuditLog = async (payload) => {
  return supabase.from("audit_logs").insert(payload);
};

