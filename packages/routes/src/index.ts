/**
 * @baret/routes
 *
 * One shape for a route, one way to build a link, and the checks that stop the
 * three surfaces drifting apart.
 *
 * Baret renders in three places: the marketing site, the standalone wallet and
 * the extension. They do not share a router, and they should not: the site uses
 * history routing, the extension options page uses hash routing because an
 * extension page has no server to rewrite paths, and the popup has no router at
 * all. What they do share is the discipline that a path is declared once, in a
 * registry, and every link is built from it.
 *
 * Nothing here imports React or a router. It is data and functions, so the
 * registry can be read by a test, by a nav component, or by a script.
 */

/** A route the user can reach. */
export interface RouteDef {
  /** The path pattern, including any `:param` segments. Always starts with "/". */
  readonly path: string;
  /** The document title for this route. */
  readonly title: string;
  /** The label a nav renders. Absent means the route is not in any nav. */
  readonly label?: string;
  /** Which nav group this belongs to, if any. */
  readonly group?: string;
  /** Loads the route module. The router calls this; tests call it too. */
  readonly load: () => Promise<unknown>;
  /** Routes that exist but are only reachable from another surface. */
  readonly hidden?: boolean;
}

export type RouteRegistry = Readonly<Record<string, RouteDef>>;

/**
 * Identity function that keeps literal types while checking the shape.
 *
 * Without it you either lose the key union (so `href("typo")` compiles) or you
 * annotate the registry and lose the literal paths.
 */
export function defineRoutes<const T extends RouteRegistry>(
  routes: T,
): { [K in keyof T]: T[K] & RouteDef } {
  // The intersection is what keeps `group` and `label` visible on entries that
  // omit them, while the literal paths survive for the href builder.
  return routes as { [K in keyof T]: T[K] & RouteDef };
}

/** The parameter names in a path pattern: "/sites/:id" gives "id". */
export type PathParams<P extends string> = P extends `${string}:${infer Rest}`
  ? Rest extends `${infer Param}/${infer Tail}`
    ? Param | PathParams<`/${Tail}`>
    : Rest
  : never;

/**
 * Build a link from a registry key.
 *
 * The parameter object is required exactly when the path has parameters, so a
 * missing one is a type error rather than a `/sites/:b64` in production.
 */
export function buildHref<T extends RouteRegistry, K extends keyof T & string>(
  routes: T,
  key: K,
  ...args: PathParams<T[K]["path"]> extends never
    ? [params?: undefined, search?: Record<string, string>]
    : [params: Record<PathParams<T[K]["path"]>, string>, search?: Record<string, string>]
): string {
  const [params, search] = args;
  const route = routes[key];
  if (!route) throw new Error(`No route named "${key}".`);

  let path: string = route.path;
  if (params) {
    for (const [name, value] of Object.entries(params as Record<string, string>)) {
      path = path.replace(`:${name}`, encodeURIComponent(value));
    }
  }

  const query = search ? new URLSearchParams(search).toString() : "";
  return query ? `${path}?${query}` : path;
}

/** Every route that carries a label, in declaration order. */
export function navRoutes<T extends RouteRegistry>(
  routes: T,
  group?: string,
): Array<{ key: keyof T & string; path: string; label: string }> {
  return Object.entries(routes)
    .filter(([, route]) => route.label !== undefined && !route.hidden)
    .filter(([, route]) => (group === undefined ? true : route.group === group))
    .map(([key, route]) => ({
      key: key as keyof T & string,
      path: route.path,
      label: route.label as string,
    }));
}

/** A problem found by `checkRegistry`. */
export interface RegistryProblem {
  key: string;
  message: string;
}

/**
 * The checks a registry has to pass. Called from each app's route test so a
 * bad path fails in CI rather than as a blank screen.
 */
export function checkRegistry(routes: RouteRegistry): RegistryProblem[] {
  const problems: RegistryProblem[] = [];
  const seen = new Map<string, string>();

  for (const [key, route] of Object.entries(routes)) {
    if (!route.path.startsWith("/")) {
      problems.push({ key, message: `path "${route.path}" does not start with a slash` });
    }
    if (route.path.length > 1 && route.path.endsWith("/")) {
      problems.push({ key, message: `path "${route.path}" has a trailing slash` });
    }
    if (route.path !== route.path.toLowerCase()) {
      problems.push({ key, message: `path "${route.path}" is not lowercase` });
    }
    if (route.title.trim() === "") {
      problems.push({ key, message: "title is empty" });
    }

    const previous = seen.get(route.path);
    if (previous !== undefined) {
      problems.push({ key, message: `path "${route.path}" is already used by "${previous}"` });
    }
    seen.set(route.path, key);
  }

  return problems;
}

/**
 * Pull every internal link out of a content object.
 *
 * The copy in @baret/content carries hrefs. They are plain strings there on
 * purpose, because the content package must not depend on a router. This walks
 * the object so a test can assert every one of them points at a real route.
 */
export function collectHrefs(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    if (value.startsWith("/") && !value.startsWith("//")) found.add(value);
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHrefs(item, found);
    return found;
  }
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) collectHrefs(item, found);
  }
  return found;
}

/** True when a concrete path matches a pattern that may contain parameters. */
export function matchesPattern(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  if (pattern === "*" || pattern.endsWith("/*")) {
    return path.startsWith(pattern.slice(0, -1));
  }

  const patternParts = pattern.split("/");
  const pathParts = path.split("/");
  if (patternParts.length !== pathParts.length) return false;

  return patternParts.every((part, i) => part.startsWith(":") || part === pathParts[i]);
}

/** The hrefs in `content` that no route in `routes` can serve. */
export function findBrokenHrefs(routes: RouteRegistry, content: unknown): string[] {
  const patterns = Object.values(routes).map((route) => route.path);
  return [...collectHrefs(content)]
    .map((href) => href.split(/[?#]/)[0] ?? href)
    .filter((path) => !patterns.some((pattern) => matchesPattern(pattern, path)))
    .sort();
}
