"use client";

import { useState } from "react";
import {
  avatarFallbackColor,
  avatarPhotoPath,
  playerInitial,
  playerInitials,
  type IPlayer,
} from "@/lib/tournament/data";

interface IPlayerAvatarProps {
  player: IPlayer;
  size: number;
  /** 'single' matches the Swiss board / tracking table avatars; 'double' matches the Teams card. */
  initials?: "single" | "double";
  className?: string;
}

/**
 * Renders a player's photo when one exists at `/avatars/{avatarKey}.jpg`, falling back to a
 * colored initials circle (same fallback the design uses for `noPhoto`). Photos are optional —
 * see `public/avatars/README.md`. If the file 404s at runtime we also fall back, so dropping in
 * JPGs later needs no code changes.
 */
export function PlayerAvatar({ player, size, initials = "single", className }: IPlayerAvatarProps) {
  const [errored, setErrored] = useState(false);
  const photo = avatarPhotoPath(player);
  const showPhoto = Boolean(photo) && !errored;
  const label = initials === "double" ? playerInitials(player.name) : playerInitial(player.name);

  if (showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- variable/optional local avatar file, falls back on load error
      <img
        src={photo}
        alt={player.name}
        width={size}
        height={size}
        onError={() => setErrored(true)}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1.5px solid #fff",
          flex: "none",
        }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: avatarFallbackColor(player.name),
        border: "1.5px solid #fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontFamily: "var(--font-jetbrains), monospace",
        fontWeight: 800,
        fontSize: Math.round(size * 0.42),
        flex: "none",
      }}
    >
      {label}
    </div>
  );
}
