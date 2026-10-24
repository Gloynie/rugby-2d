"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BINDINGS, loadBindings, saveBindings, type Bindings } from "@/game/controls";
import { findTeam } from "@/game/data";
import { useGamepadNav } from "@/game/useGamepadNav";
import { music } from "@/game/music/player";
import { initSettings } from "@/game/settings";
import type { SessionUser } from "@/lib/auth";
import CompetitionsScreen, { HubScreen } from "./Competitions";
import ControlsScreen from "./ControlsScreen";
import HowToScreen from "./HowTo";
import SettingsScreen from "./SettingsScreen";
import MusicScreen from "./MusicScreen";
import NowPlaying from "./NowPlaying";
import GameMark from "./GameMark";
import Loader, { Splash } from "./Loader";
import CareerStart from "./CareerStart";
import CareerHub from "./CareerHub";
import CareerMatch from "./CareerMatch";
import PlayerCareerStart from "./PlayerCareerStart";
import PlayerCareerHub from "./PlayerCareerHub";
import OnlineFriendlies, { OnlineMatchRoom } from "./OnlineFriendlies";
import UltimateTeam from "./UltimateTeam";
import MainMenu from "./MainMenu";
import PlaySetup from "./PlaySetup";
import ProfileScreen from "./ProfileScreen";
import SquadsScreen from "./Squads";
import { Crest, Kbd } from "./ui";

export type Screen =
  | { name: "menu" }
  | { name: "play"; tournamentId?: number }
  | { name: "competitions" }
  | { name: "hub"; id: number }
  | { name: "squads" }
  | { name: "controls" }
  | { name: "profile"; mode?: "login" | "register" }
  | { name: "howto" }
  | { name: "career" }
  | { name: "career-hub"; id: number }
  | { name: "career-match"; id: number; fixtureId: string; mode: "manager" | "player" }
  | { name: "player-career-start" }
  | { name: "player-career-hub"; id: number }
  | { name: "online" }
  | { name: "online-match"; id: number }
  | { name: "ultimate" }
  | { name: "settings" }
  | { name: "music" };


export default function GameShell({ initialUser, initialScreen }: { initialUser: SessionUser | null; initialScreen?: Screen }) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [screen, setScreen] = useState<Screen>(initialScreen ?? { name: "menu" });
  const [bindings, setBindingsState] = useState<Bindings>(DEFAULT_BINDINGS);
  const [inMatch, setInMatch] = useState(false);
  const [booted, setBooted] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((d: { db?: boolean }) => setOffline(d.db === false))
      .catch(() => setOffline(true));
  }, []);

  useEffect(() => {
    // Always start the music as soon as the player gives any kind of consent — this
    // is the autoplay prompt the user asked for. Random shuffle is the default
    // (set in src/game/settings.ts) so the first song is different on every visit.
    const arm = () => {
      music.unlock();
      window.removeEventListener("pointerdown", arm, true);
      window.removeEventListener("keydown", arm, true);
      window.removeEventListener("touchstart", arm, true);
    };
    window.addEventListener("pointerdown", arm, true);
    window.addEventListener("keydown", arm, true);
    window.addEventListener("touchstart", arm, true);
  }, []);

  useEffect(() => {
    initSettings();
    // Defer the state writes so the effect only schedules work rather than
    // setting state synchronously during the commit.
    const prime = window.setTimeout(() => setBindingsState(loadBindings()), 0);
    // Minimum 1.4s on screen so the player reads it, capped at the music ready promise + 400ms.
    const hardLimit = window.setTimeout(() => setBooted(true), 1400);
    void music.init().then(() => window.setTimeout(() => setBooted(true), 400));
    return () => {
      window.clearTimeout(prime);
      window.clearTimeout(hardLimit);
    };
  }, []);

  const setBindings = useCallback((b: Bindings) => {
    setBindingsState(b);
    saveBindings(b);
  }, []);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const back = useCallback(() => setScreen({ name: "menu" }), []);

  // Controller navigation on every sub-screen: stick/d-pad moves focus, A clicks, B goes back.
  // The main menu runs its own list navigation; matches read the pad through the engine.
  useGamepadNav("#screen-root", back, !inMatch && screen.name !== "menu");

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (inMatch) return;
      if (e.code === "Escape" && screen.name !== "menu") {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT")) target.blur();
        else back();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [inMatch, screen, back]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setScreen({ name: "menu" });
  };

  const fav = findTeam(user?.favouriteTeam);

  return (
    <div className={`fixed inset-0 select-none overflow-hidden ${inMatch ? "bg-black text-white" : "menu-theme"}`}>
      <div className="relative z-10 flex h-full flex-col">
        {!inMatch && screen.name !== "menu" && screen.name !== "play" && (
          <div className="flex items-center gap-3 px-6 pt-4 md:px-10">
            <button
              onClick={back}
              className="font-pixel flex items-center gap-2 border-2 border-[#141a21]/25 bg-white/85 px-3 py-2 text-[8px] uppercase tracking-widest text-[#141a21] shadow-[3px_3px_0_rgba(20,30,42,0.25)] transition hover:bg-white"
              aria-label="Back to main menu"
            >
              <span aria-hidden>◀</span> Back
            </button>
            {offline && (
              <span
                className="font-pixel border-2 border-yellow-400/70 bg-yellow-950/70 px-2 py-1.5 text-[7px] uppercase tracking-widest text-yellow-300"
                title="No database connected. Quick matches work; accounts and competitions are disabled."
              >
                Guest mode
              </span>
            )}
          </div>
        )}

        <div id="screen-root" className={`min-h-0 flex-1 ${inMatch || screen.name === "menu" ? "overflow-hidden" : "overflow-y-auto scroll px-6 pb-2 pt-2 md:px-10"}`}>
          {!booted && <Loader />}
          {booted && screen.name === "menu" && <MainMenu key="menu" user={user} go={go} onLogout={logout} offline={offline} />}
          {booted && screen.name === "play" && (
            <PlaySetup key={screen.tournamentId ?? "quick"} user={user} bindings={bindings} tournamentId={screen.tournamentId} go={go} setInMatch={setInMatch} />
          )}
          {booted && screen.name === "competitions" && <CompetitionsScreen user={user} go={go} />}
          {booted && screen.name === "hub" && <HubScreen key={screen.id} id={screen.id} go={go} />}
          {booted && screen.name === "squads" && <SquadsScreen />}
          {booted && screen.name === "controls" && <ControlsScreen bindings={bindings} setBindings={setBindings} />}
          {booted && screen.name === "profile" && <ProfileScreen user={user} setUser={setUser} initialMode={screen.mode} go={go} offline={offline} />}
          {booted && screen.name === "howto" && <HowToScreen bindings={bindings} />}
          {booted && screen.name === "settings" && <SettingsScreen onBack={back} />}
          {booted && screen.name === "music" && <MusicScreen onBack={back} />}
           {booted && screen.name === "career" && (user ? <CareerStart user={user} go={go} /> : <ProfileScreen user={user} setUser={setUser} initialMode="login" go={go} />)}
          {booted && screen.name === "career-hub" && <CareerHub careerId={screen.id} go={go} />}
          {booted && screen.name === "career-match" && <CareerMatch careerId={screen.id} fixtureId={screen.fixtureId} mode={screen.mode} bindings={bindings} go={go} />}
          {booted && screen.name === "player-career-start" && (user ? <PlayerCareerStart user={user} go={go} /> : <ProfileScreen user={user} setUser={setUser} initialMode="login" go={go} />)}
          {booted && screen.name === "player-career-hub" && <PlayerCareerHub id={screen.id} go={go} />}
          {booted && screen.name === "online" && <OnlineFriendlies user={user} bindings={bindings} go={go} />}
          {booted && screen.name === "online-match" && <OnlineMatchRoom id={screen.id} bindings={bindings} go={go} />}
          {booted && screen.name === "ultimate" && <UltimateTeam user={user} bindings={bindings} go={go} setInMatch={setInMatch} />}
        </div>

        {!inMatch && screen.name !== "menu" && (
          <footer className="flex items-center gap-4 px-6 py-3 text-[#3d4854] md:px-10">
            <span>
              <Kbd>↑</Kbd><Kbd>↓</Kbd><Kbd>←</Kbd><Kbd>→</Kbd> navigate
            </span>
            <span>
              <Kbd>ENTER</Kbd> select
            </span>
            <span>
              <Kbd>ESC</Kbd> back
            </span>
            {offline && (
              <span
                className="font-pixel border-2 border-yellow-400/70 bg-yellow-950/70 px-2 py-1 text-[8px] uppercase tracking-widest text-yellow-300"
                title="No PostgreSQL database connected. Quick matches work; accounts & competitions are disabled. See README.md."
              >
                Guest mode · no database
              </span>
            )}
            <div className="ml-auto hidden md:block">
              <NowPlaying onOpen={() => go({ name: "music" })} />
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}
