// Entrada do Cloudflare Worker: redireciona todo WebSocket para o Hub (único Durable Object global).
// O Hub mantém as salas na memória enquanto há conexões abertas.
import { Hub } from './hub'

export { Hub }

export default {
  async fetch(request, env) {
    if (request.headers.get('Upgrade') === 'websocket') {
      const id = env.HUB.idFromName('global')
      const hub = env.HUB.get(id)
      return hub.fetch(request)
    }
    return new Response('Paróquia Relay — só aceita WebSocket', { status: 426 })
  }
}
