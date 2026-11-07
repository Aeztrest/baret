import { useState } from "react";
import { cn } from "../cn.js";

/**
 * A truncated address with a copy affordance.
 *
 * Shows six characters at the front and four at the back. Enough to compare
 * against what a site displayed, which is the check that catches an address
 * that was swapped at the last step. The full value is always in the title,
 * so it can be read without copying.
 */
/*
 * A copy control needs its two words, and copy lives in packages/content, so
 * the caller passes them. A chip that only shows the address needs none.
 */
type AddressChipCopyProps =
  | { copyable?: true; copyLabel: string; copiedLabel: string }
  | { copyable: false; copyLabel?: never; copiedLabel?: never };

export type AddressChipProps = {
  address: string;
  className?: string;
} & AddressChipCopyProps;

/*
 * The elision is three ASCII dots, not the ellipsis character: the copy rules
 * ban that character and the shortened address is on screen everywhere.
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AddressChip({
  address,
  copyable = true,
  copyLabel,
  copiedLabel,
  className,
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // A denied clipboard is not worth an error state. The title attribute
      // still carries the full address for anyone who needs it.
    }
  }

  const content = (
    <>
      <span data-numeric className="font-mono text-sm">
        {truncateAddress(address)}
      </span>
      {copyable ? (
        <span
          aria-live="polite"
          className="font-mono text-label uppercase text-[color:var(--fg-faint)]"
        >
          {copied ? copiedLabel : copyLabel}
        </span>
      ) : null}
    </>
  );

  if (!copyable) {
    return (
      <span data-slot="address" title={address} className={cn("inline-flex gap-2", className)}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={address}
      data-slot="address"
      className={cn(
        "inline-flex items-center gap-2 border border-[color:var(--rule)] px-2 py-1 transition-colors hover:border-[color:var(--rule-strong)]",
        className,
      )}
    >
      {content}
    </button>
  );
}
