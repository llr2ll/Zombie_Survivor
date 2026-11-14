// Menu da partida (Esc · Start no controle · ☰ no celular): pausa para todos e mostra o desenho dos controles, o QR para alguém
// entrar no meio da partida, Continuar e Voltar ao menu inicial. Voltar abre uma votação: passa com a maioria dos jogadores
// (quem pediu já conta como sim; bots de teste votam sim). Estilo em main.css · #pause.
import QRCode from 'qrcode'
import { CORNERS, esc } from './hud'

const VOTE_SECONDS = 20 // sem maioria nesse tempo, a votação cai

// teclado: [tecla, o que faz, esquerda, topo, largura (em), tipo: mv = andar · cls = habilidade da classe]
const KEYS = [
  ['Esc', 'menu', 0, 0], ['1', 'carabina', 5.8, 0, 5.2], ['2', 'espingarda', 11.4, 0, 5.2], ['3', 'pistola', 17, 0, 5.2],
  ['Q', 'hab. 1', 6.9, 4.6, 0, 'cls'], ['W', '↑', 11.5, 4.6, 0, 'mv'], ['E', 'usar', 16.1, 4.6], ['R', 'recarregar', 20.7, 4.6],
  ['A', '←', 8, 9.2, 0, 'mv'], ['S', '↓', 12.6, 9.2, 0, 'mv'], ['D', '→', 17.2, 9.2, 0, 'mv'], ['F', 'hab. 2', 21.8, 9.2, 0, 'cls'], ['G', 'hab. 3', 26.4, 9.2, 0, 'cls'],
  ['Shift', 'correr', 0, 13.8, 9.6], ['V', 'empurrar', 24.1, 13.8], ['Espaço', 'pular', 12, 18.4, 19],
]
const KEYBOARD = `<div class="kb">${KEYS.map(([k, a, x, y, w, t]) => `<div class="k ${t || ''}" style="left:${x}em;top:${y}em${w ? `;width:${w}em` : ''}"><b>${k}</b><i>${a}</i></div>`).join('')}</div>
  <div class="mouse"><span class="l">clique<br>atacar</span><span class="r">direito<br>só mirar</span></div>
  <div class="kb-note"><b>Cartas:</b> 1 2 3 · <b>M</b> som${import.meta.env.DEV || import.meta.env.VITE_TEST_KEYS ? ' · <b>Teste:</b> T desfoque · N +1 hora · K tempo · B bots' : ''}</div>`
const GAMEPAD = `<svg viewBox="0 0 560 262" aria-label="Controle de videogame">
  <path d="M170 70 Q280 52 390 70 Q440 78 458 140 Q476 210 432 222 Q400 230 372 186 Q280 170 188 186 Q160 230 128 222 Q84 210 102 140 Q120 78 170 70Z" fill="#3a2418" stroke="#e8c27a" stroke-opacity=".5" stroke-width="2"/>
  <rect x="160" y="52" width="60" height="14" rx="7" fill="#c85b72"/><rect x="340" y="52" width="60" height="14" rx="7" fill="#c85b72"/>
  <circle cx="190" cy="118" r="20" fill="#233a52" stroke="#bfe3ff" stroke-opacity=".6" stroke-width="2"/><circle cx="330" cy="160" r="20" fill="#5a2e14" stroke="#ff9d3f" stroke-opacity=".7" stroke-width="2"/>
  <path d="M232 150h10v-10h10v10h10v10h-10v10h-10v-10h-10z" fill="#5e3e2b" stroke="#e8c27a" stroke-opacity=".5"/>
  <g fill="#5e3e2b" stroke="#e8c27a" stroke-opacity=".6"><circle cx="390" cy="98" r="10"/><circle cx="370" cy="118" r="10"/><circle cx="410" cy="118" r="10"/><circle cx="390" cy="138" r="10"/></g>
  <text x="390" y="102" text-anchor="middle" class="lbl">Y</text><text x="370" y="122" text-anchor="middle" class="lbl">X</text><text x="410" y="122" text-anchor="middle" class="lbl">B</text><text x="390" y="142" text-anchor="middle" class="lbl">A</text>
  <rect x="296" y="104" width="22" height="10" rx="5" fill="#f1c56b"/>
  <g stroke="#e8c27a" stroke-opacity=".5" fill="none"><path d="M190 52V30H120"/><path d="M370 52V30H440"/><path d="M168 118H60"/><path d="M247 175V236H160"/><path d="M330 182V236H380"/><path d="M400 98L470 70"/><path d="M380 118L470 100"/><path d="M420 118L470 130"/><path d="M398 142L470 160"/><path d="M307 104V20H280"/></g>
  <text x="116" y="34" text-anchor="end" class="lbl g">LB · hab. 1 · LT correr</text><text x="444" y="34" class="lbl g">RB · hab. 2</text>
  <text x="56" y="122" text-anchor="end" class="lbl">andar</text><text x="156" y="240" text-anchor="end" class="lbl">◀ ▲ ▶ cartas</text><text x="384" y="240" class="lbl">mirar e atacar</text>
  <text x="474" y="74" class="lbl">Y · hab. 3</text><text x="474" y="104" class="lbl">X · usar</text><text x="474" y="134" class="lbl">B · empurrar</text><text x="474" y="164" class="lbl">A · pular</text>
  <text x="276" y="24" text-anchor="end" class="lbl g">Start · menu</text></svg>`
const PHONE = `<svg viewBox="0 0 560 262" aria-label="Controle no celular">
  <rect x="70" y="26" width="420" height="210" rx="26" fill="#0c0907" stroke="#e8c27a" stroke-opacity=".45" stroke-width="2"/><rect x="82" y="38" width="396" height="186" rx="16" fill="#2a1c14"/>
  <circle cx="170" cy="120" r="34" fill="none" stroke="#bfe3ff" stroke-dasharray="4 4" stroke-opacity=".7"/><circle cx="380" cy="120" r="34" fill="none" stroke="#ff9d3f" stroke-dasharray="4 4" stroke-opacity=".8"/>
  <text x="170" y="124" text-anchor="middle" class="lbl">andar</text><text x="380" y="118" text-anchor="middle" class="lbl">mirar e</text><text x="380" y="132" text-anchor="middle" class="lbl">atacar</text>
  <circle cx="112" cy="196" r="18" fill="#5e3e2b"/><text x="112" y="200" text-anchor="middle" class="lbl" style="font-size:9px">Correr</text>
  <circle cx="404" cy="196" r="18" fill="#5e3e2b" stroke="#e25555" stroke-opacity=".7"/><text x="404" y="200" text-anchor="middle" class="lbl" style="font-size:8px">Empurrar</text>
  <circle cx="448" cy="196" r="18" fill="#5e3e2b"/><text x="448" y="200" text-anchor="middle" class="lbl" style="font-size:9px">Pular</text>
  <circle cx="448" cy="150" r="20" fill="#1f4f78" stroke="#7fd0ff"/><text x="448" y="154" text-anchor="middle" class="lbl" style="font-size:9px">Usar</text>
  <rect x="210" y="184" width="60" height="26" rx="7" fill="#3a2418" stroke="#ffcf9a" stroke-opacity=".4"/><rect x="278" y="184" width="60" height="26" rx="7" fill="#3a2418" stroke="#ffcf9a" stroke-opacity=".4"/>
  <text x="274" y="201" text-anchor="middle" class="lbl g" style="font-size:9.5px">habilidades da classe</text>
  <rect x="446" y="46" width="24" height="18" rx="5" fill="#f1c56b"/><text x="458" y="59" text-anchor="middle" style="font:700 11px system-ui;fill:#1b1512">☰</text>
  <path d="M470 56H520" stroke="#e8c27a" stroke-opacity=".5"/><text x="522" y="60" class="lbl g">menu</text></svg>`

// voters() = [{ id, name, color, bot }] (quem está na partida) · onQuit() = a votação passou · onChange() = avisar os celulares
export function CreatePause({ voters, onQuit, onChange = () => {} }) {
  const root = document.createElement('div')
  root.id = 'pause'
  root.className = 'hidden'
  root.innerHTML = `<div class="dim"></div><div class="paused">⏸ PAUSADO</div>
    <div class="menu dlg">${CORNERS}<h3>PAUSA</h3>
      <div class="cols"><div>
          <div class="tabs"><button data-t="kb">⌨️ Teclado e mouse</button><button data-t="pad">🎮 Controle</button><button data-t="ph">📱 Celular</button></div>
          <div class="pane" data-p="kb">${KEYBOARD}</div><div class="pane" data-p="pad">${GAMEPAD}</div><div class="pane" data-p="ph">${PHONE}</div></div>
        <div class="join"><small>ENTRAR NA PARTIDA</small><canvas width="300" height="300"></canvas><b class="code">----</b>
          <span>Escaneie com o celular: entra direto no jogo</span><div class="url"></div></div></div>
      <div class="acts"><button class="btn go resume">▶ Continuar <kbd>Esc</kbd></button><button class="btn quit">🏠 Voltar ao menu inicial</button></div>
      <p class="note">Voltar ao menu abre uma votação: precisa da maioria dos jogadores. No controle: Start continua, Y pede para voltar.</p></div>
    <div class="vote dlg">${CORNERS}<div class="in"></div></div>`
  document.body.appendChild(root)
  const box = root.querySelector('.vote .in')
  let open = false, vote = null, failT = 0, lastLeft = -1

  const tab = (t) => {
    root.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === t))
    root.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.p !== t })
  }
  root.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => tab(b.dataset.t)))
  root.querySelector('.resume').addEventListener('click', () => api.close())
  root.querySelector('.quit').addEventListener('click', () => api.ask('local'))
  root.querySelector('.vote').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) api.cast('local', b.dataset.v === 'y') })

  const need = (n) => Math.floor(n / 2) + 1 // maioria: 1 de 1, 2 de 2, 2 de 3, 3 de 4
  const nameOf = (id) => voters().find((v) => v.id === id)?.name || 'Alguém'
  // quem saiu da partida no meio da votação deixa de contar
  function current() {
    const vs = voters(), ids = new Set(vs.map((v) => v.id))
    for (const s of [vote.yes, vote.no]) for (const id of s) if (!ids.has(id)) s.delete(id)
    return vs
  }
  function check() {
    const n = current().length, k = need(n)
    if (vote.yes.size >= k) { vote = null; render(); onQuit(); return }
    if (vote.no.size > n - k) return fail()
    render()
    onChange()
  }
  function fail() { vote = null; failT = 2.5; render(); onChange() }
  function render() {
    root.classList.toggle('voting', !!vote || failT > 0)
    if (!vote) { if (failT > 0) box.innerHTML = '<h4>Votação recusada</h4><p>A partida continua.</p>'; return }
    const vs = voters(), k = need(vs.length), mark = (id) => (vote.yes.has(id) ? 'y' : vote.no.has(id) ? 'n' : '')
    const me = vs.some((v) => v.id === 'local') && !mark('local')
    box.innerHTML = `<h4>Voltar ao menu inicial?</h4><p>${esc(nameOf(vote.by))} pediu. Precisa de ${k} dos ${vs.length} votos.</p>`
      + `<div class="voters">${vs.map((v) => `<span class="vt ${mark(v.id)}" style="--c:${v.color}">${{ y: '✔', n: '✖' }[mark(v.id)] || '…'} ${esc(v.name)}</span>`).join('')}</div>`
      + `<div class="vfoot"><b>Teclado:</b> Y sim · N não · <b>Controle:</b> A sim · B não · <b>Celular:</b> na tela · ⏳ ${Math.max(0, Math.ceil(vote.t))} s</div>`
      + `<div class="acts">${me ? '<button class="btn go" data-v="y">✔ Sim <kbd>Y</kbd></button><button class="btn" data-v="n">✖ Não <kbd>N</kbd></button>' : ''}</div>`
  }

  const api = {
    isOpen: () => open,
    voting: () => !!vote,
    // from = qual desenho mostrar primeiro: kb (teclado) · pad (controle) · ph (celular)
    open(from = 'kb') { if (open) return; open = true; tab(from); root.classList.remove('hidden'); render(); onChange() },
    close() { if (!open) return; open = false; vote = null; failT = 0; root.classList.remove('voting'); root.classList.add('hidden'); onChange() },
    toggle(from) { if (open) api.close(); else api.open(from) },
    ask(id) {
      if (!open) api.open()
      if (vote) return
      vote = { by: id, yes: new Set(), no: new Set(), t: VOTE_SECONDS }
      for (const v of voters()) if (v.bot || v.id === id) vote.yes.add(v.id)
      lastLeft = -1
      check()
    },
    cast(id, yes) {
      if (!vote || !voters().some((v) => v.id === id)) return
      vote.yes.delete(id); vote.no.delete(id)
      ;(yes ? vote.yes : vote.no).add(id)
      check()
    },
    // tempo de verdade (corre com o jogo pausado)
    update(dt) {
      if (failT > 0 && (failT -= dt) <= 0) { failT = 0; render() }
      if (!vote) return
      if ((vote.t -= dt) <= 0) return fail()
      const left = Math.ceil(vote.t)
      if (left !== lastLeft) { lastLeft = left; render(); onChange() }
    },
    setRoom(code) {
      const url = `${location.origin}/controller.html?room=${code}`
      root.querySelector('.code').textContent = code
      root.querySelector('.url').textContent = url
      const c = root.querySelector('canvas')
      QRCode.toCanvas(c, url, { width: 300, margin: 1 }, () => { c.style.width = c.style.height = '' }) // a biblioteca fixa 300px: o tamanho vem do main.css
    },
    // o que o celular precisa saber: menu aberto e a votação (mine = o voto dele)
    info(id) {
      if (!vote) return { open: open ? 1 : 0, vote: 0 }
      const n = voters().length
      return { open: 1, vote: { by: nameOf(vote.by), yes: vote.yes.size, need: need(n), total: n, left: Math.max(0, Math.ceil(vote.t)), mine: vote.yes.has(id) ? 'yes' : vote.no.has(id) ? 'no' : '' } }
    },
    reset() { open = false; vote = null; failT = 0; root.classList.remove('voting'); root.classList.add('hidden') },
  }
  return api
}
