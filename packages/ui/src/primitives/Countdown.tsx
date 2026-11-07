import { useEffect, useState } from "react";
import { cn } from "../cn.js";

/**
 * The auto-decline timer on a sign request.
 *
 * A request that sits open forever is a request someone approves by accident
 * later. When this reaches zero the caller declines; nothing is ever approved
 * by a timeout.
 */
export function Countdown({
  seconds,
  onExpire,
  label,
  className,
}: {
  seconds: number;
  onExpire?: () => void;
  /** Takes {time}, so the wording stays in the content package. */
  label: string;
  className?: string;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onExpire?.();
      return;
    }
    const id = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(id);
  }, [left, onExpire]);

  const minutes = Math.floor(Math.max(left, 0) / 60);
  const rest = Math.max(left, 0) % 60;
  const formatted = `${minutes}:${String(rest).padStart(2, "0")}`;

  return (
    <p
      data-numeric
      // Announcing every second would be unusable, so the timer is silent to a
      // screen reader and the decline is announced when it happens.
      aria-hidden="true"
      className={cn("text-center font-mono text-xs text-[color:var(--fg-faint)]", className)}
    >
      {label.replace("{time}", formatted)}
    </p>
  );
}
