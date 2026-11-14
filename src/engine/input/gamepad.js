// Controles de videogame (Gamepad API): cada controle ligado no PC vira um jogador, com o mesmo contrato do celular e do teclado.
// Botões no padrão "standard" do navegador (Xbox / PlayStation): a b x y lb rb lt rt back start l3 r3 up down left right home.
// O jogo passa: join(id) quando um controle novo aperta A ou Start (false = não entrou) · button(id, nome) a cada aperto
// · input(id, { mx, mz, ax, az, run }) a cada quadro (stick esquerdo anda, direito mira; LT ou clicar o stick esquerdo = correr)
// · leave(id) quando o controle é desligado. id = 'pad0'…'pad3'.
const NAMES = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'l3', 'r3', 'up', 'down', 'left', 'right', 'home']
const DEAD = 0.18 // zona morta dos sticks (controle velho não volta exatamente ao zero)
const dz = (v) => (Math.abs(v || 0) < DEAD ? 0 : v)

export function CreateGamepads({ join, button, input, leave = () => {} }) {
  const state = new Map() // índice do controle -> { id, joined, prev (botões no quadro anterior) }
  addEventListener('gamepaddisconnected', (e) => {
    const s = state.get(e.gamepad.index)
    if (s && s.joined) leave(s.id)
    state.delete(e.gamepad.index)
  })
  const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((g) => g && g.connected)
  return {
    // a cada quadro: o navegador só atualiza os controles quando alguém pergunta
    update() {
      for (const gp of pads()) {
        let s = state.get(gp.index)
        if (!s) state.set(gp.index, (s = { id: `pad${gp.index}`, joined: false, prev: [] }))
        const down = gp.buttons.map((b) => !!(b && (b.pressed || b.value > 0.5)))
        down.forEach((d, i) => {
          if (!d || s.prev[i] || !NAMES[i]) return
          if (s.joined) button(s.id, NAMES[i])
          else if (NAMES[i] === 'a' || NAMES[i] === 'start') s.joined = join(s.id) !== false // o aperto que entra não vira ação
        })
        s.prev = down
        if (s.joined) input(s.id, { mx: dz(gp.axes[0]), mz: dz(gp.axes[1]), ax: dz(gp.axes[2]), az: dz(gp.axes[3]), run: down[6] || down[10] ? 1 : 0 })
      }
    },
    // vibra, se o controle deixar (força 0..1, duração em ms)
    rumble(id, strength = 0.6, ms = 140) {
      const gp = pads().find((g) => `pad${g.index}` === id)
      const v = gp && gp.vibrationActuator
      if (v && v.playEffect) v.playEffect('dual-rumble', { duration: ms, strongMagnitude: strength, weakMagnitude: strength * 0.6 }).catch(() => {})
    },
    // saiu da vaga (removido no menu): o próximo A ou Start entra de novo
    forget(id) { for (const s of state.values()) if (s.id === id) s.joined = false },
  }
}
