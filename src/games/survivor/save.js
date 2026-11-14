import { BALANCE } from './config/balance'

// Save local (J12a): o progresso é do PC (a "casa"), não dos celulares (eles entram sem conta). No navegador fica no
// localStorage; sem ele (testes no Node, navegador bloqueando) fica só na memória e a partida segue normal.
// Guarda: XP e nível da paróquia, achados da coleção, partidas e vitórias (e os cercos vencidos, para o J12b).
const KEY = 'paroquia-save-v1'
const A = BALANCE.account
const blank = () => ({ versao: 1, xp: 0, nivel: 1, achados: [], cercos: [], partidas: 0, vitorias: 0 })
const need = (n) => A.need[Math.min(n - 1, A.need.length - 1)] // XP para sair do nível n

function read() {
  try {
    const s = globalThis.localStorage && localStorage.getItem(KEY)
    return s ? { ...blank(), ...JSON.parse(s) } : blank()
  } catch { return blank() }
}
function write(d) {
  try { if (globalThis.localStorage) localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* sem espaço ou bloqueado: segue sem salvar */ }
}

export function CreateSave() {
  let d = read()
  return {
    get data() { return d },
    // fim de partida: soma o XP (sobe quantos níveis der) e conta a partida. Devolve { gained, from, to }
    match(xp, win) {
      const from = d.nivel
      d.xp += Math.max(0, Math.round(xp))
      while (d.xp >= need(d.nivel)) { d.xp -= need(d.nivel); d.nivel++ }
      d.partidas++
      if (win) d.vitorias++
      write(d)
      return { gained: Math.round(xp), from, to: d.nivel }
    },
    // achado novo para a coleção (true = ainda não tinha)
    found(id) {
      if (d.achados.includes(id)) return false
      d.achados.push(id)
      write(d)
      return true
    },
    // venceu o cerco n: guarda e devolve true se é a 1ª vez (libera o próximo)
    win(n) {
      if (d.cercos.includes(n)) return false
      d.cercos.push(n)
      write(d)
      return true
    },
    open: (total) => Math.min(total, Math.max(0, ...d.cercos) + 1), // maior cerco liberado (o 1º sempre)
    progress: () => d.xp / need(d.nivel), // fração até o próximo nível
    reset() { d = blank(); write(d) },
  }
}
