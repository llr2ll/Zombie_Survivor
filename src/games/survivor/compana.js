import * as THREE from 'three'
import { BALANCE } from './config/balance'
import { GroundAt } from '../../shared/worldgen/sidewalk'

// Santa Compaña (J11): à meia-noite da última noite, uma procissão de almas com velas, guiada pelo Guia (com a cruz),
// contorna a base devagar (são fantasmas: atravessam paredes). Enquanto houver vela acesa, o Guia não leva dano e os zumbis
// ficam mais rápidos. Quem encosta na fila fica lento e "marcado" (os zumbis o veem de longe). Apagar as velas = matar as almas;
// depois, derrubar o Guia acaba com tudo. Some no amanhecer. Números em balance.js · boss.
const C = BALANCE.boss

// desenho (feito uma vez): manto com capuz, vela com chama, poça de luz no chão; o Guia é escuro e leva a cruz
const ROBE = new THREE.ConeGeometry(0.42, 1.7, 10).translate(0, 0.85, 0)
const HOOD = new THREE.SphereGeometry(0.24, 10, 8).translate(0, 1.72, 0)
const FACE = new THREE.SphereGeometry(0.15, 8, 6).translate(0, 1.7, 0.12)
const CANDLE = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 6).translate(0.2, 1.12, 0.3)
const FLAME = new THREE.SphereGeometry(0.07, 8, 6).scale(1, 1.6, 1)
const POOL = new THREE.CircleGeometry(1.5, 20).rotateX(-Math.PI / 2)
const CROSS = [new THREE.BoxGeometry(0.08, 1.5, 0.08).translate(0, 2.3, 0.35), new THREE.BoxGeometry(0.62, 0.08, 0.08).translate(0, 2.65, 0.35)]
const MAT = {
  soul: () => new THREE.MeshLambertMaterial({ color: 0xdcd8cc, emissive: 0x302e2a, transparent: true, opacity: 0.92 }),
  guide: new THREE.MeshLambertMaterial({ color: 0x2a2622, emissive: 0x0c0a08 }),
  face: new THREE.MeshBasicMaterial({ color: 0x050505 }),
  candle: new THREE.MeshLambertMaterial({ color: 0xf4efe0 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false }),
  pool: new THREE.MeshBasicMaterial({ color: 0xff9a30, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  cross: new THREE.MeshBasicMaterial({ color: 0xffe9a8, toneMapped: false }),
  crossDim: new THREE.MeshLambertMaterial({ color: 0x6a5a40 }),
}

// ctx: { scene, fx, players (Map), base (base.js), say(texto, s), sfx(nome, opções), xp(p, n), score(n), impact(x, z, tipo, força) }
export function CreateCompana({ scene, fx, players, base, say, sfx, xp, score, impact }) {
  const list = [] // quem pode levar golpe (almas vivas + Guia): as habilidades miram aqui também
  let on = false, result = null, guide = null, souls = [], theta = 0, cx = 0, cz = 0, R = 12, t = 0, bellT = 0, chantT = 0, warnT = 0
  const lit = () => souls.filter((s) => s.hp > 0).length

  function figure(kind) {
    const g = new THREE.Group()
    const robeMat = kind === 'guide' ? MAT.guide : MAT.soul()
    g.add(new THREE.Mesh(ROBE, robeMat), new THREE.Mesh(HOOD, robeMat), new THREE.Mesh(FACE, MAT.face))
    let flame = null, pool = null, cross = null
    if (kind === 'soul') {
      g.add(new THREE.Mesh(CANDLE, MAT.candle))
      flame = new THREE.Mesh(FLAME, MAT.flame); flame.position.set(0.2, 1.3, 0.3); g.add(flame)
      pool = new THREE.Mesh(POOL, MAT.pool); pool.position.y = 0.06; pool.renderOrder = 2; g.add(pool)
    } else {
      cross = CROSS.map((geo) => new THREE.Mesh(geo, MAT.cross)); g.add(...cross)
      g.scale.setScalar(1.12)
    }
    scene.add(g)
    // campos que as habilidades usam (como num zumbi): x, z, lv, radius, dying, hp, maxHp, slowT, group; ice = já "tem" gelo (não desenha)
    const hp = kind === 'guide' ? C.guideHp : C.soulHp
    return { boss: true, kind, x: 0, z: 0, lv: 0, radius: 0.45, dying: 0, hp, maxHp: hp, slowT: 0, state: 'walk', group: g, robeMat, flame, pool, cross, ice: { visible: false }, fade: 0 }
  }
  function remove(e) { scene.remove(e.group); if (e.robeMat !== MAT.guide) e.robeMat.dispose() }
  function end(how) {
    for (const e of [guide, ...souls]) if (e) remove(e)
    list.length = 0; souls = []; guide = null; on = false
    result = how
  }

  return {
    list,
    // começa à meia-noite: em volta da base (ou do grupo, sem base)
    start() {
      if (on || result) return
      const b = base.at(), alive = [...players.values()].filter((p) => !p.dead)
      if (b && b.b) { const k = b.b; cx = (k.x0 + k.x1) / 2; cz = (k.z0 + k.z1) / 2; R = Math.hypot(k.x1 - k.x0, k.z1 - k.z0) / 2 + C.ring }
      else if (alive.length) { cx = alive.reduce((s, p) => s + p.x, 0) / alive.length; cz = alive.reduce((s, p) => s + p.z, 0) / alive.length; R = 12 }
      const near = alive[0]
      theta = near ? Math.atan2(near.x - cx, near.z - cz) + Math.PI : 0 // nasce do outro lado: dá para ver chegando
      guide = figure('guide'); souls = []
      for (let i = 0; i < C.souls; i++) souls.push(figure('soul'))
      list.push(guide, ...souls)
      on = true
      say('🕯️ Meia-noite: a Santa Compaña chegou! Apaguem as velas (matem as almas) e derrubem o Guia', 5)
      sfx('knell', { x: cx, z: cz })
    },
    // golpe numa alma ou no Guia (vem das regras). true = matou
    damage(e, dmg, p) {
      if (!on || e.dying > 0) return false
      if (e.kind === 'guide' && lit() > 0) { // a cruz protege enquanto houver vela acesa
        fx.burst(e.x, 2.3, e.z, 0xffe9a8, 6, 3, 0.35)
        if (warnT <= 0) { say('✝ A cruz protege o Guia: apaguem as velas primeiro!', 2); warnT = 4 }
        return false
      }
      e.hp -= dmg
      fx.burst(e.x, 1.2, e.z, e.kind === 'guide' ? 0x8a7a60 : 0xe8e4d8, 5, 3, 0.35)
      if (e.hp > 0) return false
      e.dying = 1
      if (p) xp(p, BALANCE.levels.xp.special)
      if (e.kind === 'soul') {
        e.flame.visible = false; e.pool.visible = false
        fx.puff(e.x, 1.4, e.z, 0x8a8a8a, 0.4, 1.2, 1.2)
        const n = lit()
        say(n ? `🕯️ Uma vela se apagou (${n} acesas)` : '🕯️ Todas as velas apagadas: derrubem o Guia!', 2.5)
        if (!n) for (const c of guide.cross) c.material = MAT.crossDim
        return true
      }
      // o Guia caiu: a procissão se desfaz
      fx.flash(e.x, 1.5, e.z, 4, 0xffe9a8, 0.5)
      fx.burst(e.x, 1.5, e.z, 0xffe9a8, 24, 7, 0.8)
      impact(e.x, e.z, 'explosion', 0.6)
      sfx('knell', { x: e.x, z: e.z })
      for (const o of players.values()) xp(o, C.xp)
      score(C.score)
      say(`✝ A Santa Compaña se desfez! +${C.xp} XP para todos`, 4)
      end('derrotada')
      return true
    },
    // zumbis mais rápidos enquanto houver vela acesa
    haste: () => (on && lit() > 0 ? C.haste : 1),
    update(dt) {
      warnT -= dt
      if (!on) return
      t += dt
      theta += (C.speed / R) * dt
      // fila: o Guia na frente, as almas atrás no mesmo círculo
      const all = [guide, ...souls]
      all.forEach((e, i) => {
        const a = theta - (i * C.gap) / R
        e.x = cx + Math.sin(a) * R; e.z = cz + Math.cos(a) * R
        e.group.position.set(e.x, GroundAt(e.x, e.z) + 0.08 + Math.sin(t * 2 + i) * 0.05, e.z) // flutua de leve
        e.group.rotation.y = a + Math.PI / 2 // de frente para onde anda
        if (e.flame && e.hp > 0) { const k = 0.8 + Math.random() * 0.4; e.flame.scale.set(k, k, k) } // a chama treme
      })
      // almas apagadas somem aos poucos
      for (const s of souls) if (s.dying > 0 && s.group.visible) { s.dying -= dt; s.robeMat.opacity = Math.max(0, 0.92 * s.dying); if (s.dying <= 0) { s.group.visible = false; const i = list.indexOf(s); if (i >= 0) list.splice(i, 1) } }
      // encostar na fila: lento e marcado
      for (const p of players.values()) {
        if (p.dead || p.vehicle) continue
        if (!all.some((e) => (e.kind === 'guide' || e.hp > 0) && Math.hypot(p.x - e.x, p.z - e.z) < C.touch)) continue
        if (!(p.marked > 0)) { say(`🕯️ ${p.name} tocou a procissão: está marcado!`, 2); fx.ring(p.x, p.gy || 0, p.z, 0x9a7aff, 0.3, 2, 0.8) }
        p.chill = C.chill; p.marked = C.mark
      }
      // sino de tempos em tempos e o cântico
      if ((bellT -= dt) <= 0) { bellT = 5; sfx('knell', { x: guide.x, z: guide.z }) }
      if ((chantT -= dt) <= 0) { chantT = 3.2; sfx('chant', { x: guide.x, z: guide.z }) }
    },
    // amanheceu: some (se ninguém derrubou o Guia, ela escapou)
    dawn() { if (on) end('escapou') },
    text: () => (on ? (lit() ? `🕯️ velas ${lit()}/${C.souls}` : '✝ Guia vulnerável') : ''), // placar (curto: divide a linha com pontos e estoque)
    result: () => result, // null (não veio) · 'derrotada' · 'escapou'
    clear() { if (on) end(null); result = null; t = 0; bellT = 0; chantT = 0 },
  }
}
