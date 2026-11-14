// Teste de fumaça: compila o jogo, sobe relay + página em portas próprias (não briga com o npm run dev/server),
// abre num navegador sem tela, entra 1 jogador no teclado (aperta W: entra sozinho; Atirador), 1 celular simulado (conexão
// direta; troca para Bardo no menu), 1 celular sem conexão direta (plano B pelo servidor; troca a classe e é tirado no ✕)
// e 1 controle de videogame de mentira (entra com A, troca a classe no direcional: fica Mago),
// joga ~60 s, abre o menu da partida (Esc) e volta ao menu inicial por votação (teclado + celular).
// FALHA se aparecer erro no console. Capturas e log ficam em smoke/.
// Sem placa de vídeo o jogo roda a 1–2 FPS: 60 s reais ≈ 6 s de jogo. Serve para pegar erro de carregar/iniciar/botões.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'smoke')
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'game-smoke-'))
const VITE = path.join(ROOT, 'node_modules/vite/bin/vite.js')
const WS_PORT = 8099, WEB_PORT = 5199
const WEB = `http://localhost:${WEB_PORT}/`
const PLAY_SECONDS = 60
const GL_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const log = []
const problems = []
const T0 = Date.now()
const note = (s) => { s = `[${Math.round((Date.now() - T0) / 1000)}s] ${s}`; log.push(s); console.log(s) }
const fail = (s) => { problems.push(s); note(`✗ ${s}`) }
const children = []

// roda um processo e espera ele terminar (a compilação)
function run(args, env) {
  return new Promise((ok, no) => {
    const c = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    c.stdout.on('data', (d) => (out += d))
    c.stderr.on('data', (d) => (out += d))
    c.on('exit', (code) => (code === 0 ? ok(out) : no(new Error(`saiu com código ${code}\n${out}`))))
  })
}
// sobe um processo que fica rodando (relay, página) e espera a linha de "pronto"
function serve(args, env, ready) {
  return new Promise((ok, no) => {
    const c = spawn(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(c)
    let out = ''
    const t = setTimeout(() => no(new Error(`não ficou pronto em 30 s\n${out}`)), 30000)
    // espera meio segundo depois do "pronto": o relay avisa a porta antes de descobrir que ela está ocupada
    const read = (d) => { out += d; if (ready.test(out)) { clearTimeout(t); setTimeout(() => ok(c), 500) } }
    c.stdout.on('data', read)
    c.stderr.on('data', read)
    c.on('exit', (code) => { clearTimeout(t); no(new Error(`saiu com código ${code}\n${out}`)) })
  })
}
function stopAll() {
  for (const c of children) if (c.exitCode === null) c.kill()
  fs.rmSync(DIST, { recursive: true, force: true })
}
process.on('SIGINT', () => { stopAll(); process.exit(130) })

// registra tudo o que aparece no console; erro = teste falha
function watch(page, who) {
  page.on('console', (m) => {
    log.push(`[${who} ${m.type()}] ${m.text()}`)
    if (m.type() === 'error') fail(`${who}: erro no console: ${m.text()}`)
  })
  page.on('pageerror', (e) => fail(`${who}: erro na página: ${e.message}`))
}

// controle de mentira: botão (nome do padrão) apertado por um tempo — o jogo sem placa de vídeo lê o controle só 1–2 vezes por segundo
const PAD_BTN = { a: 0, b: 1, x: 2, y: 3, lb: 4, rb: 5, lt: 6, rt: 7, back: 8, start: 9, up: 12, down: 13, left: 14, right: 15 }
const padPress = async (page, name, ms = 1500) => {
  await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: true, value: 1 } }, PAD_BTN[name]); await wait(ms)
  await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: false, value: 0 } }, PAD_BTN[name]); await wait(ms / 2)
}
// segura o botão até o efeito aparecer na tela (o jogo lento pode levar segundos para ler o controle) e solta
const padHold = async (page, name, until, ms = 30000) => {
  await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: true, value: 1 } }, PAD_BTN[name])
  try { await page.waitForFunction(until, null, { timeout: ms }); return true } catch { return false } finally {
    await page.evaluate((i) => { window.__pad.buttons[i] = { pressed: false, value: 0 } }, PAD_BTN[name]); await wait(3000) // o jogo precisa ver o botão solto
  }
}
const padStick = async (page, axes, ms) => { await page.evaluate((a) => { window.__pad.axes = a }, axes); await wait(ms); await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0] }) }

async function play(page, phone) {
  const k = page.keyboard
  const shot = async (name) => { await page.screenshot({ path: path.join(OUT, name), type: 'jpeg', quality: 70 }); note(`   captura ${name}`) }
  const hold = async (keys, ms) => { for (const x of keys) await k.down(x); await wait(ms); for (const x of keys) await k.up(x) }
  const fire = async (n) => { for (let i = 0; i < n; i++) { await page.mouse.down(); await wait(250); await page.mouse.up(); await wait(100) } }
  // celular: arrasta um stick (zona esquerda = mover, direita = mirar/atacar) e solta
  const stick = async (x, y, dx, dy, ms) => { await phone.mouse.move(x, y); await phone.mouse.down(); await phone.mouse.move(x + dx, y + dy, { steps: 4 }); await wait(ms); await phone.mouse.up() }
  const tap = async (sel) => { if (await phone.isVisible(sel)) await phone.click(sel) }

  const t0 = Date.now()
  await page.mouse.move(700, 160)
  await shot('02-inicio.jpg')
  // teclado: andar, correr, atirar, trocar arma, recarregar, granada, empurrar, pular, carro
  await hold(['w'], 2000)
  await hold(['Shift', 'd'], 2000)
  await fire(4)
  for (const key of ['2', 'r', '3', '1', 'q', 'g', 'v', ' ', 'e', 'e']) { await k.press(key); await wait(400) }
  // celular: mover, mirar/atacar, botões da classe, empurrar, pular, correr
  await stick(150, 250, 0, -60, 1500)
  await stick(650, 250, 60, 0, 1500)
  for (const sel of ['#b1', '#b2', '#b3', '#shove', '#jump', '#run', '#run']) { await tap(sel); await wait(300) }
  // controle: anda, mira/ataca, botões da classe, empurrar, pular, usar
  await padStick(page, [0, -1, 0, 0], 1500)
  await padStick(page, [0, 0, 1, 0], 1500)
  for (const b of ['lb', 'rb', 'y', 'b', 'a', 'x']) await padPress(page, b, 800)
  await shot('03-acao.jpg')
  // anoitecer (N = +1 hora)
  for (let i = 0; i < 12; i++) { await k.press('n'); await wait(150) }
  await wait(1500)
  await shot('04-noite.jpg')
  // resto do tempo: anda em volta atirando e empurrando
  const keys = ['a', 's', 'd', 'w']
  for (let i = 0; Date.now() - t0 < PLAY_SECONDS * 1000; i++) {
    await hold([keys[i % 4]], 800)
    await fire(2)
    await k.press('v')
  }
  await shot('05-fim.jpg')
  await phone.screenshot({ path: path.join(OUT, '06-celular.jpg'), type: 'jpeg', quality: 70 })
}

let browser
try {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })

  note('1/4 compilando o jogo…')
  // VITE_ICE '[]': conexão direta só pela rede local (o teste não depende de servidor STUN da internet)
  await run([VITE, 'build', '--outDir', DIST, '--emptyOutDir', '--logLevel', 'warn'], { VITE_WS_URL: `ws://localhost:${WS_PORT}`, VITE_ICE: '[]' })
  note('2/4 subindo relay e página…')
  await serve(['server/server.js'], { PORT: WS_PORT }, /porta/)
  await serve([VITE, 'preview', '--outDir', DIST, '--port', WEB_PORT, '--strictPort'], {}, /localhost/)

  note('3/4 abrindo o jogo no navegador sem tela…')
  browser = await chromium.launch({ args: GL_ARGS })
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } })
  page.setDefaultTimeout(120000) // sem placa de vídeo um quadro pode levar segundos
  watch(page, 'jogo')
  let frames = 0
  await page.exposeFunction('__smokeFps', () => frames++)
  await page.addInitScript(() => addEventListener('fps', () => window.__smokeFps()))
  // controle de videogame "de mentira": o teste aperta botões e mexe os sticks mudando window.__pad
  await page.addInitScript(() => {
    window.__pad = { index: 0, id: 'Controle de teste', connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) }
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [window.__pad, null, null, null] })
  })
  await page.goto(WEB)
  await page.waitForFunction(() => /^[A-Z]{4}$/.test(document.querySelector('#code2')?.textContent || ''), null, { timeout: 60000 })
  const code = await page.textContent('#code2')
  note(`   sala ${code} aberta no relay`)

  // vaga 1 = teclado (Atirador); o celular entra na primeira vaga livre (2 = Samurai)
  // teclado entra sozinho com uma tecla de jogo (vaga 1); o menu não tem mais botões de escolher o aparelho
  await page.keyboard.press('w')
  await page.waitForFunction(() => (document.querySelectorAll('#slots .slot')[0]?.textContent || '').includes('Mouse e teclado'), null, { timeout: 20000 }).catch(() => fail('o teclado não entrou sozinho com W'))
  const phone = await browser.newPage({ viewport: { width: 800, height: 400 }, hasTouch: true })
  phone.setDefaultTimeout(60000)
  watch(phone, 'celular')
  await phone.goto(`${WEB}controller.html?room=${code}`)
  await phone.fill('#name', 'Celular')
  await phone.click('#go')
  await phone.waitForSelector('#pad', { state: 'visible', timeout: 15000 })
  await page.waitForFunction(() => /Celular conectado/.test(document.querySelector('#slots')?.textContent || ''), null, { timeout: 15000 })
  // conexão direta (WebRTC): a vaga na TV e o celular mostram ⚡ direto; daqui em diante os comandos não passam pelo servidor
  const slotHas = (i, t) => new Function(`return (document.querySelectorAll('#slots .slot')[${i}]?.textContent || '').includes(${JSON.stringify(t)})`)
  await page.waitForFunction(slotHas(1, '⚡ direto'), null, { timeout: 20000 }).catch(() => fail('o celular não abriu a conexão direta (ficou pelo servidor)'))
  if (!(await phone.textContent('#link')).includes('direto')) fail('o celular não mostra ⚡ direto')
  // plano B: um 2º celular sem conexão direta (?direto=0) entra pelo servidor, troca a classe e é tirado no ✕
  const phone2 = await browser.newPage({ viewport: { width: 800, height: 400 }, hasTouch: true })
  watch(phone2, 'celular 2')
  await phone2.goto(`${WEB}controller.html?room=${code}&direto=0`)
  await phone2.fill('#name', 'Plano B')
  await phone2.click('#go')
  await page.waitForFunction(slotHas(2, '🌐 servidor'), null, { timeout: 15000 }).catch(() => fail('o 2º celular (sem conexão direta) não entrou pelo servidor'))
  await phone2.waitForSelector('#pick', { state: 'visible', timeout: 30000 })
  await phone2.dispatchEvent('#next', 'pointerdown') // toque direto: o navegador sem placa de vídeo é lento para o clique "parado"
  await page.waitForFunction(slotHas(2, 'Bardo'), null, { timeout: 15000 }).catch(() => fail('o 2º celular não trocou a classe pelo servidor'))
  await page.click('#slots .slot:nth-child(3) button.x')
  await phone2.waitForFunction(() => /removido/.test(document.querySelector('#state')?.textContent || ''), null, { timeout: 15000 }).catch(() => fail('o 2º celular não recebeu o aviso de removido'))
  await phone2.close()
  // escolha de classe: teclado D e A (volta ao Atirador); celular ▶ duas vezes (Samurai → Mago → Bardo)
  await page.keyboard.press('d'); await page.keyboard.press('a')
  await phone.waitForSelector('#pick', { state: 'visible', timeout: 15000 })
  for (let i = 0; i < 2; i++) { await phone.click('#next'); await wait(400) }
  await page.waitForFunction(() => (document.querySelector('#slots')?.textContent || '').includes('Bardo'), null, { timeout: 15000 }).catch(() => fail('o celular não conseguiu trocar a classe no menu'))
  // controle de mentira: A entra (vaga 3, Mago); ▶ troca para Bardo e ◀ volta ao Mago
  const slot3 = () => page.evaluate(() => document.querySelectorAll('#slots .slot')[2]?.textContent || '')
  const slot3has = (t) => new Function(`return (document.querySelectorAll('#slots .slot')[2]?.textContent || '').includes(${JSON.stringify(t)})`)
  if (!(await padHold(page, 'a', slot3has('Controle')))) fail('o controle não entrou no menu com A')
  if (!(await padHold(page, 'right', slot3has('Bardo'), 20000))) fail(`o direcional do controle não trocou a classe: ${(await slot3()).replace(/\s+/g, ' ').slice(0, 80)}`)
  if (!(await padHold(page, 'left', slot3has('Mago'), 20000))) fail('o direcional do controle não voltou a classe')
  await page.screenshot({ path: path.join(OUT, '01-lobby.jpg'), type: 'jpeg', quality: 70 })

  note(`4/4 jogando ${PLAY_SECONDS} s…`)
  await page.click('#start')
  await page.waitForFunction(() => document.querySelectorAll('#plist .pl').length === 3, null, { timeout: 30000 })
  const cls = await page.textContent('#plist')
  if (!cls.includes('🔫 Jogador 1') || !cls.includes('🪕 Celular') || !cls.includes('🔮 Controle')) fail(`classes erradas na partida: ${cls.replace(/\s+/g, ' ').slice(0, 160)}`)
  await play(page, phone)

  const hud = await page.evaluate(() => ({ topo: document.querySelector('#top')?.innerText, jogadores: document.querySelector('#plist')?.innerText }))
  note(`   HUD: ${JSON.stringify(hud)}`)
  if (frames < 3) fail(`o jogo quase não desenhou quadros (${frames} medições de FPS)`)
  // Esc abre o menu da partida (pausa para todos; o celular mostra "Pausado"). "Voltar ao menu inicial" abre a votação:
  // o teclado pediu (conta como sim) e o celular vota SIM → 2 de 3 (maioria) → volta ao menu inicial
  await page.keyboard.press('Escape')
  await page.waitForSelector('#pause:not(.hidden)', { timeout: 20000 }).catch(() => fail('Esc não abriu o menu da partida'))
  await phone.waitForSelector('#menu-ui', { state: 'visible', timeout: 20000 }).catch(() => fail('o celular não mostrou a pausa'))
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(OUT, '07-menu.jpg'), type: 'jpeg', quality: 70 })
  await page.click('#pause .quit')
  await phone.waitForFunction(() => /SIM/.test(document.querySelector('#mu-a')?.textContent || ''), null, { timeout: 20000 }).catch(() => fail('o celular não recebeu a votação'))
  await page.screenshot({ path: path.join(OUT, '08-votacao.jpg'), type: 'jpeg', quality: 70 })
  await phone.screenshot({ path: path.join(OUT, '09-votacao-celular.jpg'), type: 'jpeg', quality: 70 })
  await phone.dispatchEvent('#mu-a', 'pointerdown')
  await page.waitForFunction(() => !document.querySelector('#lobby').classList.contains('hidden'), null, { timeout: 20000 }).catch(() => fail('a votação não voltou ao menu'))
} catch (e) {
  fail(`o teste parou: ${e.message.split('\n')[0]}`)
  log.push(e.stack || String(e))
} finally {
  if (browser) await browser.close()
  stopAll()
}

log.push('', problems.length ? `FALHOU (${problems.length} problema(s))` : 'PASSOU')
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n') + '\n')
if (problems.length) {
  console.log(`\n✗ FALHOU: ${problems.length} problema(s). Detalhes em smoke/log.txt`)
  process.exitCode = 1
} else console.log('\n✓ PASSOU: nenhum erro no console. Capturas em smoke/')
