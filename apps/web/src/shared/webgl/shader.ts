/**
 * GLSL for the hero skyline (WebGL2). One full-screen triangle, one texture.
 *
 * The fragment shader repeats the <img> underneath exactly (object-fit:
 * cover at the same object-position), then adds three quiet things:
 *   1. Paper grain: per-pixel noise with a fixed seed (it does not crawl),
 *      weighted toward the dark and mid tones of the sky, where the paper
 *      grain of the light grounds would show; the lit windows stay clean.
 *   2. Depth: the skyline leans a few pixels toward the pointer; the lower
 *      (nearer) part of the picture moves more than the sky.
 *   3. The wake of the one scan pass: lit windows the line has just crossed
 *      warm slightly. The line itself is a DOM rule above the hero's veil
 *      (ScanLine), so it reads as true International Orange.
 * No bloom, no blur, no gradient fill.
 */

export const VERT = `#version 300 es
const vec2 P[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(P[gl_VertexID], 0.0, 1.0);
}
`;

export const FRAG = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform vec2 uRes;      // canvas size, device px
uniform vec2 uImg;      // image intrinsic size
uniform vec2 uPos;      // object-position, 0..1
uniform vec2 uPointer;  // eased pointer, -1..1
uniform float uDepth;   // max lean, device px
uniform float uGrain;   // grain strength
uniform float uSeed;    // grain seed
uniform float uScan;    // scan line x, 0..1 of the canvas; < 0 when idle
uniform float uScanA;   // scan line opacity
uniform float uDpr;

out vec4 outColor;

const vec3 ORANGE = vec3(1.0, 0.31, 0.0);

// Integer hash: no lattice pattern, unlike the sin/fract family.
float hash(uvec2 p, uint seed) {
  uint h = p.x * 1664525u + p.y * 1013904223u + seed * 2654435769u;
  h ^= h >> 16u;
  h *= 2246822519u;
  h ^= h >> 13u;
  h *= 3266489917u;
  h ^= h >> 16u;
  return float(h) * (1.0 / 4294967295.0);
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float s = max(uRes.x / uImg.x, uRes.y / uImg.y);
  vec2 drawn = uImg * s;
  vec2 off = (uRes - drawn) * uPos;

  // Nearer (lower) rows lean further than the sky.
  float near = smoothstep(0.15, 1.0, px.y / uRes.y);
  vec2 lean = uPointer * uDepth * (0.25 + 0.75 * near);
  vec2 uv = (px - off - lean) / drawn;
  vec3 c = texture(uTex, uv).rgb;

  if (uScan >= 0.0 && uScanA > 0.0) {
    float dpx = (px.x / uRes.x - uScan) * uRes.x; // device px from the line; < 0 = crossed
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float lit = smoothstep(0.28, 0.6, lum);       // window lights, not the sky
    float trail = dpx < 0.0 ? exp(dpx / (160.0 * uDpr)) : 0.0;
    c = mix(c, c * 0.55 + ORANGE * 0.55, lit * trail * 0.5 * uScanA);
  }

  float lum0 = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.0, 0.1, lum0) * (1.0 - smoothstep(0.35, 0.8, lum0));
  float n = hash(uvec2(px / max(uDpr, 1.0)), uint(uSeed)) - 0.5;
  c += n * uGrain * w;
  outColor = vec4(c, 1.0);
}
`;
