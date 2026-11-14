// O celular entra numa sala: fala com o servidor (entrar, sinalização e plano B) e tenta a conexão direta com a tela (link.js).
// Mensagens para a tela vão direto quando a conexão direta está aberta; senão, pelo servidor (como antes).
import { CreateLink, RelayURL } from './link'

// direct = false: nem tenta a conexão direta (?direto=0 no endereço do controle; para testar o plano B)
export function JoinRoom({ code, name, direct = true, onMessage, onLink = () => {}, onError = () => {}, onClose = () => {} }) {
  const ws = new WebSocket(RelayURL())
  let link = null
  const relay = (o) => ws.readyState === 1 && ws.send(JSON.stringify(o))
  ws.onopen = () => relay({ t: 'join', code, name })
  ws.onerror = onError
  ws.onclose = () => { if (link) link.close(); onClose() }
  ws.onmessage = (e) => {
    let m
    try { m = JSON.parse(e.data) } catch { return }
    if (m.t === 'rtc' || m.t === 'ice') return link && link.handle(m)
    // entrou na sala: o celular começa a conexão direta (a tela responde)
    if (m.t === 'joined' && direct && !link) link = CreateLink({ caller: true, signal: relay, onMessage, onChange: onLink })
    onMessage(m)
  }
  return {
    send: (o) => { if (!(link && link.send(o, o.t === 'in'))) relay(o) },
    close: () => { if (link) link.close(); ws.close() },
  }
}
