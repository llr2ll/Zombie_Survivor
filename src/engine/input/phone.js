// Controle no celular: stick esquerdo move (ou dirige), stick direito mira (e ataca enquanto estiver inclinado).
// Botões da classe chegam do jogo (nome + recarga) e o botão Usar muda com o que está perto (revistar, carro…).
// Empurrar: afasta/derruba zumbis e solta do agarrão (pisa em quem está caído); treme quando um zumbi agarra.
// Cartas: quando o jogo manda `up` ([título, texto] de cada opção), mostra as cartas; tocar manda a ação up1, up2, up3…
// Vibração: a TV manda `buzz` (tiro, explosão…); agarrão, queda e cartas vibram daqui. iPhone não vibra pelo navegador.
import { JoinRoom } from '../net/join'

const $ = (s) => document.querySelector(s)
const pad = $('#pad')
const params = new URLSearchParams(location.search)
$('#code').value = (params.get('room') || '').toUpperCase()
$('#name').value = localStorage.getItem('name') || ''

const input = { mx: 0, mz: 0, ax: 0, az: 0, run: 0 }
let conn, kicked = false, lastUp = '', lastHeld = false, lastDead = false, heldPulse = 0, rvMax = 1, useLabel = null
const cds = [0, 0, 0]

// vibração: ms ou padrão [vibra, pausa, vibra…]; uma curta não corta uma mais forte que ainda está tocando
let vibeEnd = 0
function vibe(p) {
  const total = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p
  const now = performance.now()
  if (now < vibeEnd && total < vibeEnd - now) return
  vibeEnd = now + total
  navigator.vibrate?.(p)
}

// direto com a tela quando der (⚡), senão pelo servidor (🌐) — engine/net/join.js escolhe
function send(o) { if (conn) conn.send(o) }

$('#go').onclick = () => {
  const code = $('#code').value.trim().toUpperCase(), name = $('#name').value.trim() || 'Jogador'
  if (code.length !== 4) return ($('#err').textContent = 'Digite o código de 4 letras')
  localStorage.setItem('name', name)
  $('#err').textContent = ''
  if (conn) conn.close() // tentou de novo (ex.: código errado): fecha a tentativa anterior
  const me = (conn = JoinRoom({
    code, name, direct: params.get('direto') !== '0',
    onError: () => ($('#err').textContent = 'Não consegui conectar ao servidor'),
    onLink: setLink,
    onClose: () => { if (conn === me && !kicked && pad.style.display === 'block') showMsg('Desconectado', 'Recarregue a página para entrar de novo') },
    onMessage: (m) => {
      if (m.t === 'joined') {
        $('#join').style.display = 'none'
        pad.style.display = 'block'
        pad.dataset.mode = 'wait'
        setLink(false) // vira ⚡ quando a conexão direta abrir
        document.documentElement.requestFullscreen?.().catch(() => {})
        screen.orientation?.lock?.('landscape').catch(() => {})
      } else if (m.t === 'error') $('#err').textContent = m.msg
      else if (m.t === 'state') { pad.dataset.mode = 'play'; showPick(''); onState(m) }
      else if (m.t === 'buzz') vibe(m.ms)
      else if (m.t === 'hit') { vibe(90); flash() }
      else if (m.t === 'lobby') onLobby(m)
      else if (m.t === 'kick') { kicked = true; showPick(''); showMsg(m.msg || 'Removido da sala'); me.close() }
      else if (m.t === 'closed') { showPick(''); showMsg('Jogo encerrado') }
    },
  }))
}

function setLink(on) {
  const t = on ? '⚡ direto' : '🌐 servidor'
  $('#link').textContent = t
  $('#link').classList.toggle('relay', !on)
  $('#wlink').textContent = `📱 Celular · ${t}`
}

// espera no menu: número e cor da vaga (iguais aos da TV) + a classe com ◀ ▶
function onLobby(m) {
  pad.dataset.mode = 'wait'
  if (m.color) document.documentElement.style.setProperty('--me', m.color)
  $('#slotname').textContent = `JOGADOR ${m.slot}`
  $('#foot').textContent = `Esperando a partida começar · ${m.total} na sala`
  showPick(m.pick || '')
}
function showPick(t) { $('#pickname').textContent = t; $('#pick').style.display = t ? 'grid' : 'none' }

// aviso grande no meio; ring = fração do anel (caído), null = sem anel
function setState(big, sub = '', ring = null, secs = 0) {
  $('#state .big').textContent = big
  $('#state .sub').textContent = sub
  $('#state').classList.toggle('on', !!big)
  $('#ring').classList.toggle('on', ring !== null)
  if (ring !== null) { $('#ring .left').style.setProperty('--p', ring); $('#ring b').textContent = secs }
}
function showMsg(big, sub = '') { pad.dataset.mode = 'msg'; pad.classList.remove('down', 'grabbed'); setState(big, sub) }
function flash() { pad.classList.remove('hurt'); void pad.offsetWidth; pad.classList.add('hurt') }

// "🔍 Revistar" → ['🔍', 'Revistar'] (o ícone vai grande no botão/carta)
function splitIcon(s) {
  const m = /^(\p{Extended_Pictographic}\S*)\s+(.*)$/u.exec(s || '')
  return m ? [m[1], m[2]] : ['', s || '']
}

function onState(m) {
  const hp = Math.max(0, m.hp / m.max)
  $('#hp i').style.width = `${hp * 100}%`
  $('#hp').classList.toggle('low', hp < 0.3)
  $('#cls').textContent = m.cls || ''
  $('#weapon').textContent = m.w || ''
  ;(m.btn || []).concat([null, null, null]).slice(0, 3).forEach((b, i) => {
    const el = $(`#b${i + 1}`)
    el.classList.toggle('hide', !b)
    if (!b) return
    if (el.textContent !== b[0]) el.textContent = b[0]
    el.style.setProperty('--cd', b[1])
    el.classList.toggle('cool', b[1] > 0)
    if (cds[i] > 0 && b[1] <= 0) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready') } // recarregou: brilha
    cds[i] = b[1]
  })
  // botão Usar: sair do carro · ação que o jogo mandar (u, ex.: revistar um móvel) · entrar no carro
  const label = m.car === 2 ? '🚗 Sair' : m.u || (m.car === 1 ? '🚗 Entrar' : '')
  const use = $('#use')
  use.className = m.car === 2 ? 'in' : label ? 'near' : ''
  if (label !== useLabel) {
    useLabel = label
    const [ico, txt] = splitIcon(label)
    use.querySelector('.ico').textContent = ico
    use.querySelector('.lbl').textContent = txt
  }
  $('#inv').textContent = m.inv || ''
  $('#time').textContent = `⏱ ${String(Math.floor(m.time / 60)).padStart(2, '0')}:${String(m.time % 60).padStart(2, '0')}`
  $('#shove').classList.toggle('alert', !!m.held)
  $('#st i').style.width = `${m.st}%`
  if (m.st <= 0 && input.run) { input.run = 0; $('#run').classList.remove('on') }

  // caído (anel com os segundos que faltam) · fora até o amanhecer · agarrado
  pad.classList.toggle('down', !!m.dead)
  pad.classList.toggle('grabbed', !m.dead && !!m.held)
  if (m.dead) {
    if (m.rv > 0) rvMax = Math.max(rvMax, m.rv)
    if (m.rv > 0) setState('Você caiu', 'Um aliado do seu lado te levanta com Usar', m.rv / rvMax, m.rv)
    else setState(m.rv < 0 ? 'Fora até o amanhecer' : 'Você caiu', m.rv < 0 ? 'Você volta quando o sol nascer' : '')
  } else {
    rvMax = 1
    setState(m.held ? 'Agarrado!' : '', m.held ? 'Empurre ou puxe o stick para longe' : '')
  }

  // vibração: agarrão forte e pulsos enquanto segura; caiu; levantou
  const now = performance.now()
  if (m.held && !lastHeld) { vibe([120, 60, 120]); heldPulse = now + 700 }
  else if (m.held && now > heldPulse) { vibe(40); heldPulse = now + 600 }
  if (m.dead && !lastDead) vibe([250, 100, 400])
  else if (!m.dead && lastDead) vibe([30, 50, 30])
  lastHeld = !!m.held
  lastDead = !!m.dead
  showCards(m.up)
}

// cartas para escolher (ex.: melhoria ao subir de nível); somem ao tocar, voltam se o jogo mandar outras
function showCards(up) {
  const key = up ? JSON.stringify(up) : ''
  if (key === lastUp) return
  lastUp = key
  const el = $('#cards')
  el.replaceChildren()
  for (const [i, [title, text]] of (up || []).entries()) {
    const [ico, name] = splitIcon(title)
    const b = document.createElement('button'), s = document.createElement('span'), t = document.createElement('b')
    s.className = 'ico'
    s.textContent = ico
    t.textContent = name
    b.append(s, t, text)
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a: `up${i + 1}` }); $('#pickup').classList.remove('on'); vibe(20) })
    el.appendChild(b)
  }
  $('#pickup').classList.toggle('on', !!up)
  if (up) vibe([40, 40, 40, 40, 90])
}

function Stick(zone, cb) {
  const base = zone.querySelector('.base'), knob = zone.querySelector('.knob'), R = 55
  let id = null, ox = 0, oy = 0
  const move = (e) => {
    let dx = e.clientX - ox, dy = e.clientY - oy
    const l = Math.hypot(dx, dy)
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R }
    knob.style.transform = `translate(${dx}px,${dy}px)`
    cb(dx / R, dy / R)
  }
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return
    id = e.pointerId
    zone.setPointerCapture(id)
    ox = e.clientX; oy = e.clientY
    base.style.cssText = `display:block;left:${ox}px;top:${oy}px`
    zone.classList.add('busy')
    move(e)
  })
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e) })
  const end = (e) => {
    if (e.pointerId !== id) return
    id = null
    base.style.display = 'none'
    knob.style.transform = ''
    zone.classList.remove('busy')
    cb(0, 0)
  }
  zone.addEventListener('pointerup', end)
  zone.addEventListener('pointercancel', end)
}
Stick($('#zl'), (x, y) => { input.mx = x; input.mz = y })
Stick($('#zr'), (x, y) => { input.ax = x; input.az = y })

for (const [id, a] of [['#b1', 'b1'], ['#b2', 'b2'], ['#b3', 'b3'], ['#use', 'use'], ['#prev', 'prev'], ['#next', 'next']]) {
  $(id).addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a }); vibe(15) })
}

// Correr liga/desliga (os dois polegares ficam nos sticks); Pular é um toque
$('#run').addEventListener('pointerdown', (e) => { e.stopPropagation(); input.run = input.run ? 0 : 1; $('#run').classList.toggle('on', !!input.run); vibe(15) })
$('#jump').addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a: 'jump' }); vibe(15) })
$('#shove').addEventListener('pointerdown', (e) => { e.stopPropagation(); send({ t: 'act', a: 'shove' }); vibe(25) })

// botões afundam enquanto o dedo está em cima
document.addEventListener('pointerdown', (e) => { const b = e.target.closest?.('button'); if (b) b.classList.add('press') }, true)
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => document.querySelectorAll('.press').forEach((b) => b.classList.remove('press')), true)

// fundo: triângulos gerados aqui (como o mundo do jogo: nada de imagem pronta), um para cada orientação.
// SVG em texto, não canvas: canvas + JPEG travava a abertura da página enquanto a placa de vídeo estava ocupada
function facets(w, h, seed) {
  const out = []
  let s = seed >>> 0
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const cell = 58, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell), P = []
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    const jx = x === 0 || x === cols ? 0 : (rnd() - 0.5) * cell * 0.8, jy = y === 0 || y === rows ? 0 : (rnd() - 0.5) * cell * 0.8
    P.push([x * cell + jx, y * cell + jy])
  }
  const at = (x, y) => P[y * (cols + 1) + x]
  const tri = (a, b, d) => {
    const cx = (a[0] + b[0] + d[0]) / 3, cy = (a[1] + b[1] + d[1]) / 3
    const glow = Math.max(0, 1 - Math.hypot(cx - w * 0.5, cy + h * 0.15) / (Math.max(w, h) * 0.75)) // brilho quente no alto
    const c = `hsl(${Math.round(19 + rnd() * 7)},${Math.round(26 + glow * 14)}%,${(7 + rnd() * 3.4 + glow * 7 - (cy / h) * 2).toFixed(1)}%)`
    const p = (q) => `${Math.round(q[0])} ${Math.round(q[1])}`
    out.push(`<path d="M${p(a)}L${p(b)}L${p(d)}Z" fill="${c}" stroke="${c}"/>`) // contorno da mesma cor: sem frestas entre triângulos
  }
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const a = at(x, y), b = at(x + 1, y), d = at(x, y + 1), e = at(x + 1, y + 1)
    if ((x + y) % 2) { tri(a, b, e); tri(a, e, d) } else { tri(a, b, d); tri(b, e, d) }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out.join('')}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}
{
  const big = Math.min(1000, Math.max(screen.width, screen.height, 640)), small = Math.round(big * Math.min(screen.width, screen.height) / Math.max(screen.width, screen.height, 1)) || 400
  document.documentElement.style.setProperty('--facets-l', facets(big, small, 7))
  document.documentElement.style.setProperty('--facets-p', facets(small, big, 11))
}

setInterval(() => send({ t: 'in', run: input.run, mx: +input.mx.toFixed(2), mz: +input.mz.toFixed(2), ax: +input.ax.toFixed(2), az: +input.az.toFixed(2) }), 33)
