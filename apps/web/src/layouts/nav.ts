import { navRoutes } from "@baret/routes";
import { routes } from "../routes.js";

/** Every marketing page, in registry order: Showcase, Agents, Docs, Partners, Install. */
export const NAV = navRoutes(routes, "marketing");

/**
 * Every marketing page sits on the landing's frame (FRAME in @baret/web-ui
 * lib/layout), so the header and the footer share its width and gutters.
 */
export const ROW = "max-w-[1276px] px-4 md:px-8 lg:px-12";
