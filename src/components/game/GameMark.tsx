"use client";

import { useState } from "react";

type Props = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

/** Shared PixelRuggas rugby-ball mark used in the app UI and browser branding. */
export default function GameMark({ size = 42, showWordmark = true, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`flex items-center gap-3 ${className}`} aria-label="PixelRuggas">
      <span
        className="grid shrink-0 place-items-center rounded-xl border border-green-400/60 bg-black/80 shadow-[0_4px_14px_rgba(0,0,0,0.5)]"
        style={{ width: size, height: size }}
      >
        {failed ? (
          <span className="font-display text-xl font-bold text-yellow-400">R</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/pixelruggas-ball.png"
            alt="PixelRuggas pixel rugby ball"
            width={size - 4}
            height={size - 4}
            onError={() => setFailed(true)}
            className="pixelated h-full w-full object-contain"
          />
        )}
      </span>
      {showWordmark && (
        <span className="font-display text-xl font-bold tracking-[0.18em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] md:text-2xl">
          PIXEL<span className="text-green-300">RUGGAS</span>
        </span>
      )}
    </span>
  );
}
