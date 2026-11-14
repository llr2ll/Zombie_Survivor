import { clock } from '../rules/survival'
import { PLAYER_COLORS } from '../../../engine/render/splitscreen'

const $ = (s) => document.querySelector(s)
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export const CORNERS = '<i class="c tl"></i><i class="c tr"></i><i class="c bl"></i><i class="c br"></i>'

// caixa de diálogo (cantos dourados, estilo em main.css · .dlg): fica no lugar do elemento com esse id, ou é criada na página
export function Dialog(id, parent = document.body) {
  let el = $(`#${id}`)
  if (!el) { el = document.createElement('div'); el.id = id; parent.appendChild(el) }
  el.classList.add('dlg')
  el.innerHTML = `${CORNERS}<div class="in"></div>`
  const inner = el.querySelector('.in')
  let last = null
  return { el, set(html) { if (html !== last) { last = html; inner.innerHTML = html } el.classList.toggle('on', !!html) } }
}

// "🌙 1ª noite de 2 — sem rádio posto…" → [título, texto]; mensagem curta vira só título, longa sem pausa vira só texto
export function Parts(t) {
  let best = null
  for (const s of [' — ', ': ', '! ']) {
    const i = t.indexOf(s)
    if (i > 0 && i <= 44 && t.length - i - s.length >= 6 && (!best || i < best.i)) best = { i, s }
  }
  if (!best) return t.length <= 34 ? [t, ''] : ['', t]
  const body = t.slice(best.i + best.s.length)
  return [t.slice(0, best.i) + (best.s === '! ' ? '!' : ''), body.charAt(0).toUpperCase() + body.slice(1)]
}
const say = (t) => { if (!t) return ''; const [h, b] = Parts(t); return (h ? `<h4>${esc(h)}</h4>` : '') + (b ? `<p>${esc(b)}</p>` : '') }

// fim da partida (vitória/derrota)
function result(r) {
  const s = (n, one, many) => `${n} ${n === 1 ? one : many}`
  const rows = [
    `⏱ ${r.time} · 🧟 ${r.kills} abates · ${r.score} pontos`,
    `🪵 ${s(r.bars, 'barricada de pé', 'barricadas de pé')} · 🪟 ${s(r.broken, 'janela quebrada', 'janelas quebradas')}${r.base ? ' · 📻 base marcada' : ''}`,
    r.boss ? `🕯️ Santa Compaña: ${r.boss === 'derrotada' ? '✝ derrotada!' : 'escapou'}` : '',
    r.levels.map(esc).join(' · '),
    r.account ? `⛪ Paróquia: +${r.account.gained} XP · nível ${r.account.to}${r.account.to > r.account.from ? ' (subiu!)' : ''}${r.account.unlocked.length ? ` · 🗝 novas: ${r.account.unlocked.join(', ')}` : ''}` : '',
    r.finds ? `⭐ ${s(r.finds, 'achado novo', 'achados novos')} na coleção (${r.findsTotal}/${r.findsOf})` : '',
    `Estoque: ${r.loot}`,
  ].filter(Boolean)
  return `<h3>${r.win ? '🚁 Vitória' : '💀 Derrota'}</h3>`
    + (r.cerco ? `<div class="cerco">Cerco ${r.cerco.n} · ${r.cerco.name}</div>` : '')
    + `<p>${r.win ? 'O exército chegou: vocês aguentaram' : 'Aguentaram'} <b>${r.nights} de ${r.of}</b> noite${r.of > 1 ? 's' : ''}</p>`
    + (r.cerco && r.cerco.freed ? `<p class="gold">🏆 Cerco ${r.cerco.freed.n} liberado: ${r.cerco.freed.name}!</p>` : '')
    + `<div class="rows">${rows.map((x) => `<div>${x}</div>`).join('')}</div><div class="foot">Voltando ao menu…</div>`
}

// cartão de um jogador: vida, nível, XP e uma linha só com o que importa agora
function card(game, p) {
  const inf = game.info(p)
  const hint = p.id === 'local' ? ' (V)' : p.id.startsWith('pad') ? ' (B)' : ''
  let sub
  if (p.dead) sub = game.st.over ? '' : p.out ? '💀 fora até o amanhecer' : `🆘 caído · ${Math.ceil(p.downT)} s`
  else if (p.held) sub = `<span class="grab">AGARRADO!${hint}</span>`
  else if (p.task) sub = `${p.task.icon} ${Math.round((p.task.t / p.task.need) * 100)}%`
  else if (p.cards && p.id !== 'local') sub = `<span class="up">⬆ ${p.id.startsWith('pad') ? 'escolha na TV' : 'escolhendo no celular'}</span>`
  else if (p.vehicle) sub = `🚗 ${esc(p.vehicle.d.name)} ${game.fuel.text(p.vehicle)}`
  else sub = esc(inf.text) + inf.buttons.filter((b) => b.cd > 0).map((b) => `<span class="cd">${esc(b.l)} ${Math.ceil(b.s)}s</span>`).join('')
  const tags = `${p.marked > 0 ? '🕯️ ' : ''}${p.buffT > 0 ? '✨ ' : ''}`
  const mana = p.cls.id === 'mage' ? `<div class="bar mp"><i style="width:${p.mana}%"></i></div>` : ''
  return `<div class="pl${p.dead ? ' dead' : ''}${p.held ? ' held' : ''}" style="--c:${PLAYER_COLORS[p.idx % 4]}"><span class="badge">${p.cls.icon}</span> `
    + `<div class="nm">${esc(p.name)}<span class="lv">NV ${p.level}</span></div><div class="bar"><i style="width:${(p.hp / p.max) * 100}%"></i></div>${mana}`
    + `<div class="bar xp"><i style="width:${game.levels.progress(p) * 100}%"></i></div><div class="sub">${tags}${sub}</div></div>`
}

export function CreateHud(game, climate) {
  let t = 0
  const msg = Dialog('msg', $('#hud')), find = Dialog('find'), panel = Dialog('result')
  const cards = document.createElement('div')
  cards.id = 'cards'
  document.body.appendChild(cards)
  let shown = '', found = null, over = null
  return {
    update(dt) {
      const r = game.st.over && game.st.result
      if (r !== over) { over = r; panel.set(r ? result(r) : '') }
      msg.set(say(game.st.msgT > 0 ? game.st.msg : (game.players.size ? '' : 'Entre pelo celular para jogar')))
      if ((t -= dt) > 0) return
      t = 0.1
      // achado raro: a história dele, por alguns segundos
      const f = game.st.find
      if (f !== found) { found = f; find.set(f ? `<h4>${f.icon} ${esc(f.title)}</h4>${f.fresh ? '<div class="tag">novo na coleção!</div>' : ''}<p>${f.text.map(esc).join('<br>')}</p>` : '') }
      // cartas para escolher de quem joga sem celular (teclado: 1, 2 ou 3 · controle: ◀ ▲ ▶ do direcional)
      const own = game.st.over ? [] : [...game.players.values()].filter((p) => p.cards && (p.id === 'local' || p.id.startsWith('pad')))
      const html = own.map((me) => {
        const keys = me.id === 'local' ? ['1', '2', '3'] : ['◀', '▲', '▶']
        return `<div class="cards-h">⬆ ${esc(me.name)} · nível ${me.level} · escolha com ${keys.map((k) => `<kbd>${k}</kbd>`).join(' ')}</div>`
          + `<div class="row">${me.cards.map((u, i) => `<div class="card"><span class="k">${keys[i]}</span><span class="ico">${u.icon}</span><b>${u.name}</b>${u.text}</div>`).join('')}</div>`
      }).join('')
      if (html !== shown) { shown = html; cards.innerHTML = html; cards.classList.toggle('on', !!html) }
      $('#wave').textContent = `${game.siege.text() || `⏱ ${clock(game.st.time)}`}${game.compana.text() ? ` · ${game.compana.text()}` : ''}` // dia/noite do cerco
      $('#zc').textContent = `🧟 ${game.zombies()}`
      $('#score').textContent = `⭐ ${game.st.score}`
      $('#inv').textContent = game.invText().trim() // estoque do grupo (saque) + 📻 se a base está marcada
      if (climate) $('#clock').textContent = climate.label()
      $('#plist').innerHTML = [...game.players.values()].map((p) => card(game, p)).join('')
    },
  }
}
