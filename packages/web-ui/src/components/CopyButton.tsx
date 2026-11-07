import { Check, Copy } from "lucide-react";
import { type JSX, useEffect, useState } from "react";
import { cx } from "../lib/util.js";

/**
 * Copies one string to the clipboard: an address, a command, a code sample.
 *
 * A real button with its own label ("Copy the address"); after a copy the
 * label reads `done` ("Copied") for two seconds and the change is announced
 * once through the button's own status region. If the browser refuses the
 * clipboard, `onError` runs so the screen can show its own message (the
 * wallet's receive page explains how to copy by hand); nothing is announced
 * as copied.
 *
 * Mono label, square, no fill: it sits beside data, never competes with the
 * page's one primary action. 44 px hit area.
 */
export function CopyButton({
  text,
  label,
  done,
  onError,
  inverse = false,
  className,
}: {
  text: string;
  label: string;
  done: string;
  onError?: () => void;
  /** On a graphite band: chalk instead of the theme's ink. */
  inverse?: boolean;
  className?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      onError?.();
    }
  }

  const Icon = copied ? Check : Copy;
  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className={cx(
          "inline-flex min-h-11 shrink-0 items-center gap-2 px-2 font-mono text-label uppercase transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-[color:var(--accent)]",
          inverse
            ? "text-chalk/80 hover:text-chalk"
            : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]",
          className,
        )}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
        {copied ? done : label}
      </button>
      <span role="status" className="sr-only">
        {copied ? done : ""}
      </span>
    </>
  );
}
