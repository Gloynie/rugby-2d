"use client";

import { useEffect, useState } from "react";
import { ACTIONS, DEFAULT_BINDINGS, PRESETS, UNBINDABLE, keyLabel, type Action, type Bindings } from "@/game/controls";
import { Btn, Kbd, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

export default function ControlsScreen({ bindings, setBindings }: { bindings: Bindings; setBindings: (b: Bindings) => void }) {
  const [listening, setListening] = useState<Action | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!listening) return;
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListening(null);
        return;
      }
      if (UNBINDABLE.has(e.code) || !e.code) {
        setNote(`${keyLabel(e.code)} cannot be bound.`);
        return;
      }
      const next: Bindings = { ...bindings };
      const clash = (Object.keys(next) as Action[]).find((a) => a !== listening && next[a] === e.code);
      if (clash) {
        next[clash] = bindings[listening];
        setNote(`${keyLabel(e.code)} was used by "${ACTIONS.find((a) => a.id === clash)?.label}" – the two keys have been swapped.`);
      } else setNote(null);
      next[listening] = e.code;
      setBindings(next);
      setListening(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [listening, bindings, setBindings]);

  const groups = Array.from(new Set(ACTIONS.map((a) => a.group)));
  const activePreset = PRESETS.find((p) => (Object.keys(p.bindings) as Action[]).every((k) => p.bindings[k] === bindings[k]));

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader
        kicker="Settings"
        title="Controls"
        right={
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Btn key={p.id} primary={activePreset?.id === p.id} onClick={() => { setBindings({ ...p.bindings }); setNote(`Preset "${p.name}" applied.`); }}>
                {p.name}
              </Btn>
            ))}
            <Btn danger onClick={() => { setBindings({ ...DEFAULT_BINDINGS }); setNote("Controls reset to defaults."); }}>Reset</Btn>
          </div>
        }
      />
      <p className="mb-3 text-slate-300">
        Click an action (or focus it and press <Kbd>ENTER</Kbd>), then press the key you want. Changes save automatically to this browser.
        {activePreset && <span className="text-yellow-300"> Current preset: {activePreset.name}.</span>}
      </p>
      {note && <p className="mb-3 border-2 border-yellow-400/60 bg-yellow-950/50 px-4 py-2 text-yellow-100">{note}</p>}
      <Scroll className="pr-2">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <Panel key={g} className="p-4">
              <Kicker>{g}</Kicker>
              <ul className="mt-2 divide-y divide-white/10">
                {ACTIONS.filter((a) => a.group === g).map((a) => {
                  const active = listening === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        onClick={() => { setListening(a.id); setNote(null); }}
                        className={`flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-white/5 ${active ? "bg-yellow-400/10" : ""}`}
                      >
                        <span>
                          <span className="block text-xl">{a.label}</span>
                          <span className="block text-slate-400">{a.desc}</span>
                        </span>
                        <span className="shrink-0">
                          {active ? (
                            <span className="font-pixel blink text-[9px] text-yellow-300">PRESS A KEY</span>
                          ) : (
                            <Kbd>{keyLabel(bindings[a.id])}</Kbd>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          ))}
        </div>
      </Scroll>
    </div>
  );
}
