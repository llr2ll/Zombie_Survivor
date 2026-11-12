import { BALANCE } from './config/balance'
import { hash } from '../../engine/world/noise'
import { StationOf, CHUNK_SIZE } from '../../shared/worldgen/layout'

// Gasolina (J8): o carro gasta andando (1 lata ≈ ir à vila vizinha e voltar); sem gasolina o motor não acelera (v.stall).
// Abastecer: Usar perto do carro com ⛽ no estoque, se o tanque não está cheio. Bomba do posto: latas uma vez por posto,
// mas dispara um alarme que chama a horda. Carros abandonados às vezes já têm gasolina no tanque. Números em balance.js · fuel.
const F = BALANCE.fuel
const PUMPS = [[-2.4, 1.6], [-0.2, 1.6]] // as duas bombas, em relação ao centro do posto (props.js: cobertura em x -1,3 ± 1,1)
const fmt = (n) => n.toFixed(1).replace('.', ',')

// ctx: { vehicles, inv (estoque do grupo), tasks, say(texto, s), sfx(nome, opções), noise(x, z, raio) }
export function CreateFuel({ vehicles, inv, tasks, say, sfx, noise }) {
  const used = new Set() // postos cuja bomba já foi usada (z do posto)
  const alarms = [] // { x, z, t, beat }: alarme tocando
  // gasolina que o carro tem quando aparece: fixa por lugar (o mesmo carro tem sempre a mesma)
  function initial(v) {
    if (Math.hypot(v.x, v.z) < F.startArea) return F.start
    const [a, b] = v.key.split(',').map(Number)
    const L = F.found.little
    return hash(a, b, 91) < F.found.chance ? F.found.full : L[0] + hash(a, b, 92) * (L[1] - L[0])
  }
  // bomba do posto ao alcance (ainda não usada) → o posto; senão null
  function pumpNear(p) {
    if ((p.lv || 0) !== 0) return null
    const st = StationOf(0, Math.floor((p.z + 0.5) / CHUNK_SIZE))
    if (!st || used.has(st.z)) return null
    return PUMPS.some(([dx, dz]) => Math.hypot(p.x - st.x - dx, p.z - st.z - dz) < F.pump.reach) ? st : null
  }
  // carro ao lado que dá para abastecer (há ⛽ no estoque e o tanque não está cheio)
  function tankNear(p) {
    const v = vehicles.nearest(p)
    return v && !v.wrecked && v.fuel !== undefined && inv.gasolina > 0 && v.fuel < F.tank - 0.05 ? v : null
  }
  const text = (v) => `⛽ ${fmt(v.fuel || 0)}/${F.tank}`

  return {
    text,
    // a cada quadro: gasta a gasolina de quem está dirigindo; o alarme do posto continua chamando a horda
    update(dt) {
      for (const v of vehicles.list) {
        if (v.fuel === undefined) { v.fuel = Math.min(F.tank, initial(v)); v.fx = v.x; v.fz = v.z }
        const moved = Math.hypot(v.x - v.fx, v.z - v.fz)
        v.fx = v.x; v.fz = v.z
        v.stall = v.fuel <= 0
        if (!v.seats[0] || v.wrecked || v.stall) continue
        const before = v.fuel
        v.fuel = Math.max(0, v.fuel - moved / F.perCan)
        if (before > F.low && v.fuel <= F.low) say('⛽ Pouca gasolina!', 2)
        if (v.fuel <= 0) { v.stall = true; say('⛽ Acabou a gasolina! Com ⛽ no estoque, Usar perto do carro abastece', 3.5) }
      }
      for (let i = alarms.length - 1; i >= 0; i--) {
        const a = alarms[i]
        a.t -= dt
        if ((a.beat -= dt) <= 0) { a.beat = 1.5; noise(a.x, a.z, F.pump.alarm); sfx('alarm', { x: a.x, z: a.z }) }
        if (a.t <= 0) alarms.splice(i, 1)
      }
    },
    // Usar: bomba do posto ou abastecer o carro ao lado. false = nada a fazer aqui (aí Usar entra no carro)
    use(p) {
      if (p.vehicle || p.dead || p.task) return false
      const st = pumpNear(p)
      if (st) {
        tasks.start(p, { a: 'pump', icon: '⛽', need: F.pump.time, at: p, noise: 0, done: () => {
          if (used.has(st.z)) return
          used.add(st.z)
          inv.gasolina += F.pump.cans
          alarms.push({ x: st.x, z: st.z, t: F.pump.ring, beat: 0 })
          say(`🚨 ${p.name} encheu ${F.pump.cans} ⛽ — o alarme do posto disparou!`, 3)
        } })
        sfx('swap', { x: p.x, z: p.z })
        return true
      }
      const v = tankNear(p)
      if (!v) return false
      tasks.start(p, { a: 'refuel', icon: '⛽', need: F.refuel.time, at: v, noise: F.refuel.noise, valid: () => !v.wrecked && Math.hypot(v.x - p.x, v.z - p.z) < 3.5, done: () => {
        if (inv.gasolina <= 0) return
        inv.gasolina--
        v.fuel = Math.min(F.tank, v.fuel + 1)
        v.stall = false
        say(`⛽ ${p.name} abasteceu o carro: ${text(v)}`, 2)
        sfx('splash', { x: v.x, z: v.z, vol: 0.4 })
      } })
      sfx('swap', { x: v.x, z: v.z })
      return true
    },
    // texto do botão Usar (celular)
    label(p) {
      if (p.vehicle || p.dead || p.task) return ''
      return pumpNear(p) ? '⛽ Bomba (alarme!)' : tankNear(p) ? '⛽ Abastecer' : ''
    },
    clear() { used.clear(); alarms.length = 0 },
  }
}
