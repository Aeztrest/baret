import type { SVGProps } from "react";

/**
 * The Baret mark: a hard hat reduced to three cuts.
 *
 * Dome, a visor slit cut through it, and a brim whose ends are chamfered.
 * The slit is the product (it looks before you sign). The chamfer is the
 * system: every tag and button in the product carries the same cut corner.
 *
 * Geometry is fixed on a 64 unit grid and is specified in docs/BRAND.md
 * section 02. Do not adjust the paths. This component is the only source of
 * the mark; it is never exported as a raster.
 */

export interface MarkProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  /** Rendered size in pixels. The mark is square. */
  size?: number | string;
  /**
   * The colour showing through the visor slit. It has to match the surface
   * behind the mark, because the slit is a cut and not a stroke.
   */
  slit?: string;
  /** Use currentColor for the hat instead of the brand orange. */
  mono?: boolean;
  /**
   * Hide the mark from assistive tech. Use it wherever a wordmark or a heading
   * beside the mark already names the product, so the name is read once.
   */
  decorative?: boolean;
  /**
   * The accessible name when the mark stands alone. Defaults to the brand
   * name, which is a proper noun and reads the same in every locale.
   */
  label?: string;
}

export function Mark({
  size = 24,
  slit = "var(--surface, #f8f8f5)",
  mono = false,
  decorative = false,
  label = "Baret",
  ...rest
}: MarkProps) {
  const hat = mono ? "currentColor" : "var(--accent, #ff4f00)";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? true : undefined}
      focusable={decorative ? false : undefined}
      {...rest}
    >
      {/* Dome: 38 wide, 24 tall, shoulders at 3:2. Flatter than a half circle,
          which is what makes it read as a helmet. */}
      <path d="M13 38C13 22.5 21 14 32 14s19 8.5 19 24Z" fill={hat} />
      {/* Visor: a cut, not a stroke. 22 by 4, centred at y=29. */}
      <rect x="21" y="27" width="22" height="4" fill={slit} />
      {/* Brim: 52 wide, both ends chamfered 3 units. */}
      <path d="M6 41h52l3 3.5-3 4.5H6l-3-4.5Z" fill={hat} />
    </svg>
  );
}
