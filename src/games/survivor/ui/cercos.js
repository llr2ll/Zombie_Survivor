import { BALANCE } from '../config/balance'
import { NodeName } from '../../../shared/worldgen/names'

// Escolha do cerco no menu (J12b): ◀ ▶ (ou Q / E) entre os cercos já liberados; vencer um libera o próximo.
// Criada aqui, sem mexer no index.html (fica logo abaixo do botão da Coleção).
const C = BALANCE.cercos
const CSS = `#cercos { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; background: #0008; border-radius: 10px; padding: 8px 10px }
#cercos button { font: inherit; font-weight: 800; color: #fff; border: 0; border-radius: 8px; padding: 6px 12px; background: #fff2; cursor: pointer }
#cercos button:disabled { opacity: .3; cursor: default } #cercos b { flex: 1; font-size: 14px; text-align: center }
#cercos small { flex-basis: 100%; text-align: center; opacity: .6; font-size: 12px; margin-top: -4px }`

// texto de um cerco: "Cerco 3 · Santiago de Moreira — 3 noites · Labrego desde a 1ª noite"
export function CercoLabel(n) {
  const c = C[n - 1]
  const rules = [`${c.nights} noites`, c.bruteFrom ? `Labrego desde a ${c.bruteFrom}ª noite` : '', c.loot < 1 ? 'menos saque' : '', c.horde > 1 ? 'horda maior' : ''].filter(Boolean)
  return `Cerco ${n} · ${NodeName(0, c.j)} — ${rules.join(' · ')}`
}

export function CreateCercoPicker(save) {
  const st = document.createElement('style')
  st.textContent = CSS
  document.head.appendChild(st)
  const box = document.createElement('div')
  box.id = 'cercos'
  box.innerHTML = '<button id="cprev">◀</button><b id="cname"></b><button id="cnext">▶</button><small id="copen"></small>'
  // na mesma linha do botão da Coleção (o menu não cresce)
  const col = document.querySelector('#colbtn')
  if (col) { const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;align-items:stretch'; col.before(row); row.append(col, box) }
  else document.querySelector('#lobby .sub').after(box)
  let n = 1
  const open = () => save.open(C.length)
  function render() {
    n = Math.max(1, Math.min(open(), n))
    box.querySelector('#cname').textContent = CercoLabel(n)
    box.querySelector('#copen').textContent = open() < C.length ? `🔒 vença o Cerco ${open()} para liberar o ${open() + 1}` : '🏆 todos liberados'
    box.querySelector('#cprev').disabled = n <= 1
    box.querySelector('#cnext').disabled = n >= open()
  }
  const step = (d) => { n += d; render() }
  box.querySelector('#cprev').onclick = () => step(-1)
  box.querySelector('#cnext').onclick = () => step(1)
  addEventListener('keydown', (e) => {
    if (document.querySelector('#lobby').classList.contains('hidden') || (e.target && e.target.tagName === 'INPUT') || e.repeat) return
    const k = e.key.toLowerCase()
    if (k === 'q') step(-1)
    if (k === 'e') step(1)
  })
  render()
  return {
    value: () => n, // cerco escolhido
    refresh: render, // ao voltar ao menu (pode ter liberado um novo)
  }
}
