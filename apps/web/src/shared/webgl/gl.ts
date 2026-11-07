import { FRAG, VERT } from "./shader.js";

/**
 * Raw WebGL2 plumbing for the skyline: one program, one texture, one draw.
 * Returns null on any failure, so the caller simply keeps the <img>.
 */

export interface Frame {
  readonly pointerX: number;
  readonly pointerY: number;
  readonly seed: number;
  readonly scan: number;
  readonly scanA: number;
}

export interface Skyline {
  /** Matches the backing store to the CSS box (DPR capped) and the crop. */
  resize(cssW: number, cssH: number, dpr: number, posX: number, posY: number): void;
  draw(f: Frame): void;
  dispose(): void;
}

const NAMES = [
  "uTex",
  "uRes",
  "uImg",
  "uPos",
  "uPointer",
  "uDepth",
  "uGrain",
  "uSeed",
  "uScan",
  "uScanA",
  "uDpr",
] as const;
type Name = (typeof NAMES)[number];

/** Lean at full pointer offset, CSS px. */
const DEPTH = 5;
/** Grain amplitude on 0..1 colour, before the 30 % veil (about 0.04 on screen). */
const GRAIN = 0.06;

function shader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
  gl.deleteShader(s);
  return null;
}

/** Renderer strings of CPU rasterisers: a WebGL decoration there costs seconds. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

/**
 * True when the context is backed by a software rasteriser. Browsers that
 * honour failIfMajorPerformanceCaveat already refuse these; this catches the
 * ones that do not. Without the debug extension the renderer is unknown and
 * the context is kept.
 */
function isSoftware(gl: WebGL2RenderingContext): boolean {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return typeof name === "string" && SOFTWARE.test(name);
}

export function createSkyline(canvas: HTMLCanvasElement, img: HTMLImageElement): Skyline | null {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
    // Software GL (SwiftShader, llvmpipe: blocklisted GPUs, VMs, some
    // low-end Android) returns null here and the static <img> stays.
    failIfMajorPerformanceCaveat: true,
  });
  if (!gl || gl.isContextLost()) return null;
  if (isSoftware(gl)) {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return null;
  }
  const vs = shader(gl, gl.VERTEX_SHADER, VERT);
  const fs = shader(gl, gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  const vao = gl.createVertexArray();
  const tex = gl.createTexture();
  // Every failure path below releases what was made so far.
  const free = (): null => {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    gl.deleteTexture(tex);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(prog);
    return null;
  };
  if (!vs || !fs || !prog || !vao || !tex) return free();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return free();
  // Linked: the program keeps what it needs, the shader objects can go.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  // biome-ignore lint/correctness/useHookAtTopLevel: WebGL's useProgram, not a React hook.
  gl.useProgram(prog);

  gl.bindVertexArray(vao);

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  } catch {
    // vs/fs are already deleted; deleting again is a no-op.
    return free();
  }

  const u = {} as Record<Name, WebGLUniformLocation | null>;
  for (const n of NAMES) u[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(u.uTex, 0);
  gl.uniform2f(u.uImg, img.naturalWidth, img.naturalHeight);

  return {
    resize(cssW, cssH, dpr, posX, posY) {
      const w = Math.max(1, Math.round(cssW * dpr));
      const h = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.uRes, w, h);
      gl.uniform2f(u.uPos, posX, posY);
      gl.uniform1f(u.uDepth, DEPTH * dpr);
      gl.uniform1f(u.uDpr, dpr);
      // When the capped buffer is upscaled to a denser screen, each grain
      // texel covers several device pixels and reads as speckle: thin it.
      gl.uniform1f(u.uGrain, GRAIN * Math.min(1, dpr / (window.devicePixelRatio || 1)));
    },
    draw(f) {
      gl.uniform2f(u.uPointer, f.pointerX, f.pointerY);
      gl.uniform1f(u.uSeed, f.seed);
      gl.uniform1f(u.uScan, f.scan);
      gl.uniform1f(u.uScanA, f.scanA);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteTexture(tex);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      // Release the context itself rather than waiting for GC, so repeated
      // client-side visits never pile up live contexts toward the cap.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
