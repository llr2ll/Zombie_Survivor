// Noite estilo Zomboid (só aparência: os zumbis enxergam igual). A cada quadro preenche a visão noturna do motor
// (engine/render/vision.js): cada jogador vê um círculo em volta e, com a lanterna acesa, um cone para onde mira
// (no carro: os faróis, para a frente); postes e casas acesas perto dos jogadores também deixam ver em volta deles.
import { VISION, VISION_SLOTS } from '../../engine/render/vision'
import { BALANCE } from './config/balance'

const N = BALANCE.night
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
// 0 de dia, 1 de noite (escurece do pôr do sol até a noite fechada; clareia no amanhecer). t: 0 = meia-noite, 0,5 = meio-dia
const amount = (t) => (t < 0.5 ? 1 - sm(0.22, 0.27, t) : sm(0.745, 0.79, t))

export function CreateNight({ streetLights, houseLights }) {
  let dark = 0
  return {
    // players = jogadores da partida; time = hora do clima; playing = false no menu (lá nada escurece)
    update(dt, players, time, playing) {
      const target = playing ? amount(time) * N.dark : 0
      dark += (target - dark) * (1 - Math.exp(-dt * 2))
      VISION.dark.value = dark < 0.003 ? 0 : dark
      VISION.floor.value = N.floor
      const eyes = VISION.eyes.value, beams = VISION.beams.value, cos = Math.cos(N.lamp.angle)
      for (let i = 0; i < VISION_SLOTS.eyes; i++) {
        const p = players[i]
        if (!p) { eyes[i].z = 0; beams[i].z = 0; continue }
        eyes[i].set(p.x, p.z, N.circle, p.gy || 0)
        const car = p.vehicle, a = car ? car.yaw : p.aimAngle
        beams[i].set(Math.sin(a), Math.cos(a), car ? N.lamp.car : p.lamp && !p.dead ? N.lamp.range : 0, cos)
      }
      const glows = VISION.glows.value, list = [...houseLights.glows, ...streetLights.glows]
      for (let i = 0; i < VISION_SLOTS.glows; i++) {
        const g = list[i]
        if (g) glows[i].set(g.x, g.z, g.r, g.top)
        else glows[i].z = 0
      }
    },
  }
}
