import * as THREE from 'three'
import { hash } from '../../engine/world/noise'
import { wind } from '../../engine/render/style'
import { LampTarget } from './streetlights'

// =====================================================================================
//  Casas acesas à noite: só algumas (mundo abandonado), sempre as mesmas (sorteio fixo pela posição da casa).
//  Barato, como os postes:
//  - vidro aceso e a luz que sai pela janela no chão (com a sombra da cruz da janela): instanciados por chunk,
//    shader aditivo de poucas linhas (2 draw calls por chunk com casa acesa)
//  - luz de verdade (PointLight) só num punhado fixo (POOL) que vai para as casas acesas mais perto dos jogadores:
//    com o telhado aberto, o cômodo aparece iluminado; a quantidade de luzes nunca muda (sem recompilar shaders)
//  Algumas piscam (gerador falhando): a casa toda pisca junto.
// =====================================================================================

const SHARE = 0.2 // ~1 em 5 casas/prédios acesos
const FLICKER = 0.25 // das acesas, quantas piscam
const POOL = 3, POOL_I = 9, POOL_RANGE = 9, POOL_DECAY = 1.6, POOL_NEAR = 28
const WARM = new THREE.Color(1.0, 0.7, 0.36)
const night = { value: 0 } // 0 = apagado, 1 = aceso (todos os shaders abaixo)
const hide = { value: Array.from({ length: 4 }, () => new THREE.Vector4()) } // casas com alguém dentro (x0, z0, x1, z1): o telhado abre e o vidro aceso some

const fx = (fragmentShader, defines = {}) => new THREE.ShaderMaterial({
  uniforms: { uNight: night, uColor: { value: WARM }, uTime: wind, uHide: hide }, defines,
  vertexShader: `
    uniform float uTime; uniform vec4 uHide[4]; varying vec2 vUv; varying vec2 vL; varying float vI;
    float hz(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vUv = uv; vL = position.xz;
      // cor da instância: r = força, g = fase do pisca (0 = não pisca; a casa inteira usa a mesma fase)
      float inten = 1.0, fl = 0.0;
      #ifdef USE_INSTANCING_COLOR
        inten = instanceColor.r; fl = instanceColor.g;
      #endif
      float f = 1.0;
      if (fl > 0.0) { float n = hz(vec2(floor(uTime * 7.0), fl * 97.0)); f = n > 0.86 ? 0.15 : (n > 0.74 ? 0.55 : 1.0); }
      vI = inten * f;
      #ifdef HIDE
        vec2 hc = instanceMatrix[3].xz;
        for (int i = 0; i < 4; i++) { vec4 r = uHide[i]; if (hc.x > r.x && hc.x < r.z && hc.y > r.y && hc.y < r.w) vI = 0.0; }
      #endif
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    }`,
  fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
})
// vidro aceso: mais claro no miolo; os caixilhos da janela ficam na frente (a cruz aparece escura)
const PaneMat = fx(`
  uniform float uNight; uniform vec3 uColor; varying vec2 vUv; varying float vI;
  void main() { vec2 d = abs(vUv - 0.5) * 2.0; float k = 0.6 + 0.4 * (1.0 - smoothstep(0.55, 1.0, max(d.x, d.y))); gl_FragColor = vec4(uColor * k, uNight * vI); }`, { HIDE: 1 })
// luz no chão do lado de fora: trapézio que abre com a distância, com a sombra da cruz da janela, sumindo longe da parede
const SpillMat = fx(`
  uniform float uNight; uniform vec3 uColor; varying vec2 vL; varying float vI;
  void main() {
    float v = vL.y, hw = 0.5 * (0.55 + 0.45 * v), u = vL.x / hw;
    float side = 1.0 - smoothstep(0.72, 1.0, abs(u));
    float bars = smoothstep(0.03, 0.08, abs(u)) * smoothstep(0.03, 0.08, abs(v - 0.42));
    float fade = smoothstep(0.0, 0.1, v) * pow(1.0 - v, 1.3);
    gl_FragColor = vec4(uColor, uNight * vI * 0.8 * side * bars * fade);
  }`)
SpillMat.polygonOffset = true; SpillMat.polygonOffsetFactor = -8; SpillMat.polygonOffsetUnits = -8
const PANE_GEO = new THREE.PlaneGeometry(1, 1) // virado para +z
const SPILL_GEO = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5) // deitado; z = 0 na parede, 1 longe

// casas acesas de um chunk: recebe a lista de casas do gerador ({ x, z, y, cs, sn, pr }) e devolve as acesas no mundo:
// { x, z, y, r (raio para a visão), ly (altura da luz), fl (fase do pisca), panes: [{ x, y, z, nx, nz, w, h, k }] }
export function LitHouses(list) {
  const out = []
  for (const b of list) {
    const kx = Math.round(b.x * 10), kz = Math.round(b.z * 10)
    if (hash(kx, kz, 7331) >= SHARE || !b.pr.panes) continue
    const floors = b.pr.floors || 1, on = []
    for (let k = 0; k < floors; k++) on.push(hash(kx, kz, 7400 + k) < (k === 0 ? 0.75 : 0.55))
    if (!on.some(Boolean)) on[0] = true
    const toW = (lx, lz) => [b.x + lx * b.cs + lz * b.sn, b.z - lx * b.sn + lz * b.cs]
    const panes = []
    for (const o of b.pr.panes) {
      if (!on[o.k]) continue
      const [wx, wz] = toW(o.x, o.z)
      if (hash(Math.round(wx * 10), Math.round(wz * 10), 7500 + o.k) > 0.85) continue // cortina fechada
      panes.push({ x: wx, z: wz, y: b.y + o.y, nx: o.nx * b.cs + o.nz * b.sn, nz: -o.nx * b.sn + o.nz * b.cs, w: o.w, h: o.h, k: o.k })
    }
    if (!panes.length) continue
    const low = panes.reduce((m, p) => Math.min(m, p.k), 9)
    out.push({
      x: b.x, z: b.z, y: b.y, r: Math.max(b.pr.w, b.pr.d) / 2 + 2.5, ly: panes.find((p) => p.k === low).y + 0.7,
      fl: hash(kx, kz, 7600) < FLICKER ? 0.05 + hash(kx, kz, 7601) * 0.95 : 0, panes,
    })
  }
  return out
}

// vidros e luz no chão das casas acesas do chunk (2 draw calls)
const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color()
export function BuildHouseLightFx(g, houses, dispose) {
  const items = houses.flatMap((h) => h.panes.map((p) => [h, p]))
  if (!items.length) return
  const mk = (geo, mat, order, place) => {
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    items.forEach(([h, p], i) => {
      const inten = place(h, p)
      _q.setFromEuler(_e.set(0, Math.atan2(p.nx, p.nz), 0))
      im.setMatrixAt(i, _m4.compose(_p, _q, _s))
      im.setColorAt(i, _c.setRGB(inten * (0.8 + 0.4 * hash(Math.round(p.x * 10), Math.round(p.z * 10), 7700)), h.fl, 0))
    })
    im.renderOrder = order
    g.add(im)
    dispose.push(im)
  }
  // vidro: na frente do vidro de verdade (frente em 0,17) e atrás da frente dos caixilhos (0,22)
  mk(PANE_GEO, PaneMat, 3, (h, p) => { _p.set(p.x + p.nx * 0.185, p.y, p.z + p.nz * 0.185); _s.set(p.w, p.h, 1); return 1 })
  // chão: térreo começa na parede; andares de cima caem mais longe e mais fracos
  mk(SPILL_GEO, SpillMat, 2, (h, p) => {
    const off = p.k === 0 ? 0.12 : 0.5 + 0.9 * p.k, len = p.k === 0 ? 2.4 + 0.5 * p.w : 3.2
    _p.set(p.x + p.nx * off, h.y + 0.05, p.z + p.nz * off); _s.set(p.w * 1.3, 1, len)
    return p.k === 0 ? 1 : 0.5
  })
}

export function CreateHouseLights(scene) {
  const pool = []
  for (let i = 0; i < POOL; i++) {
    const l = new THREE.PointLight(WARM, 0, POOL_RANGE, POOL_DECAY)
    l.position.set(0, -50, 0)
    scene.add(l)
    pool.push(l)
  }
  const loaded = new Set() // casas acesas dos chunks carregados (o jogo põe e tira junto com os chunks)
  const glows = [] // casas com luz de verdade agora: { x, z, r } (a visão noturna deixa ver em volta delas)
  let scanT = 0
  const hz = (a, b) => { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v) }
  return {
    glows,
    add(list) { if (list && list.length) loaded.add(list) },
    remove(list) { loaded.delete(list) },
    reset() { loaded.clear() },
    // time = hora do clima (0..1), over = céu fechado, focus = jogadores (ou o centro do menu), inside = casas com alguém dentro
    update(dt, time, over, focus, inside = []) {
      hide.value.forEach((v, i) => { const b = inside[i]; if (b) v.set(b.x0 - 0.6, b.z0 - 0.6, b.x1 + 0.6, b.z1 + 0.6); else v.set(0, 0, 0, 0) })
      night.value += (LampTarget(time, over) - night.value) * (1 - Math.exp(-dt * 1.2))
      if (night.value < 0.002) night.value = 0
      const on = night.value > 0
      PaneMat.visible = SpillMat.visible = on
      if ((scanT -= dt) <= 0) {
        scanT = 0.3
        const cand = []
        if (on) for (const list of loaded) for (const h of list) {
          let d = Infinity
          for (const f of focus) d = Math.min(d, (f.x - h.x) ** 2 + (f.z - h.z) ** 2)
          if (d < POOL_NEAR * POOL_NEAR) cand.push([d, h])
        }
        cand.sort((a, b) => a[0] - b[0])
        glows.length = 0
        pool.forEach((l, i) => {
          const h = cand[i] && cand[i][1]
          l.userData.h = h || null
          if (!h) return
          l.position.set(h.x, h.ly, h.z)
          glows.push({ x: h.x, z: h.z, r: h.r, top: h.ly + 0.8 }) // até o teto do cômodo aceso (o telhado fica escuro)
        })
      }
      // pisca junto com as janelas (mesma conta do shader, aproximada)
      for (const l of pool) {
        const h = l.userData.h
        let f = 1
        if (h && h.fl > 0) { const n = hz(Math.floor(wind.value * 7), h.fl * 97); f = n > 0.86 ? 0.15 : n > 0.74 ? 0.55 : 1 }
        l.intensity = h ? POOL_I * night.value * f : 0
      }
    },
  }
}
