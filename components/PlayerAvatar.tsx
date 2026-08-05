"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
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
 * see `public/avatars/README.md`. Radix's `AvatarImage` falls back to `AvatarFallback`
 * automatically on load error (including a 404), so dropping in JPGs later needs no code changes.
 */
export function PlayerAvatar({ player, size, initials = "single", className }: IPlayerAvatarProps) {
  const photo = avatarPhotoPath(player);
  const label = initials === "double" ? playerInitials(player.name) : playerInitial(player.name);

  return (
    <Avatar
      className={cn("flex-none rounded-full border-[1.5px] border-white", className)}
      style={{ width: size, height: size }}
    >
      {photo ? <AvatarImage src={photo} alt={player.name} className="object-cover" /> : null}
      <AvatarFallback
        className="rounded-full text-white"
        style={{
          background: avatarFallbackColor(player.name),
          fontFamily: "var(--font-jetbrains), monospace",
          fontWeight: 800,
          fontSize: Math.round(size * 0.42),
        }}
      >
        {label}
      </AvatarFallback>
    </Avatar>
  );
}
