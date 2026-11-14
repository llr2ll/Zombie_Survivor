// Conexão direta (WebRTC) entre a tela e um celular, sem servidor no meio. O servidor só "apresenta" os dois na entrada
// (sinalização: oferta, resposta e endereços possíveis); depois as mensagens vão direto. Se a conexão direta não abrir
// (rede que bloqueia, navegador sem WebRTC), quem usa o link continua mandando pelo servidor, como antes.
// Dois canais: 'in' rápido (sem reenviar e fora de ordem: o comando dos sticks, só vale o mais novo) e 'rel' confiável (o resto).
const STUN = [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }]
const GIVE_UP = 12000 // ms sem abrir = desiste (fica pelo servidor)

// endereço do servidor: VITE_WS_URL se definido; no dev, pelo proxy do Vite (mesma porta e host do jogo); senão porta 8080
export function RelayURL() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL
  const ws = location.protocol === 'https:' ? 'wss' : 'ws'
  if (import.meta.env.DEV) return `${ws}://${location.host}/ws`
  return `${ws}://${location.hostname}:8080`
}

// servidores que dizem o endereço de fora de cada aparelho (STUN, grátis). VITE_ICE (JSON) troca a lista; '[]' = só a rede local
function iceServers() {
  try { return import.meta.env.VITE_ICE ? JSON.parse(import.meta.env.VITE_ICE) : STUN } catch { return STUN }
}

// caller = quem começa (o celular). signal(m) manda uma mensagem de sinalização pelo servidor; o que chegar do outro lado vai em handle(m).
// onMessage(m) = mensagem que chegou direto · onChange(aberto) = a conexão direta abriu ou fechou. Devolve null sem WebRTC.
export function CreateLink({ caller, signal, onMessage, onChange = () => {} }) {
  if (typeof RTCPeerConnection === 'undefined') return null
  let pc
  try { pc = new RTCPeerConnection({ iceServers: iceServers() }) } catch { return null }
  // canais combinados dos dois lados (mesmo id): não precisam de negociação extra
  const fast = pc.createDataChannel('in', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 })
  const sure = pc.createDataChannel('rel', { negotiated: true, id: 1 })
  let open = false, dead = false, out = 0, last = -1, queue = Promise.resolve()
  const set = (v) => { if (v !== open) { open = v; onChange(v) } }
  const read = (e) => { try { return JSON.parse(e.data) } catch { return null } }
  sure.onopen = () => set(true)
  sure.onclose = () => close()
  sure.onmessage = (e) => { const m = read(e); if (m) onMessage(m) }
  // o rápido pode chegar fora de ordem: número crescente, o atrasado é jogado fora
  fast.onmessage = (e) => { const m = read(e); if (!m || !(m.n > last)) return; last = m.n; delete m.n; onMessage(m) }
  pc.onicecandidate = (e) => { if (e.candidate && !dead) signal({ t: 'ice', c: e.candidate.toJSON() }) }
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') close() }
  const timer = setTimeout(() => { if (!open) close() }, GIVE_UP)
  function close() {
    if (dead) return
    dead = true
    clearTimeout(timer)
    set(false)
    try { pc.close() } catch { /* já fechado */ }
  }
  // a sinalização é feita em ordem (oferta antes dos endereços); erro na oferta/resposta = desiste
  const step = (f) => (queue = queue.then(() => !dead && f()).catch(() => close()))
  if (caller) step(async () => { await pc.setLocalDescription(await pc.createOffer()); signal({ t: 'rtc', sdp: pc.localDescription.toJSON() }) })
  return {
    handle: (m) => step(async () => {
      if (m.t === 'rtc' && m.sdp) {
        await pc.setRemoteDescription(m.sdp)
        if (m.sdp.type === 'offer') { await pc.setLocalDescription(await pc.createAnswer()); signal({ t: 'rtc', sdp: pc.localDescription.toJSON() }) }
      } else if (m.t === 'ice' && m.c) await pc.addIceCandidate(m.c).catch(() => {}) // um endereço ruim não derruba os outros
    }),
    // manda direto (quick = canal rápido); false = sem conexão direta, quem chamou manda pelo servidor
    send(m, quick) {
      if (!open) return false
      try {
        if (!quick) { sure.send(JSON.stringify(m)); return true }
        if (fast.readyState !== 'open') return false
        if (fast.bufferedAmount < 2048) fast.send(JSON.stringify({ ...m, n: ++out })) // rede engasgada: pula este, o próximo vem em 33 ms
        return true
      } catch { return false }
    },
    open: () => open,
    close,
  }
}
