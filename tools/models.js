// Parametric 3D models of JST-style crimp housings and headers (all units in mm).
// Dimensions are approximated from the manufacturers' drawings; good enough for pictures, not for CAD.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';

const ev = new Evaluator();
ev.attributes = ['position', 'normal'];

export const SPEC = {
  // plug: w0 = width - (n-1)*pitch, L = length along the wire, T = thickness
  // hdrH / hdrV: side-entry and top-entry header bodies
  SH: { pitch: 1.0, color: 0xF3EFE4,
        plug: { w0: 2.05, L: 5.0, T: 2.8 },
        hdrH: { w0: 3.0, D: 4.25, H: 2.9, cw0: 1.9, ch: 1.6, smd: true },
        hdrV: { w0: 3.0, D: 2.9, H: 4.25, cw0: 1.9, cd: 1.7, smd: true } },
  GH: { pitch: 1.25, color: 0xEFE4C6,
        plug: { w0: 3.25, L: 5.0, T: 2.4 },
        hdrH: { w0: 4.0, D: 5.2, H: 4.25, cw0: 2.4, ch: 2.6, smd: true },
        hdrV: { w0: 4.0, D: 4.25, H: 5.5, cw0: 2.4, cd: 2.6, smd: true } },
  PB: { pitch: 1.25, color: 0xF4F1E8,
        plug: { w0: 3.2, L: 4.6, T: 3.0 },
        hdrH: { w0: 3.9, D: 5.6, H: 3.4, cw0: 2.4, ch: 2.3, smd: false },
        hdrV: { w0: 3.9, D: 3.4, H: 4.2, cw0: 2.4, cd: 2.3, smd: false } },
  XH: { pitch: 2.5, color: 0xF5F2EA,
        plug: { w0: 3.2, L: 8.1, T: 4.0 },
        hdrH: { w0: 4.9, D: 9.0, H: 6.0, cw0: 3.7, ch: 4.2, smd: false },
        hdrV: { w0: 4.9, D: 5.75, H: 7.0, cw0: 3.7, cd: 4.2, smd: false } },
};

export function materials(color) {
  return {
    nylon: new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, metalness: 0, sheen: 0.4, sheenRoughness: 0.8, sheenColor: 0xffffff, clearcoat: 0.05 }),
    nylonShade: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.86), roughness: 0.7 }),
    nylonDeep: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.8 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xE4E7EA, metalness: 0.55, roughness: 0.3 }),
    nylonDark: new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.3), roughness: 0.9 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xE2B54A, metalness: 1, roughness: 0.28 }),
    tin: new THREE.MeshStandardMaterial({ color: 0xCFD3D6, metalness: 1, roughness: 0.35 }),
    mask: new THREE.MeshStandardMaterial({ color: 0x1E6B45, roughness: 0.38, metalness: 0.05 }),
    fr4: new THREE.MeshStandardMaterial({ color: 0xC9B27A, roughness: 0.8 }),
    copper: new THREE.MeshStandardMaterial({ color: 0xD9C27A, metalness: 1, roughness: 0.3 }),
  };
}

// box brush: size (sx,sy,sz), center (x,y,z); r = edge radius
function box(sx, sy, sz, x, y, z, r = 0) {
  const g = r > 0 ? new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sx / 2.01, sy / 2.01, sz / 2.01))
                  : new THREE.BoxGeometry(sx, sy, sz);
  const b = new Brush(g.index ? g.toNonIndexed() : g);
  b.position.set(x, y, z); b.updateMatrixWorld();
  return b;
}
// ramp rising toward +x (away from the mating face): length lx, width wy, height hz, starting at (x0, y) on surface z0
function wedge(lx, wy, hz, x0, y, z0) {
  const ang = Math.atan2(hz, lx), len = Math.hypot(lx, hz);
  const b = new Brush(new THREE.BoxGeometry(len, wy, hz * 1.6));
  b.rotation.y = -ang;
  b.position.set(x0 + lx / 2, y, z0);
  b.updateMatrixWorld();
  return b;
}
const sub = (a, b) => ev.evaluate(a, b, SUBTRACTION);
const add = (a, b) => ev.evaluate(a, b, ADDITION);
const mesh = (brush, mat) => { const m = new THREE.Mesh(brush.geometry, mat); m.position.copy(brush.position); m.castShadow = m.receiveShadow = true; return m; };
const rows = (n, p) => Array.from({ length: n }, (_, i) => -(n - 1) / 2 * p + i * p);

/* ---------- crimp housing (plug) ----------
   x: 0 = mating face, L = wire side; y: along the pin row; z: +z = latch side. */
export function plug(type, n) {
  const S = SPEC[type], P = S.plug, p = S.pitch, M = materials(S.color);
  const W = (n - 1) * p + P.w0, L = P.L, T = P.T, ys = rows(n, p);
  let body = box(L, W, T, L / 2, 0, 0, Math.min(0.22, T * 0.08));
  // contact cavities on the mating face and wire holes at the back
  for (const y of ys) {
    body = sub(body, box(0.9, p * 0.46, p * 0.46, 0.3, y, 0));
    body = sub(body, box(0.9, p * 0.62, Math.min(T * 0.5, p * 0.62), L - 0.3, y, 0));
  }
  const g = new THREE.Group();
  const extra = [], shadowsIn = [];
  const win = (sx, sy, x, y, z, depth) => { shadowsIn.push([sx, sy, x, y, z > 0 ? z - depth / 2 : z + depth / 2]); return box(sx, sy, depth, x, y, z); };
  const top = T / 2, bot = -T / 2;

  if (type === 'SH') {
    // SHR-xxV-S-B after the drawing: length 5.0; rear flange 1.0 long, (n-1)+4 wide; body (n-1)+2 wide;
    // 2.8 thick over the rear 2 mm, 2.1 thick toward the mating face; contact side: channels + small windows
    const tF = 1.05;                                                   // half thickness of the front part (2.1)
    body = box(2.0, W, T, L - 1.0, 0, 0, 0.12);                        // rear part, 2.8 thick
    body = add(body, box(1.0, W + 2.0, T, L - 0.5, 0, 0, 0.18));       // flange
    body = add(body, box(3.05, W, 2 * tF, 1.5, 0, 0, 0.1));            // front part, 2.1 thick
    for (const y of ys) {
      body = sub(body, box(0.9, p * 0.45, p * 0.45, 0.3, y, -0.15));                                  // mating cavity
      body = sub(body, box(0.9, p * 0.6, p * 0.6, L - 0.3, y, 0));                                    // wire entry
      body = sub(body, win(2.0, p * 0.72, 2.65, y, tF + 0.35, 1.6));                                  // contact channel
      body = sub(body, win(0.8, p * 0.42, 1.27, y, tF, 0.9));                                         // small window
      const c = new THREE.Mesh(new THREE.BoxGeometry(1.9, p * 0.36, 0.3), M.tin);                     // visible contact
      c.position.set(2.6, y, tF - 0.55); extra.push(c);
      const lance = new THREE.Mesh(new THREE.BoxGeometry(0.5, p * 0.3, 0.25), M.tin);
      lance.position.set(1.3, y, tF - 0.55); extra.push(lance);
    }
    for (const sgn of [-1, 1]) body = sub(body, box(2.2, 0.35, 0.6, 1.9, sgn * (W / 2), 0));            // lock slot on the ends
    body = sub(body, box(0.6, W + 0.1, 0.2, 0.3, 0, -tF));                                            // step at the mating edge (back)
  }
  if (type === 'GH') {
    // after photos of GHR housings. Latch face: lever plate from the mating end over ~2/3 of the length
    // (max 6.5 mm wide), end posts alongside, windows with contacts for the pins outside the plate.
    // Back face: open channels from the mating end, solid band at the wire end.
    const pw = Math.min(W - 2.6, 6.5), post = 0.85, pl = L * 0.64;
    for (const y of ys) {
      body = sub(body, box(0.9, p * 0.5, T * 0.4, 0.3, y, 0.1));                                            // mating cavity
      body = sub(body, box(0.9, p * 0.6, p * 0.6, L - 0.3, y, 0));                                          // wire entry
      const cd = 0.7, cx1 = L - 0.8, cw = p * 0.52;                                                          // open channel (back)
      body = sub(body, box(cx1 + 0.3, cw, cd * 2, (cx1 - 0.3) / 2, y, bot));
      const fl = new THREE.Mesh(new THREE.BoxGeometry(cx1, cw * 0.98, 0.01), M.nylonDeep);                  // dark floor
      fl.position.set(cx1 / 2, y, bot + cd - 0.004); extra.push(fl);
      const ct = new THREE.Mesh(new THREE.BoxGeometry(cx1 * 0.62, cw * 0.3, 0.18), M.silver);               // thin contact in the front half
      ct.position.set(0.25 + cx1 * 0.31, y, bot + cd - 0.14); extra.push(ct);
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.35, cw * 0.5, 0.25), M.silver);                    // contact shoulder
      tab.position.set(cx1 * 0.5, y, bot + cd - 0.18); extra.push(tab);
      body = add(body, box(cx1 * 0.42, cw * 0.86, cd, cx1 * 0.79, y, bot + cd / 2 + 0.08, 0.06));          // white block in the rear half
      if (Math.abs(y) > pw / 2) {                                                                            // pins outside the lever
        body = sub(body, win(1.6, p * 0.55, 1.1, y, top, 0.9));
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.4, p * 0.3, 0.2), M.tin); w.position.set(1.1, y, top - 0.3); extra.push(w);
      }
    }
    body = sub(body, box(pl, pw + 0.4, 0.3, 0.25 + pl / 2, 0, top));                                        // recess under the lever
    let lever = box(pl, pw, 0.4, 0.25 + pl / 2, 0, top + 0.28, 0.08);                                      // lever plate
    lever = add(lever, box(0.55, pw, 0.55, 0.25 + pl - 0.28, 0, top + 0.05, 0.06));                         // support at its wire-side end
    lever = add(lever, box(pl * 0.85, 0.2, 0.08, 0.3 + pl * 0.45, 0, top + 0.5));                            // centre rib
    for (const sgn of [-1, 1]) {
      lever = add(lever, wedge(0.8, 0.45, 0.3, 0.6, sgn * (pw / 2 + 0.2), top + 0.25));                      // hooks near the mating end
      const yo = sgn * (W / 2 - post / 2 - 0.05);
      body = add(body, box(pl + 0.2, post, 0.9, 0.15 + (pl + 0.2) / 2, yo, top + 0.38, 0.1));               // end post
      body = sub(body, box(0.9, post + 0.2, 0.6, 0.7, yo, top + 0.8));                                      // notch near the mating end
    }
    extra.push(mesh(lever, M.nylon));
  }
  if (type === 'PB') {
    // after photos of 1.25 mm (PicoBlade-style) cables: open channels with visible contacts along one face,
    // arrow-shaped lance windows toward the mating end, a slightly wider collar at the wire end, smooth back
    const cl = 0.9;
    body = box(L - cl, W, T, (L - cl) / 2, 0, 0, 0.12);
    body = add(body, box(cl, W + 0.5, T + 0.2, L - cl / 2, 0, 0, 0.15));                                  // collar
    for (const y of ys) {
      body = sub(body, box(0.9, p * 0.46, p * 0.46, 0.3, y, -0.3));                                        // mating cavity
      body = sub(body, box(0.9, p * 0.6, p * 0.6, L - 0.3, y, 0));                                          // wire entry
      body = sub(body, win(L - cl - 1.0, p * 0.7, 1.0 + (L - cl - 1.0) / 2, y, top, T * 0.9));             // contact channel
      const tip = new Brush(new THREE.BoxGeometry(p * 0.5, p * 0.5, T * 0.9));                              // arrow tip
      tip.rotation.z = Math.PI / 4; tip.position.set(1.0, y, top); tip.updateMatrixWorld();
      body = sub(body, tip);
      const c = new THREE.Mesh(new THREE.BoxGeometry(L - cl - 1.3, p * 0.36, 0.3), M.tin);                // visible contact
      c.position.set(1.25 + (L - cl - 1.3) / 2, y, top - T * 0.38); extra.push(c);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(p * 0.18, p * 0.18, 0.3, 12), M.tin);         // rounded contact nose
      cap.rotation.x = Math.PI / 2; cap.position.set(1.25, y, top - T * 0.38); extra.push(cap);
    }
    body = add(body, box(1.1, Math.min(2.2, W * 0.5), 0.28, 0.75, 0, bot - 0.1, 0.1));                     // friction lock bump on the back
    body = sub(body, box(0.5, W + 0.1, 0.18, 0.2, 0, top));                                                  // front lip step
  }
  if (type === 'XH') {
    // XHP-n after the drawing: body B = (n-1)*2.5 + 3.2 wide, 7.3 long, 4.0 thick; rear flange C = B + 1.6 wide,
    // 0.8 long, 5.6 tall; latch face: two side rails 0.8 high with hooks near the mating end;
    // mating face: rectangular cavities, V keys along the lower edge; back: open slots showing the contact tips
    const fl = 0.8, xb = L - fl, rh = 0.8;
    body = box(xb, W, T, xb / 2, 0, 0, 0.14);
    body = add(body, box(fl, W + 1.6, 5.6, L - fl / 2, 0, (top + rh) - 2.8, 0.15));                       // flange
    // U-shaped latch frame, open toward the mating end: side ramps rise toward the flange, joined by a rear bar
    const r0 = 2.2;
    for (const sgn of [-1, 1]) body = add(body, wedge(xb - r0, 0.75, rh, r0, sgn * (W / 2 - 0.45), top - 0.05));
    body = add(body, box(0.8, W - 0.2, rh + 0.1, xb - 0.4, 0, top + rh / 2 - 0.05, 0.1));
    { const f = new THREE.Mesh(new THREE.BoxGeometry(xb - 0.8 - 0.6, W - 1.9, 0.01), M.nylonShade); f.position.set(0.6 + (xb - 1.4) / 2, 0, top + 0.006); extra.push(f); }
    for (const y of ys) {
      body = sub(body, box(1.2, p * 0.64, 2.0, 0.55, y, 0.3));                                               // mating cavity
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.05, p * 0.62, 1.95), M.nylonDark); d.position.set(1.12, y, 0.3); extra.push(d);
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.64, 0.64), M.tin); c.position.set(0.9, y, 0.3); extra.push(c);
      body = sub(body, box(1.2, 1.3, 1.3, L - 0.5, y, 0));                                                   // wire entry
      const v = new Brush(new THREE.BoxGeometry(1.2, 1.0, 1.0));
      v.rotation.x = Math.PI / 4; v.position.set(0.5, y, bot); v.updateMatrixWorld();
      body = sub(body, v);                                                                                    // V key notch
      body = sub(body, win(2.6, p * 0.5, 1.3, y, bot, 1.8));                                                  // open slot on the back
      const tip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.3), M.tin); tip.position.set(1.5, y, bot + 0.55); extra.push(tip);
    }
  }
  g.add(mesh(body, M.nylon));
  extra.forEach(m => g.add(m));
  for (const w of shadowsIn) {   // dark cavity floors so the windows read as holes
    const d = new THREE.Mesh(new THREE.BoxGeometry(w[0] * 0.98, w[1] * 0.98, 0.05), M.nylonDark);
    d.position.set(w[2], w[3], w[4]); g.add(d);
  }
  // crimp contacts visible through the front cavities
  for (const y of ys) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, p * 0.3, p * 0.3), M.tin);
    c.position.set(L * 0.35, y, 0); g.add(c);
  }
  return { group: g, W, L, T, ys };
}

/* ---------- header on a PCB ----------
   Horizontal (side entry): opening faces -y (viewer), board edge at y = 0, board surface z = 0.
   Vertical (top entry): opening faces +z, latch wall on the -y side (viewer). */
export function header(type, n, mount, smd) {
  const S = SPEC[type], p = S.pitch, M = materials(S.color), ys = rows(n, p); // ys used along x here
  const g = new THREE.Group();
  const H = { ...(mount === 'H' ? S.hdrH : S.hdrV) };
  if (smd !== undefined) H.smd = smd;
  const W = (n - 1) * p + H.w0, cw = (n - 1) * p + H.cw0;
  const pcbW = W + (H.smd ? 5 : 4);
  const xs = ys; // pin positions along x

  if (mount === 'H') {
    const D = H.D, Hh = H.H, cz = Hh * 0.52;
    const pcb = box(pcbW, 14, 1.6, 0, 7 - 0.3, -0.8, 0.05);
    g.add(Object.assign(mesh(pcb, M.mask), { userData: { pcb: true } }));
    const edge = new THREE.Mesh(new THREE.BoxGeometry(pcbW, 0.02, 1.3), M.fr4); edge.position.set(0, -0.31, -0.8); edge.userData.pcb = true; g.add(edge);
    let body = box(W, D, Hh, 0, D / 2 - 0.3, Hh / 2, 0.12);
    body = sub(body, box(cw, D * 0.78 + 0.5, H.ch, 0, (D * 0.78) / 2 - 0.55, cz));
    // latch window / ramp on top
    if (type === 'XH') body = sub(body, box(2.6, 2.2, 0.9, 0, 1.0, Hh));
    else body = sub(body, box(Math.min(2.6, cw * 0.6), 1.2, 0.8, 0, 0.7, Hh));
    // key slots on the cavity floor
    g.add(mesh(body, M.nylon));
    for (const x of xs) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(p * 0.28, D * 0.7, p * 0.28), M.gold);
      pin.position.set(x, D * 0.42, cz); pin.castShadow = true; g.add(pin);
    }
    if (H.smd) for (const s of [-1, 1]) {
      const tab = new THREE.Mesh(new THREE.BoxGeometry(0.2, D * 0.55, Hh * 0.7), M.tin);
      tab.position.set(s * (W / 2 + 0.1), D * 0.5, Hh * 0.35); g.add(tab);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, D * 0.55, 0.12), M.tin);
      foot.position.set(s * (W / 2 + 0.55), D * 0.5, 0.06); g.add(foot);
      const pad = new THREE.Mesh(new THREE.BoxGeometry(1.5, D * 0.7, 0.04), M.copper);
      pad.position.set(s * (W / 2 + 0.55), D * 0.5, 0.02); g.add(pad);
    }
    return { group: g, xs, W, D, Hh, cz, pcbW };
  } else {
    const D = H.D, Hh = H.H;
    const pcb = box(pcbW + 4, D + 10, 1.6, 0, 0.5, -0.8, 0.05);
    g.add(Object.assign(mesh(pcb, M.mask), { userData: { pcb: true } }));
    let body = box(W, D, Hh, 0, 0, Hh / 2, 0.12);
    body = sub(body, box(cw, H.cd, Hh * 0.8 + 0.5, 0, 0.15, Hh - (Hh * 0.8) / 2 + 0.25));
    // latch feature on the -y wall (toward the viewer)
    if (type === 'XH') body = add(body, box(2.4, 0.7, 1.4, 0, -D / 2 - 0.3, Hh * 0.62, 0.15));   // lock ramp
    else body = sub(body, box(Math.min(2.4, cw * 0.6), 1.2, Hh * 0.45, 0, -D / 2 + 0.3, Hh));
    g.add(mesh(body, M.nylon));
    for (const x of xs) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(p * 0.28, p * 0.28, Hh * 0.72), M.gold);
      pin.position.set(x, 0.15, Hh * 0.2 + Hh * 0.36); pin.castShadow = true; g.add(pin);
    }
    if (H.smd) {
      for (const s of [-1, 1]) {
        const tab = new THREE.Mesh(new THREE.BoxGeometry(0.2, D * 0.6, Hh * 0.5), M.tin);
        tab.position.set(s * (W / 2 + 0.1), 0, Hh * 0.25); g.add(tab);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, D * 0.8, 0.04), M.copper);
        pad.position.set(s * (W / 2 + 0.5), 0, 0.02); g.add(pad);
      }
      for (const x of xs) {  // signal leads toward the back
        const lead = new THREE.Mesh(new THREE.BoxGeometry(p * 0.3, 1.4, 0.12), M.tin);
        lead.position.set(x, D / 2 + 0.6, 0.06); g.add(lead);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(p * 0.55, 1.8, 0.04), M.copper);
        pad.position.set(x, D / 2 + 0.7, 0.02); g.add(pad);
      }
    }
    return { group: g, xs, W, D, Hh, pcbW };
  }
}

/* SMD hold-down tabs and signal leads added around a THT-style body (for SMD variants without their own model).
   bb: body bounds in world space; leads go to +y (away from the viewer). */
export function smdParts(bb, pinsX, mount, pitch, color) {
  const M = materials(color), g = new THREE.Group();
  const add = (sx, sy, sz, x, y, z, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); };
  const cy = (bb.min.y + bb.max.y) / 2, h = bb.max.z;
  for (const s of [-1, 1]) {
    const x = s > 0 ? bb.max.x + 0.15 : bb.min.x - 0.15;
    add(0.3, 2.6, Math.min(3, h * 0.55), x, cy, Math.min(3, h * 0.55) / 2, M.tin);          // hold-down plate
    add(1.4, 2.6, 0.15, x + s * 0.7, cy, 0.075, M.tin);                                      // foot
    add(1.9, 3.2, 0.04, x + s * 0.7, cy, 0.02, M.copper);                                    // pad
  }
  for (const x of pinsX) {
    add(pitch * 0.26, 2.2, 0.16, x, bb.max.y + 1.0, 0.08, M.tin);
    add(pitch * 0.5, 2.6, 0.04, x, bb.max.y + 1.1, 0.02, M.copper);
  }
  return g;
}
