"use client";

import { keyLabel, type Bindings } from "@/game/controls";
import { Kbd, Kicker, Panel, ScreenHeader, Scroll } from "./ui";

const LAWS: [string, string][] = [
  ["Scoring", "Try 5 pts, conversion 2, penalty goal 3, drop goal 3. Carry the ball over the line and dive (Action) or keep running to ground it."],
  ["Passing", "The ball may only travel backwards. A forward pass gives a scrum to the opposition."],
  ["Knock-on", "Dropping the ball forwards – more likely under pressure or while catching a high ball – concedes a scrum."],
  ["Tackle & ruck", "After a tackle a ruck forms. Support players arriving first secure the ball; arrive alone against numbers and you can be turned over or penalised for holding on."],
  ["Offside", "At a ruck defenders stay behind the red line and attackers behind the blue line until the ball is out. You get a short grace period – GET ONSIDE!"],
  ["Kicking & touch", "Kicked directly into touch from outside your 22 = lineout back where you kicked it. From inside your 22 you gain the ground."],
  ["Set pieces", "Scrums and lineouts are contested automatically using your pack and jumpers. The put-in side usually wins – not always."],
  ["Restarts", "The conceding team restarts with a kick-off from halfway. Balls made dead in-goal lead to a goal-line drop-out."],
  ["Penalties", "High tackles, collapsed scrums and ruck infringements give penalties: kick at goal, kick to the corner, or tap and run."],
  ["Player pace & power", "Pace is permanent and position-based: wings and fullbacks are the quickest runners, centres and halfbacks are agile, while props and locks are slower but far stronger in contact."],
  ["Time", "The clock is scaled to a full 80 minutes. When time is up, play continues until the next stoppage."],
];

export default function HowToScreen({ bindings }: { bindings: Bindings }) {
  const k = (c: string) => <Kbd>{keyLabel(c)}</Kbd>;
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader kicker="Tutorial" title="How to play" />
      <Scroll className="pr-2">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="p-4">
            <Kicker>Controls (your current bindings)</Kicker>
            <ul className="mt-3 space-y-2 text-slate-200">
              <li>{k(bindings.up)}{k(bindings.down)}{k(bindings.left)}{k(bindings.right)} move · {k(bindings.sprint)} hold to sprint</li>
              <li>{k(bindings.passUp)} / {k(bindings.passDown)} pass to a team-mate up / down the screen</li>
              <li>{k(bindings.kick)} hold to charge a punt in the direction you face, tap for a grubber</li>
              <li>{k(bindings.dropGoal)} drop goal (within ~55 m of the posts)</li>
              <li>{k(bindings.action)} tackle · dive for the line · take a kick-off · stop the goal-kick meter · skip replays</li>
              <li>{k(bindings.switch)} switch to the nearest defender</li>
              <li>{k(bindings.opt1)} {k(bindings.opt2)} {k(bindings.opt3)} penalty: goal / touch / tap</li>
              <li>{k(bindings.pause)} pause · {k(bindings.help)} hide the on-screen help</li>
            </ul>
            <Kicker className="mt-6">Tips</Kicker>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-200">
              <li>Draw a defender before you pass – your support runner hits the gap at pace.</li>
              <li>Deep in your 22, hold kick and clear to touch. The ball can go out on the full from inside the 22.</li>
              <li>Use wide backs for pace and stepping; use powerful forwards close to the ruck to win collisions.</li>
              <li>On the goal-kick meter set power past the white marker, then stop the aim marker in the green zone.</li>
              <li>Every try triggers a slow-motion replay – press {k(bindings.action)} to skip it.</li>
            </ul>
          </Panel>
          <Panel className="p-4">
            <Kicker>Laws of the game</Kicker>
            <dl className="mt-3 space-y-2">
              {LAWS.map(([t, d]) => (
                <div key={t}>
                  <dt className="font-pixel text-[9px] uppercase text-white">{t}</dt>
                  <dd className="text-slate-300">{d}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      </Scroll>
    </div>
  );
}
