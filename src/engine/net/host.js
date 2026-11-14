// A tela do jogo (host) abre uma sala no servidor; celulares entram com o código.
// Cada celular tenta a conexão direta (link.js): o servidor só apresenta os dois e fica de plano B.
// O jogo recebe as mesmas coisas de antes (onRoom, onJoin, onLeave, onInput, onAct, onOffline) + onLink(id, direto).
import { CreateLink, RelayURL } from './link'

export function ConnectHost(h) {
  let ws
  const links = new Map() // id do celular -> conexão direta
  const relay = (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o))
  const drop = (id) => { const l = links.get(id); if (l) { links.delete(id); l.close() } }
  // só comando e ação viram jogo, venham direto ou pelo servidor
  const deliver = (id, m) => { if (m.t === 'in') h.onInput(id, m); else if (m.t === 'act') h.onAct(id, m.a) }
  const api = {
    // manda para um celular: direto se a conexão estiver aberta, senão pelo servidor
    send: (id, data) => { const l = links.get(id); if (!(l && l.send(data))) relay({ id, ...data }) },
  }

  // o celular mandou a oferta: a tela cria a conexão e responde; os endereços chegam depois, em ordem
  function signal(m) {
    const id = m.id
    if (m.t === 'rtc' && m.sdp && m.sdp.type === 'offer') {
      drop(id)
      const l = CreateLink({ caller: false, signal: (s) => relay({ id, ...s }), onMessage: (x) => deliver(id, x), onChange: (on) => links.has(id) && h.onLink && h.onLink(id, on) })
      if (l) links.set(id, l)
    }
    const l = links.get(id)
    if (l) l.handle(m)
  }

  function open() {
    ws = new WebSocket(RelayURL())
    ws.onopen = () => relay({ t: 'host' })
    ws.onmessage = (e) => {
      let m
      try { m = JSON.parse(e.data) } catch { return }
      if (m.t === 'room') h.onRoom(m.code)
      else if (m.t === 'join') h.onJoin(m.id, m.name)
      else if (m.t === 'leave') { drop(m.id); h.onLeave(m.id) }
      else if (m.t === 'rtc' || m.t === 'ice') signal(m)
      else deliver(m.id, m)
    }
    ws.onclose = () => {
      for (const id of [...links.keys()]) drop(id)
      h.onOffline && h.onOffline()
      setTimeout(open, 2000)
    }
  }
  open()
  return api
}
