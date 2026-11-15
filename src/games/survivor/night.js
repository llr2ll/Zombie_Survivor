// Noite estilo Zomboid (só aparência: os zumbis enxergam igual). Cada jogador vê um círculo em volta e, com a lanterna
// acesa, um cone para onde mira (no carro: os faróis, para a frente); postes e casas acesas também deixam ver em volta deles.
// Isso vira um mapa de luz por tela (engine/render/vision.js), pintado logo antes de cada tela ser desenhada.
import { VISION, PaintVision } from '../../engine/render/vision'
import { BALANCE } from './config/balance'

const N = BALANCE.night
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
// 0 de dia, 1 de noite (escurece do pôr do sol até a noite fechada; clareia no amanhecer). t: 0 = meia-noite, 0,5 = meio-dia
const amount = (t) => (t < 0.5 ? 1 - sm(0.22, 0.27, t) : sm(0.745, 0.79, t))

export function CreateNight({ streetLights, houseLights }) {
  let dark = 0
  const eyes = [], glows = []
  return {
    // a cada quadro: quão escuro está e de onde cada jogador enxerga. playing = false no menu (lá nada escurece)
    update(dt, players, time, playing) {
      const target = playing ? amount(time) * N.dark : 0
      dark += (target - dark) * (1 - Math.exp(-dt * 2))
      VISION.dark.value = dark < 0.003 ? 0 : dark
      VISION.floor.value = N.floor
      eyes.length = 0
      if (!VISION.dark.value) return
      for (const p of players) {
        const car = p.vehicle, a = car ? car.yaw : p.aimAngle
        eyes.push({ x: p.x, z: p.z, r: N.circle, dx: Math.sin(a), dz: Math.cos(a), range: car ? N.lamp.car : p.lamp && !p.dead ? N.lamp.range : 0, half: N.lamp.angle })
      }
    },
    // antes de desenhar cada tela: o mapa de luz em volta dela (members = jogadores dessa tela). De dia não faz nada
    paint(members) {
      if (!VISION.dark.value || !members.length) return
      let x = 0, z = 0, y = 0
      for (const p of members) { x += p.x; z += p.z; y += p.gy || 0 }
      x /= members.length; z /= members.length; y /= members.length
      glows.length = 0
      houseLights.around(x, z, 90, glows)
      streetLights.around(x, z, 90, glows)
      PaintVision(x, z, y, eyes, glows)
    },
  }
}
