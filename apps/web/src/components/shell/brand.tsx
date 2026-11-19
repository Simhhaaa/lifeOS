import Link from "next/link";

/** Mark: a rising step line inside a saffron tile, for levelling up. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 28 28">
      <rect width="28" height="28" rx="9" fill="var(--saffron)" />
      <path
        d="M7 19.5h4.5V15H16v-4.5h5"
        fill="none"
        stroke="var(--saffron-ink)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" aria-label="LIFEOS overview" className="flex shrink-0 items-center gap-2.5 rounded-ctl">
      <BrandMark />
      <span className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
        life<span className="text-saffron">os</span>
      </span>
    </Link>
  );
}
