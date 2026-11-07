/**
 * The import target shadcn-generated components use.
 *
 * The CLI now defaults to the `cn` npm package. We keep our own so there is a
 * single class-merge implementation in the repo and one fewer dependency in an
 * extension we have to submit to AMO with full sources.
 */
export { cn } from "../cn.js";
