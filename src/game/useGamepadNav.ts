"use client";

import { useEffect } from "react";
import { MenuPad } from "./gamepad";

/**
 * Universal controller navigation for any screen.
 *
 * Moves keyboard focus between the focusable controls inside `rootSelector` using the
 * left stick / d-pad, in the spatial direction pushed. A confirms (clicks) the focused
 * control, B calls `onBack`. Because it works on real DOM focus, every existing screen
 * gets controller support without screen-specific wiring, and the screen's own
 * keyboard handlers keep working.
 */
export function useGamepadNav(
  rootSelector: string,
  onBack?: () => void,
  enabled = true,
  onBumper?: (dir: -1 | 1) => void,
): void {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const reader = new MenuPad();
    let raf = 0;
    let lastH = 0;
    let hRepeatAt = 0;
    let prevLb = false;
    let prevRb = false;

    const focusables = (): HTMLElement[] => {
      // If a full-screen overlay (pack reveal, result card, pause menu) is open, navigate
      // inside it; otherwise navigate the screen root. This is what makes "every display"
      // reachable rather than only the main screen area.
      const overlays = Array.from(document.querySelectorAll<HTMLElement>("[data-pad-overlay], .fixed.inset-0"))
        .filter((el) => el.getBoundingClientRect().width > 0 && el.querySelector("button, [role='button'], a[href], input, select"));
      const root = overlays.length ? overlays[overlays.length - 1] : (document.querySelector(rootSelector) ?? document.body);
      return Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [role="button"], a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      });
    };

    const move = (dx: number, dy: number) => {
      const items = focusables();
      if (!items.length) return;
      const cur = document.activeElement as HTMLElement | null;
      if (!cur || !items.includes(cur)) {
        items[0].focus();
        items[0].scrollIntoView({ block: "nearest", inline: "nearest" });
        return;
      }
      const a = cur.getBoundingClientRect();
      const ax = a.left + a.width / 2;
      const ay = a.top + a.height / 2;
      let best: HTMLElement | null = null;
      let bestScore = Infinity;
      for (const el of items) {
        if (el === cur) continue;
        const r = el.getBoundingClientRect();
        const bx = r.left + r.width / 2;
        const by = r.top + r.height / 2;
        const vx = bx - ax;
        const vy = by - ay;
        // must be in the pushed direction
        const along = vx * dx + vy * dy;
        if (along <= 4) continue;
        const across = Math.abs(vx * dy - vy * dx);
        // favour things straight ahead; penalise sideways drift heavily
        const score = along + across * 2.4;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      if (best) {
        best.focus();
        best.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    };

    const tick = () => {
      const nav = reader.poll();
      if (nav.up) move(0, -1);
      if (nav.down) move(0, 1);
      // horizontal from the raw pad (MenuPad only reports vertical)
      let h = 0;
      if (typeof navigator !== "undefined" && navigator.getGamepads) {
        for (const p of navigator.getGamepads()) {
          if (!p || !p.connected) continue;
          const ax = p.axes[0] ?? 0;
          h = Math.abs(ax) > 0.55 ? Math.sign(ax) : 0;
          if (p.buttons[14]?.pressed) h = -1;
          if (p.buttons[15]?.pressed) h = 1;
          break;
        }
      }
      const now = performance.now();
      if (h !== 0 && (h !== lastH || now >= hRepeatAt)) {
        move(h, 0);
        hRepeatAt = now + (h !== lastH ? 340 : 170);
      }
      lastH = h;
      if (nav.confirm) {
        const cur = document.activeElement as HTMLElement | null;
        if (cur && cur !== document.body) cur.click();
        else focusables()[0]?.focus();
      }
      if (nav.back && onBack) onBack();
      // LB / RB (buttons 4 / 5) cycle sections where a screen supports it.
      if (onBumper && typeof navigator !== "undefined" && navigator.getGamepads) {
        for (const p of navigator.getGamepads()) {
          if (!p || !p.connected) continue;
          const lb = !!p.buttons[4]?.pressed;
          const rb = !!p.buttons[5]?.pressed;
          if (lb && !prevLb) onBumper(-1);
          if (rb && !prevRb) onBumper(1);
          prevLb = lb; prevRb = rb;
          break;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rootSelector, onBack, enabled, onBumper]);
}
