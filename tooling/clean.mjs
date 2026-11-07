#!/usr/bin/env node
/** Removes the given directories (cross-platform `rm -rf` for package scripts). */
import { rmSync } from "node:fs";

for (const dir of process.argv.slice(2)) rmSync(dir, { recursive: true, force: true });
