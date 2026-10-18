"use client";

import { useEffect, useState } from "react";
import { ACTIONS, DEFAULT_BINDINGS, PRESETS, UNBINDABLE, keyLabel, type Action, type Bindings } from "@/game/controls";
import {
  DEFAULT_PAD_BINDINGS, GamepadReader, PAD_ACTIONS, PAD_STICK_MOVES, loadPadBindings, padButtonLabel, savePadBindings,
  type PadAction, type PadBindings,
} from "@/game/gamepad";
import { Btn, Kbd, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

export default function ControlsScreen({ bindings, setBindings }: { bindings: Bindings; setBindings: (b: Bindings) => void }) {
  const [listening, setListening] = useState<Action | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<"keyboard" | "controller">("keyboard");

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
            <Btn primary={tab === "keyboard"} onClick={() => setTab("keyboard")}>Keyboard</Btn>
            <Btn primary={tab === "controller"} onClick={() => setTab("controller")}>Controller</Btn>
          </div>
        }
      />
      {tab === "controller" ? (
        <ControllerTab />
      ) : (
      <>
      <div className="mb-3 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Btn key={p.id} primary={activePreset?.id === p.id} onClick={() => { setBindings({ ...p.bindings }); setNote(`Preset "${p.name}" applied.`); }}>
            {p.name}
          </Btn>
        ))}
        <Btn danger onClick={() => { setBindings({ ...DEFAULT_BINDINGS }); setNote("Controls reset to defaults."); }}>Reset</Btn>
      </div>
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
      </>
      )}
    </div>
  );
}

/** Controller tab: live pad detection plus remappable buttons. */
function ControllerTab() {
  const [pad, setPad] = useState<PadBindings>(() => loadPadBindings());
  const [listening, setListening] = useState<PadAction | null>(null);
  const [connected, setConnected] = useState(false);
  const [padName, setPadName] = useState("");
  const [live, setLive] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);

  // Poll the pad so we can show connection state, live button presses and capture rebinds.
  useEffect(() => {
    const reader = new GamepadReader();
    let raf = 0;
    const tick = () => {
      const snap = reader.poll();
      setConnected(snap.connected);
      setPadName(snap.id);
      setLive([...snap.held]);
      if (listening !== null && snap.pressed.size > 0) {
        const btn = [...snap.pressed][0];
        setPad((prev) => {
          const next = { ...prev };
          const clash = (Object.keys(next) as PadAction[]).find((a) => a !== listening && next[a] === btn);
          if (clash) next[clash] = prev[listening];
          next[listening] = btn;
          savePadBindings(next);
          setNote(clash
            ? `${padButtonLabel(btn)} was used by "${PAD_ACTIONS.find((a) => a.id === clash)?.label}" – the two have been swapped.`
            : `${PAD_ACTIONS.find((a) => a.id === listening)?.label} set to ${padButtonLabel(btn)}.`);
          return next;
        });
        setListening(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [listening]);

  // Escape cancels a pending rebind.
  useEffect(() => {
    if (listening === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setListening(null);
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [listening]);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span
          className={`font-pixel border-2 px-3 py-2 text-[8px] uppercase tracking-widest ${
            connected ? "border-green-400/60 bg-green-950/50 text-green-300" : "border-white/20 bg-black/40 text-slate-400"
          }`}
        >
          {connected ? "Controller connected" : "No controller detected"}
        </span>
        {connected && padName && <span className="truncate text-base text-slate-400">{padName.slice(0, 48)}</span>}
        <Btn danger onClick={() => { setPad({ ...DEFAULT_PAD_BINDINGS }); savePadBindings({ ...DEFAULT_PAD_BINDINGS }); setNote("Controller layout reset."); }}>
          Reset
        </Btn>
      </div>
      <p className="mb-3 text-slate-300">
        Plug in a controller and press any button to wake it up. Move with the <b className="text-white">left stick</b> or{" "}
        <b className="text-white">d-pad</b>. Click an action below, then press the button you want on the pad.
      </p>
      {!connected && (
        <p className="mb-3 border-2 border-yellow-400/60 bg-yellow-950/50 px-4 py-2 text-yellow-100">
          Browsers only reveal a controller after you press one of its buttons. Press any button now, then this page will show it.
        </p>
      )}
      {note && <p className="mb-3 border-2 border-green-400/50 bg-green-950/40 px-4 py-2 text-green-100">{note}</p>}
      <Scroll className="pr-2">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Panel className="p-4">
            <Kicker>Movement</Kicker>
            <ul className="mt-2 divide-y divide-white/10">
              <li className="flex items-center justify-between py-2">
                <span><span className="block text-xl">Move</span><span className="block text-slate-400">Run in any direction</span></span>
                <Kbd>L-STICK</Kbd>
              </li>
              <li className="flex items-center justify-between py-2">
                <span><span className="block text-xl">Move (digital)</span><span className="block text-slate-400">Alternative to the stick</span></span>
                <Kbd>D-PAD</Kbd>
              </li>
            </ul>
            <Kicker className="mt-4">Skill moves · right stick</Kicker>
            <p className="mt-1 text-base text-slate-400">Flick the right stick while carrying the ball.</p>
            <ul className="mt-2 divide-y divide-white/10">
              {PAD_STICK_MOVES.map((m) => (
                <li key={m.dir} className="flex items-center justify-between py-2">
                  <span className="text-xl">{m.label}</span>
                  <Kbd>{m.dir}</Kbd>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-base text-slate-500">
              The buttons below also trigger these, if you prefer them to the stick.
            </p>
          </Panel>
          <Panel className="p-4 md:col-span-1 xl:col-span-2">
            <Kicker>Buttons</Kicker>
            <ul className="mt-2 grid gap-x-6 divide-y divide-white/10 md:grid-cols-2 md:divide-y-0">
              {PAD_ACTIONS.map((a) => {
                const active = listening === a.id;
                const held = live.includes(pad[a.id]);
                return (
                  <li key={a.id} className="border-b border-white/10">
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
                          <span className="font-pixel blink text-[9px] text-yellow-300">PRESS A BUTTON</span>
                        ) : (
                          <span className={held ? "ring-2 ring-green-400" : ""}><Kbd>{padButtonLabel(pad[a.id])}</Kbd></span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </Scroll>
    </>
  );
}
