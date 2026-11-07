import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
import { cn } from "../cn.js";
import { Button } from "../primitives/Button.js";

function Dialog({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn("fixed inset-0 isolate z-50 bg-[rgb(18_19_22/0.45)]", className)}
      {...props}
    />
  );
}

/*
 * Dialog motion. These keyframes live here, not in Tailwind utilities, because
 * the animate-in plugin is not installed. Radix keeps the content mounted until
 * its exit animation ends. BRAND timings from packages/web-ui/src/lib/motion.ts:
 * 240 ms in, 160 ms out, the BRAND ease (--ease-count), no overshoot. Only
 * opacity and scale move, so the centring translate is left alone. Reduced
 * motion turns it off.
 */
const DIALOG_MOTION = `
@keyframes baret-dialog-fade-in { from { opacity: 0; } }
@keyframes baret-dialog-fade-out { to { opacity: 0; } }
@keyframes baret-dialog-in { from { opacity: 0; scale: 0.98; } }
@keyframes baret-dialog-out { to { opacity: 0; scale: 0.98; } }
[data-slot="dialog-overlay"][data-state="open"] { animation: baret-dialog-fade-in 240ms var(--ease-count) both; }
[data-slot="dialog-overlay"][data-state="closed"] { animation: baret-dialog-fade-out 160ms var(--ease-count) both; }
[data-slot="dialog-content"][data-state="open"] { animation: baret-dialog-in 240ms var(--ease-count) both; }
[data-slot="dialog-content"][data-state="closed"] { animation: baret-dialog-out 160ms var(--ease-count) both; }
@media (prefers-reduced-motion: reduce) {
  [data-slot="dialog-overlay"], [data-slot="dialog-content"] { animation: none !important; }
}
`;

/*
 * The built-in close button needs a name, and copy lives in packages/content,
 * so it renders only when the caller passes `closeLabel`. `showCloseButton`
 * stays a plain boolean because CommandDialog forwards one.
 */
type DialogCloseLabelProps = { showCloseButton?: boolean; closeLabel?: string };

function DialogContent({
  className,
  children,
  showCloseButton = true,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & DialogCloseLabelProps) {
  return (
    <DialogPortal>
      <style href="baret-dialog-motion" precedence="default">
        {DIALOG_MOTION}
      </style>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none sm:max-w-sm",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && closeLabel ? (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button variant="ghost" className="absolute top-2 right-2" size="icon">
              <XIcon aria-hidden="true" />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="dialog-header" className={cn("flex flex-col gap-2", className)} {...props} />
  );
}

/* A footer close button is shown only when the caller passes its label. */
function DialogFooter({
  className,
  closeLabel,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  closeLabel?: string;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    >
      {children}
      {closeLabel ? (
        <DialogPrimitive.Close asChild>
          <Button variant="ghost">{closeLabel}</Button>
        </DialogPrimitive.Close>
      ) : null}
    </div>
  );
}

function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
