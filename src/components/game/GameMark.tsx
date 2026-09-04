"use client";

type Props = {
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

/** Shared PixelRuggas rugby-ball mark used in the app UI and browser branding. */
export default function GameMark({ size = 42, showWordmark = true, className = "" }: Props) {
  return (
    <span className={`flex items-center gap-3 ${className}`} aria-label="PixelRuggas">
      <span
        className="grid shrink-0 place-items-center border-2 border-green-400/60 bg-black shadow-[3px_3px_0_#000]"
        style={{ width: size, height: size }}
      >
        <img
          src="/brand/pixelruggas-ball.png"
          alt="PixelRuggas pixel rugby ball"
          width={size - 4}
          height={size - 4}
          className="pixelated h-full w-full object-contain"
        />
      </span>
      {showWordmark && (
        <span className="font-pixel text-sm tracking-[0.16em] text-white drop-shadow-[2px_2px_0_#000] md:text-base">
          PIXEL<span className="text-green-300">RUGGAS</span>
        </span>
      )}
    </span>
  );
}
