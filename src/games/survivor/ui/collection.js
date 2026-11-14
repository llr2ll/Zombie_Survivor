import { FINDS } from '../config/finds'

// Tela "Coleção" (J12a): no menu, o botão ⭐ (ou a tecla C) abre o álbum dos achados; os que faltam aparecem como "???".
// Esc ou clicar fora fecha. Criada aqui, sem mexer no index.html.
const CSS = `#colbtn { font: inherit; font-weight: 700; color: #fff; border: 0; border-radius: 8px; padding: 9px 12px; background: #b8892f; cursor: pointer; align-self: flex-start }
#colbtn:hover { background: #d29f3c }
#collection { position: fixed; inset: 0; z-index: 30; display: none; align-items: center; justify-content: center; background: #000b; color: #fff; font: 15px system-ui, sans-serif }
#collection .box { width: min(980px, 94vw); max-height: 88vh; overflow: auto; background: #241a14; border-radius: 14px; padding: 18px 20px }
#collection h2 { margin: 0 0 4px; color: #ffcf9a } #collection .hint { opacity: .6; font-size: 13px; margin-bottom: 12px }
#collection .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px }
#collection .it { background: #fff1; border-radius: 9px; padding: 9px 11px; line-height: 1.35 } #collection .it b { display: block; margin-bottom: 3px }
#collection .it.no { opacity: .45 } #collection .it i { font-style: normal; opacity: .85; font-size: 13.5px }`

export function CreateCollection(save) {
  const st = document.createElement('style')
  st.textContent = CSS
  document.head.appendChild(st)
  const btn = document.createElement('button')
  btn.id = 'colbtn'
  document.querySelector('#lobby .sub').after(btn)
  const box = document.createElement('div')
  box.id = 'collection'
  document.body.appendChild(box)
  const open = () => box.style.display === 'flex'
  const inLobby = () => !document.querySelector('#lobby').classList.contains('hidden')

  function show(on) {
    if (on) {
      const have = save.data.achados
      box.innerHTML = `<div class="box"><h2>⭐ Coleção de achados — ${have.length}/${FINDS.length}</h2><div class="hint">Achados raros (⭐) aparecem revistando móveis, mais no sótão e no quarto. Esc ou C fecha.</div><div class="grid">${FINDS.map((f) => have.includes(f.id)
        ? `<div class="it"><b>${f.icon} ${f.title}</b><i>${f.text.join('<br>')}</i></div>`
        : '<div class="it no"><b>❔ ???</b><i>Ainda não encontrado</i></div>').join('')}</div></div>`
    }
    box.style.display = on ? 'flex' : 'none'
  }
  btn.onclick = () => show(true)
  box.onclick = (e) => { if (e.target === box) show(false) }
  addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return
    if (open() && (e.key === 'Escape' || e.key.toLowerCase() === 'c')) return show(false)
    if (!open() && inLobby() && e.key.toLowerCase() === 'c' && !e.repeat) show(true)
  })
  return {
    // texto do botão (chamar ao voltar ao menu)
    refresh() { btn.textContent = `⭐ Coleção ${save.data.achados.length}/${FINDS.length}`; if (!inLobby()) show(false) },
  }
}
