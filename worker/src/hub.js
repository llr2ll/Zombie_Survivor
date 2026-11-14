// Durable Object: mantém todas as salas na memória enquanto há WebSockets abertos.
// Hibernação: o DO dorme entre mensagens (nenhuma CPU gasta esperando), acorda só quando chega algo.
const MAX_PLAYERS = 4
const MAX_BYTES = 64 * 1024
const FORWARD = new Set(['in', 'act', 'rtc', 'ice'])
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

function newCode(rooms) {
  let c
  do c = Array.from({ length: 4 }, () => LETTERS[(Math.random() * LETTERS.length) | 0]).join('')
  while (rooms.has(c))
  return c
}

export class Hub {
  constructor(state) {
    this.state = state
    this.rooms = new Map() // código -> { host, players: Map<id, ws>, next }
    this.meta = new Map() // ws -> { role, room, id }
  }

  async fetch(request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket only', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    this.state.acceptWebSocket(server) // hibernação: o DO dorme entre mensagens
    return new Response(null, { status: 101, webSocket: client })
  }

  send(ws, o) {
    try { ws.send(JSON.stringify(o)) } catch { /* conexão já fechada */ }
  }

  async webSocketMessage(ws, raw) {
    if (raw.length > MAX_BYTES) return // mensagem gigante = ignora
    let m
    try { m = JSON.parse(raw) } catch { return }
    const info = this.meta.get(ws) || {}

    if (m.t === 'host') {
      const code = newCode(this.rooms)
      this.rooms.set(code, { host: ws, players: new Map(), next: 1 })
      this.meta.set(ws, { role: 'host', room: code })
      this.send(ws, { t: 'room', code })
    } else if (m.t === 'join' && !info.role) {
      const r = this.rooms.get(String(m.code || '').toUpperCase())
      if (!r) return this.send(ws, { t: 'error', msg: 'Sala não encontrada' })
      if (r.players.size >= MAX_PLAYERS) return this.send(ws, { t: 'error', msg: 'Sala cheia' })
      const id = 'p' + r.next++
      r.players.set(id, ws)
      this.meta.set(ws, { role: 'player', room: String(m.code).toUpperCase(), id })
      this.send(ws, { t: 'joined', id })
      this.send(r.host, { t: 'join', id, name: String(m.name || id).slice(0, 12) })
    } else if (info.role === 'player' && FORWARD.has(m.t)) {
      const r = this.rooms.get(info.room)
      if (r) this.send(r.host, { ...m, id: info.id })
    } else if (info.role === 'host') {
      const r = this.rooms.get(info.room)
      const p = r && r.players.get(m.id)
      if (p) this.send(p, m)
    }
  }

  async webSocketClose(ws) {
    const info = this.meta.get(ws)
    this.meta.delete(ws)
    if (!info) return
    const r = this.rooms.get(info.room)
    if (!r) return
    if (info.role === 'host') {
      r.players.forEach(p => this.send(p, { t: 'closed' }))
      this.rooms.delete(info.room)
    } else if (info.role === 'player') {
      r.players.delete(info.id)
      this.send(r.host, { t: 'leave', id: info.id })
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws)
  }
}
