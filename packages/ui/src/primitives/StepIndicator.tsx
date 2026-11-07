import { cn } from "../cn.js";

/**
 * Onboarding progress. Eight steps in the extension, five in the wallet.
 *
 * Filled squares rather than a bar, because the count is the useful part: a
 * reader wants to know how many screens are left, not what fraction is done.
 */
export function StepIndicator({
  steps,
  current,
  className,
}: {
  steps: readonly string[];
  /** Zero-based. */
  current: number;
  className?: string;
}) {
  return (
    <div data-slot="steps" className={cn("grid gap-2", className)}>
      <ol className="flex gap-1" aria-label="Progress">
        {steps.map((step, index) => (
          <li
            key={step}
            aria-current={index === current ? "step" : undefined}
            className={cn(
              "h-1.5 flex-1",
              index < current && "bg-[color:var(--accent)]",
              index === current && "bg-[color:var(--accent)]",
              index > current && "bg-[color:var(--rule)]",
            )}
          />
        ))}
      </ol>
      <p className="font-mono text-label uppercase text-[color:var(--fg-faint)]">
        Step {current + 1} of {steps.length}. {steps[current]}
      </p>
    </div>
  );
}
