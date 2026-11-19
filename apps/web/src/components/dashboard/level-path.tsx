"use client";

import { PROFILE_XP_SCALE, xpForLevel } from "@/lib/progression";

/**
 * The level path: lifetime XP on one axis, with a tick at the XP each level
 * needs. Ticks spread out as levels get more expensive, so the curve itself
 * is visible. The filled part is the XP already earned.
 */
export function LevelPath({ xp, level }: { xp: number; level: number }) {
  const lastLevel = level + 3;
  const max = xpForLevel(lastLevel, PROFILE_XP_SCALE);
  const pos = (v: number) => Math.min(1, v / max);
  const levels = Array.from({ length: lastLevel - 1 }, (_, i) => i + 2); // 2 … lastLevel

  // Labels: always current, next and last; then round numbers if they don't collide.
  const wanted = [level, level + 1, lastLevel, 1, 5, 10, 15, 20, 25, 30].filter((l) => l >= 1 && l <= lastLevel);
  const labels: number[] = [];
  for (const l of wanted) {
    const x = pos(xpForLevel(l, PROFILE_XP_SCALE));
    if (labels.every((o) => Math.abs(pos(xpForLevel(o, PROFILE_XP_SCALE)) - x) > 0.045)) labels.push(l);
  }

  const here = pos(xp);
  return (
    <figure
      aria-label={`Level path: ${xp.toLocaleString()} lifetime XP. Level ${level + 1} at ${xpForLevel(level + 1, PROFILE_XP_SCALE).toLocaleString()} XP.`}
    >
      <div className="relative h-16">
        {/* "you" callout */}
        <div
          className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
          style={{ left: `${here * 100}%` }}
          aria-hidden
        >
          <span className="num rounded-full bg-saffron px-2 py-0.5 text-2xs font-medium whitespace-nowrap text-saffron-ink">
            {xp.toLocaleString()} XP
          </span>
          <span className="h-3 w-px bg-saffron" />
        </div>

        {/* track */}
        <div className="absolute inset-x-0 top-[34px] h-2 rounded-full bg-well" aria-hidden />
        <div
          className="absolute top-[34px] left-0 h-2 rounded-full bg-gradient-to-r from-saffron/15 via-saffron/60 to-saffron"
          style={{ width: `${here * 100}%` }}
          aria-hidden
        />
        {/* level ticks */}
        {levels.map((l) => {
          const x = pos(xpForLevel(l, PROFILE_XP_SCALE));
          const reached = l <= level;
          return (
            <span
              key={l}
              aria-hidden
              className={`absolute top-[31px] h-3.5 w-px ${reached ? "bg-base/70" : "bg-edge-strong"}`}
              style={{ left: `${x * 100}%` }}
            />
          );
        })}
        {/* next level marker */}
        <span
          aria-hidden
          className="absolute top-[30px] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-dashed border-saffron-line bg-slab"
          style={{ left: `${pos(xpForLevel(level + 1, PROFILE_XP_SCALE)) * 100}%` }}
        />
        {/* labels */}
        {labels.map((l) => {
          const x = pos(xpForLevel(l, PROFILE_XP_SCALE));
          const isCur = l === level;
          const isNext = l === level + 1;
          return (
            <span
              key={l}
              aria-hidden
              className={`num absolute top-[50px] text-2xs whitespace-nowrap ${
                isCur ? "font-medium text-ink" : isNext ? "font-medium text-saffron" : "text-ink-3"
              } ${x === 0 ? "" : x === 1 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${x * 100}%` }}
            >
              {l}
            </span>
          );
        })}
      </div>
      <figcaption className="mt-2 text-2xs text-ink-3">
        Each tick is a level. They spread out because level L needs {PROFILE_XP_SCALE}·(L−1)<sup>1.8</sup> lifetime XP.
      </figcaption>
    </figure>
  );
}
