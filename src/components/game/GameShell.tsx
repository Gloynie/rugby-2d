"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BINDINGS, loadBindings, saveBindings, type Bindings } from "@/game/controls";
import { findTeam } from "@/game/data";
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
import MenuScene from "./MenuScene";
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

const TABS: { label: string; screen: Screen }[] = [
  { label: "Home", screen: { name: "menu" } },
  { label: "Play", screen: { name: "play" } },
  { label: "Compete", screen: { name: "competitions" } },
  { label: "Squads", screen: { name: "squads" } },
  { label: "Controls", screen: { name: "controls" } },
  { label: "Settings", screen: { name: "settings" } },
  { label: "Ultimate", screen: { name: "ultimate" } },
  { label: "Online", screen: { name: "online" } },
];

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
    setBindingsState(loadBindings());
    initSettings();
    // Minimum 1.4s on screen so the player reads it, capped at the music ready promise + 400ms.
    const hardLimit = window.setTimeout(() => setBooted(true), 1400);
    void music.init().then(() => window.setTimeout(() => setBooted(true), 400));
    return () => window.clearTimeout(hardLimit);
  }, []);

  const setBindings = useCallback((b: Bindings) => {
    setBindingsState(b);
    saveBindings(b);
  }, []);

  const go = useCallback((s: Screen) => setScreen(s), []);
  const back = useCallback(() => setScreen({ name: "menu" }), []);

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
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white">
      {!inMatch && booted && screen.name !== "menu" && (
        <div className="pointer-events-none absolute inset-0 opacity-45">
          <MenuScene />
        </div>
      )}
      {!inMatch && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/55" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/45" />
          <div className="scanlines pointer-events-none absolute inset-0 opacity-50" />
          <div className="vignette pointer-events-none absolute inset-0" />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col">
        {!inMatch && screen.name !== "menu" && (
          <header className="flex items-center gap-6 px-6 pb-2 pt-3 md:px-10">
            <button onClick={back} className="flex items-center gap-3 transition hover:brightness-125" aria-label="Return to PixelRuggas home">
              <GameMark size={38} />
            </button>
            <nav className="hidden items-center gap-1 md:flex">
              {TABS.map((t) => {
                const active = t.screen.name === screen.name || (t.screen.name === "competitions" && screen.name === "hub");
                return (
                  <button
                    key={t.label}
                    onClick={() => go(t.screen)}
                    className={`font-pixel border-b-2 px-3 py-2 text-[10px] uppercase tracking-[0.2em] transition ${
                      active ? "border-yellow-400 text-yellow-400" : "border-transparent text-slate-300 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              {user ? (
                <>
                  <button onClick={() => go({ name: "profile" })} className="flex items-center gap-2 border-2 border-black bg-[#0b1020]/90 py-1 pl-1 pr-3 shadow-[3px_3px_0_#000]">
                    {fav ? (
                      <Crest team={fav} size={24} />
                    ) : (
                      <span className="font-pixel grid h-7 w-7 place-items-center bg-yellow-400 text-[9px] text-black">{user.username.slice(0, 2).toUpperCase()}</span>
                    )}
                    <span className="font-pixel text-[10px]">{user.username.toUpperCase()}</span>
                  </button>
                  <button onClick={logout} className="font-pixel text-[9px] uppercase tracking-widest text-slate-400 hover:text-white">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => go({ name: "profile", mode: "login" })} className="font-pixel text-[9px] uppercase tracking-widest text-slate-300 hover:text-white">
                    Sign in
                  </button>
                  <button onClick={() => go({ name: "profile", mode: "register" })} className="px-btn primary !py-2 !text-[9px]">
                    Create account
                  </button>
                </>
              )}
            </div>
          </header>
        )}

        <div className={`min-h-0 flex-1 ${inMatch || screen.name === "menu" ? "overflow-hidden" : "overflow-y-auto scroll px-6 pb-2 pt-2 md:px-10"}`}>
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
          <footer className="flex items-center gap-4 px-6 py-3 text-slate-300 md:px-10">
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
