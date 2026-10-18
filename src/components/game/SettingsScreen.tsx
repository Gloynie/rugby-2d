"use client";

import { useState } from "react";
import * as audio from "@/game/audio";
import { currentSettings, updateSettings, type GameSettings } from "@/game/settings";
import { Btn, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const [s, setS] = useState<GameSettings>(currentSettings);
  const set = (patch: Partial<GameSettings>) => setS(updateSettings(patch));

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader kicker="Options" title="Settings" right={<Btn onClick={onBack}>Back</Btn>} />
      <Scroll className="pr-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel className="p-6">
            <Kicker>Audio</Kicker>
            <div className="mt-4 space-y-6">
              <Slider label="Music volume" value={s.musicVolume} onChange={(v) => set({ musicVolume: v })} />
              <Slider label="Sound effects volume" value={s.sfxVolume} onChange={(v) => set({ sfxVolume: v })} />
              <Btn onClick={() => audio.playUpgrade()}>Preview sound effect</Btn>
            </div>
          </Panel>

          <Panel className="p-6">
            <Kicker>Look</Kicker>
            <p className="mt-3 text-lg text-slate-300">Pixel style</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Btn primary={s.smooth} onClick={() => set({ smooth: true })}>Soft pixels</Btn>
              <Btn primary={!s.smooth} onClick={() => set({ smooth: false })}>Crisp pixels</Btn>
            </div>
            <p className="mt-2 text-base text-slate-400">Soft pixels smooths the picture when it is scaled up. Crisp keeps hard retro edges.</p>
            <p className="mt-5 text-lg text-slate-300">Performance</p>
            <div className="mt-2 flex gap-3">
              <Btn primary={s.quality === "low"} onClick={() => set({ quality: "low" })}>Low (faster)</Btn>
              <Btn primary={s.quality === "high"} onClick={() => set({ quality: "high" })}>High (smoother)</Btn>
            </div>
          </Panel>

          <Panel className="p-6 lg:col-span-2">
            <Kicker>Music</Kicker>
            <p className="mt-3 text-lg text-slate-300">While a match is being played</p>
            <div className="mt-2 flex gap-3">
              <Btn primary={s.matchMusic === "quiet"} onClick={() => set({ matchMusic: "quiet" })}>Quiet in background</Btn>
              <Btn primary={s.matchMusic === "off"} onClick={() => set({ matchMusic: "off" })}>Silent</Btn>
            </div>
            <p className="mt-3 text-base text-slate-400">
              Songs always play on shuffle, and fade in and out around matches. Skip tracks from the now-playing bar.
            </p>
          </Panel>
        </div>
      </Scroll>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-bold uppercase tracking-wider text-slate-300">{label}</span>
        <span className="font-display text-xl font-bold text-yellow-300">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-yellow-400" />
    </div>
  );
}
