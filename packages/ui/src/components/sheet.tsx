import { XIcon } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../cn.js";
import { Button } from "../primitives/Button.js";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/*
 * Sheet motion. These keyframes live here, not in Tailwind utilities, because
 * the animate-in plugin is not installed. Radix keeps the content mounted until
 * its exit animation ends, so the fall-out plays too. BRAND section 08 sheet
 * slide: 260 ms in on the sheet curve (--ease-out-soft, EASE_OUT_SOFT in
 * packages/web-ui/src/lib/motion.ts), 160 ms out, no overshoot. The overlay
 * fades on the same timing. Reduced motion turns it off.
 */
const SHEET_MOTION = `
@keyframes baret-sheet-fade-in { from { opacity: 0; } }
@keyframes baret-sheet-fade-out { to { opacity: 0; } }
@keyframes baret-sheet-in { from { opacity: 0; translate: var(--baret-sheet-from); } }
@keyframes baret-sheet-out { to { opacity: 0; translate: var(--baret-sheet-from); } }
[data-slot="sheet-overlay"][data-state="open"] { animation: baret-sheet-fade-in 260ms var(--ease-out-soft) both; }
[data-slot="sheet-overlay"][data-state="closed"] { animation: baret-sheet-fade-out 160ms var(--ease-out-soft) both; }
[data-slot="sheet-content"] { --baret-sheet-from: 2.5rem 0; }
[data-slot="sheet-content"][data-side="left"] { --baret-sheet-from: -2.5rem 0; }
[data-slot="sheet-content"][data-side="top"] { --baret-sheet-from: 0 -2.5rem; }
[data-slot="sheet-content"][data-side="bottom"] { --baret-sheet-from: 0 2.5rem; }
[data-slot="sheet-content"][data-state="open"] { animation: baret-sheet-in 260ms var(--ease-out-soft) both; }
[data-slot="sheet-content"][data-state="closed"] { animation: baret-sheet-out 160ms var(--ease-out-soft) both; }
@media (prefers-reduced-motion: reduce) {
  [data-slot="sheet-overlay"], [data-slot="sheet-content"] { animation: none !important; }
}
`;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-[rgb(18_19_22/0.45)]", className)}
      {...props}
    />
  );
}

/*
 * The built-in close button needs a name, and copy lives in packages/content,
 * so a caller that keeps the button must pass `closeLabel`. A caller that
 * renders its own close sets `showCloseButton={false}` and passes nothing.
 */
type SheetCloseProps =
  | { showCloseButton?: true; closeLabel: string }
  | { showCloseButton: false; closeLabel?: never };

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  closeLabel,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
} & SheetCloseProps) {
  return (
    <SheetPortal>
      <style href="baret-sheet-motion" precedence="default">
        {SHEET_MOTION}
      </style>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-none data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button variant="ghost" className="absolute top-2 right-2" size="icon">
              <XIcon aria-hidden="true" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-medium text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
