"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

const control =
  "h-10 w-full rounded-ctl border border-edge-strong bg-base px-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-saffron-line aria-[invalid=true]:border-coral";

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-xs text-ink-2">
        {label}
        {hint && <span className="text-ink-3">{hint}</span>}
      </span>
      {children}
      {error && <span className="text-2xs text-coral">{error}</span>}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, className)} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(control, "appearance-none pr-8", className)}>
      {children}
    </select>
  );
}

/** Segmented choice (e.g. difficulty, kind). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-full bg-well p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-8 flex-1 rounded-full px-3 text-xs transition", value === o.value ? "bg-ink text-base" : "text-ink-2 hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A modal form with a title, fields, an error line and a primary submit. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  busy,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-slab border border-edge-strong bg-slab p-6 shadow-2xl shadow-black/70 animate-fade-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="font-display text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</Dialog.Title>
              <Dialog.Description className={description ? "text-xs text-ink-3" : "sr-only"}>{description ?? title}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-ink-3 hover:bg-well hover:text-ink">
              <X size={16} />
            </Dialog.Close>
          </div>
          <form
            className="mt-5 flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
            {error && (
              <p role="alert" className="rounded-ctl bg-coral-soft px-3 py-2 text-xs text-coral">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" className="h-11 w-full justify-center" disabled={busy}>
              {busy ? "Saving…" : submitLabel}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
