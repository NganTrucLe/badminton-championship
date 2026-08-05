"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/browserClient";

interface IAvatarUploadProps {
  playerId: string;
  currentUrl: string | null;
  onUploaded: (publicUrl: string) => void;
  disabled?: boolean;
}

export function AvatarUpload({ playerId, currentUrl, onUploaded, disabled }: IAvatarUploadProps) {
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
    <div className="flex items-center gap-2.5">
      <Avatar style={{ width: 40, height: 40 }}>
        {currentUrl ? (
          <AvatarImage src={currentUrl} alt="" />
        ) : (
          <AvatarFallback style={{ backgroundColor: "#C9D6D2" }} />
        )}
      </Avatar>
      <Button asChild variant="outline" size="sm" disabled={busy || disabled}>
        <label style={{ cursor: busy ? "wait" : disabled ? "not-allowed" : "pointer" }}>
          {busy ? (
            <>
              <Loader2 className="animate-spin" />
              Đang tải…
            </>
          ) : (
            <>
              <Upload />
              Tải ảnh
            </>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void handleFile(e)}
            disabled={busy || disabled}
            style={{ display: "none" }}
          />
        </label>
      </Button>
      {err && <span className="text-[11px] text-[#B0435F]">{err}</span>}
    </div>
  );
}
