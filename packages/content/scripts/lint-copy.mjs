#!/usr/bin/env node
/**
 * Copy linter for @baret/content.
 *
 * Reads every string literal in src/ and fails the build on the writing rules
 * from docs/BRAND.md that a human will otherwise forget. Run with:
 *   node scripts/lint-copy.mjs
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const srcDir = join(root, "src");

/** Characters we never use in copy, and what to use instead. */
const BANNED_CHARS = [
  ["—", "em dash. Use a full stop, a comma, or start a new sentence."],
  ["–", "en dash. Use 'to' in a range, or a full stop."],
  ["…", "ellipsis character. Type three dots only if a control is really loading."],
  [" ", "non-breaking space. Use a normal space."],
  ["“", "curly quote. Use a straight quote."],
  ["”", "curly quote. Use a straight quote."],
  ["‘", "curly apostrophe. Use a straight apostrophe."],
  ["’", "curly apostrophe. Use a straight apostrophe."],
];

/** Words banned by docs/BRAND.md section 09, plus the usual AI filler. */
const BANNED_WORDS = [
  "revolutionary",
  "seamless",
  "seamlessly",
  "unlock the power",
  "empower",
  "empowering",
  "disruptive",
  "game-changing",
  "game changer",
  "cutting-edge",
  "state-of-the-art",
  "best-in-class",
  "world-class",
  "military-grade",
  "bank-level",
  "bank-grade",
  "next-generation",
  "next-gen",
  "leverage",
  "utilize",
  "robust",
  "delve",
  "elevate",
  "unparalleled",
  "effortless",
  "effortlessly",
  "supercharge",
  "turbocharge",
  "LFG",
  "wagmi",
  "degen",
  "100x",
  "moon",
  "ape in",
  "in today's fast-paced",
  "it's important to note",
  "look no further",
  "whether you're",
  "not only",
  "the future of",
  "peace of mind",
];

/** Turkish characters. The repo is English only. */
const TURKISH = /[şğıİçöüŞĞÇÖÜ]/;

/** A sentence longer than this reads as a paragraph in a 360px popup. */
const MAX_SENTENCE_WORDS = 30;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Blank out comments, keeping newlines so line numbers stay correct.
 * An apostrophe inside a comment would otherwise open a fake string literal
 * and swallow everything up to the next one.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

/** Pull every single-quoted, double-quoted and backtick string out of a file. */
function stringsOf(source) {
  const code = stripComments(source);
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  return [...code.matchAll(re)].map((match) => ({
    value: match[2] ?? "",
    line: code.slice(0, match.index).split("\n").length,
  }));
}

const problems = [];

for (const file of walk(srcDir)) {
  const rel = relative(root, file);
  const source = readFileSync(file, "utf8");

  // Import specifiers and type-only files carry no copy.
  for (const { value, line } of stringsOf(source)) {
    if (value.length < 3) continue;
    if (value.startsWith("./") || value.startsWith("../")) continue;
    if (/^[a-z0-9-]+$/.test(value) && value.length < 24) continue; // slugs, ids

    for (const [char, why] of BANNED_CHARS) {
      if (value.includes(char)) {
        problems.push(`${rel}:${line} contains a ${why}\n    ${value.slice(0, 90)}`);
      }
    }

    if (TURKISH.test(value)) {
      problems.push(
        `${rel}:${line} contains Turkish characters. Copy is English.\n    ${value.slice(0, 90)}`,
      );
    }

    const lower = value.toLowerCase();
    for (const word of BANNED_WORDS) {
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (re.test(lower)) {
        problems.push(`${rel}:${line} uses the banned word "${word}".\n    ${value.slice(0, 90)}`);
      }
    }

    for (const sentence of value.split(/(?<=[.!?])\s+/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length > MAX_SENTENCE_WORDS) {
        problems.push(
          `${rel}:${line} has a ${words.length}-word sentence. Split it.\n    ${sentence.slice(0, 90)}`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`\nCopy lint found ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  ${problem}\n`);
  process.exit(1);
}

console.log("Copy lint passed.");
