import { cleanup } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { afterEach } from "vitest";

/** Motion settles at once in tests, so interaction tests never wait on an
 *  animation (H1-H3 have no timers either). */
MotionGlobalConfig.skipAnimations = true;

afterEach(() => {
  cleanup();
});
