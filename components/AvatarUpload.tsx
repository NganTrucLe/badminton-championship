"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface IAvatarUploadProps {
  playerId: string;
  currentUrl: string | null;
  onUploaded: (publicUrl: string) => void;
}

export function AvatarUpload({ playerId, currentUrl, onUploaded }: IAvatarUploadProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Chỉ chấp nhận tệp ảnh.");
      return;
    }
    if (file.size > 2_000_000) {
      setErr("Ảnh quá lớn (tối đa 2MB).");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const supabase = createBrowserSupabaseClient();
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${playerId}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) {
        setErr(`Tải ảnh thất bại: ${upErr.message}`);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // cache-bust so an overwrite of the same path shows immediately
      onUploaded(`${data.publicUrl}?v=${path.length}-${file.size}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" width={40} height={40} style={{ borderRadius: "50%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#C9D6D2" }} />
      )}
      <label style={{ fontSize: 12, fontWeight: 700, color: "#0B5D4E", cursor: busy ? "wait" : "pointer" }}>
        {busy ? "Đang tải…" : "Tải ảnh"}
        <input type="file" accept="image/*" onChange={(e) => void handleFile(e)} disabled={busy} style={{ display: "none" }} />
      </label>
      {err && <span style={{ fontSize: 11, color: "#B0435F" }}>{err}</span>}
    </div>
  );
}
