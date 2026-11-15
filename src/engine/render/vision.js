import * as THREE from 'three'

// =====================================================================================
//  Visão noturna: à noite, o que está longe de quem olha e de toda luz fica escuro (sobra um pouco: VISION.floor).
//  Vê-se em volta de cada "olho" (círculo), no cone de cada lanterna e perto das luzes (postes, salas acesas).
//  Barato: as luzes são pintadas num MAPA DE LUZ pequeno, visto de cima (uma imagem por tela, PaintVision), e o shader de
//  TODO MeshLambertMaterial (o protótipo é trocado aqui, uma vez) só consulta essa imagem uma vez por ponto e multiplica a
//  luz recebida. (A 1ª versão somava até 14 luzes em cada ponto da tela: no navegador sem placa de vídeo o quadro quase
//  dobrava de tempo.) O brilho próprio (emissive) e os efeitos (tiros, vidros acesos) não escurecem.
//  Com dark = 0 (dia) o trecho é pulado e o mapa nem é pintado.
// =====================================================================================

const SIZE = 256 // px do mapa de luz
const SPAN = 150 // metros que ele cobre (quadrado em volta do meio da tela; fora dele = escuro)
export const VISION = {
  dark: { value: 0 }, // 0 = nada escurece (dia) · 1 = noite fechada
  floor: { value: 0.15 }, // quanto de luz sobra longe de tudo (0 = preto)
  map: { value: null }, // mapa de luz: R = em volta de quem olha · G = lanternas e faróis · B = postes e casas acesas
  box: { value: new THREE.Vector4(0, 0, 1 / SPAN, 0) }, // (x, z do meio do mapa, 1/tamanho, altura do chão de quem olha)
  warm: { value: new THREE.Vector3(0.32, 0.24, 0.1) }, // tom quente que a lanterna e as luzes somam
}

// uniforms + vis_factor(p): fator que multiplica a cor num ponto do mundo (1 = como de dia).
// vis_beam / vis_glow = quanto o ponto está dentro de uma lanterna / de uma luz de poste ou casa (não sobem até o telhado)
const DECL = `
uniform float uVisDark; uniform float uVisFloor; uniform sampler2D uVisMap; uniform vec4 uVisBox; uniform vec3 uVisWarm;
float vis_beam = 0.0; float vis_glow = 0.0;
float vis_see(vec3 p) {
  vec3 m = texture2D(uVisMap, (p.xz - uVisBox.xy) * uVisBox.z + 0.5).rgb;
  m = m * m * (3.0 - 2.0 * m); // borda macia
  float up = p.y - uVisBox.w;
  vis_beam = m.g * (1.0 - smoothstep(2.6, 4.2, up));
  vis_glow = m.b * (1.0 - smoothstep(3.0, 3.8, up));
  return max(m.r, max(vis_beam, vis_glow));
}
float vis_factor(vec3 p) { return uVisDark > 0.0 ? mix(1.0, mix(uVisFloor, 1.0, vis_see(p)), uVisDark) : 1.0; }
`
// depois das luzes do Lambert: posição no mundo a partir da posição na câmera (sem varying novo)
const APPLY = `
if (uVisDark > 0.0) {
  vec3 vis_w = cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition);
  float vis_k = vis_factor(vis_w);
  reflectedLight.indirectDiffuse += reflectedLight.indirectDiffuse * uVisWarm * (vis_beam * 3.0 + vis_glow * 3.0) * uVisDark;
  reflectedLight.directDiffuse *= vis_k; reflectedLight.indirectDiffuse *= vis_k;
}
`
function bind(sh) {
  sh.uniforms.uVisDark = VISION.dark
  sh.uniforms.uVisFloor = VISION.floor
  sh.uniforms.uVisMap = VISION.map
  sh.uniforms.uVisBox = VISION.box
  sh.uniforms.uVisWarm = VISION.warm
}

// Lambert: chamar dentro de quem já tem onBeforeCompile próprio (ex.: balanço do vento); os outros pegam pelo protótipo
export function VisionShader(sh) {
  bind(sh)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\n${DECL}`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${APPLY}`)
}
// materiais sem luz (ex.: água): declara as funções; o shader chama vis_factor(posição no mundo) onde quiser
export function VisionDecl(sh) {
  bind(sh)
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${DECL}`)
}

// materiais sem luz prontos (MeshBasicMaterial: poças, placas, riscos de vento): de dia iguais; à noite escurecem como o resto do mundo
// e só aparecem perto de quem olha ou de uma luz. night = quanto da cor sobra na noite fechada, mesmo dentro da luz: eles não recebem
// a luz da cena, então sem isso ficavam acesos no escuro (medido: o chão iluminado fica com ~0,16 do brilho do dia)
export function VisionUnlit(sh, night = 0.2) {
  bind(sh)
  sh.uniforms.uVisNight = { value: night }
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vVisW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      vec4 visP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        visP = instanceMatrix * visP;
      #endif
      vVisW = (modelMatrix * visP).xyz;`)
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vVisW; uniform float uVisNight;\n${DECL}`)
    .replace('#include <color_fragment>', '#include <color_fragment>\nif (uVisDark > 0.0) diffuseColor.rgb *= vis_factor(vVisW) * mix(1.0, uVisNight, uVisDark);')
}

THREE.MeshLambertMaterial.prototype.onBeforeCompile = function (sh) { VisionShader(sh) }

// ---------------------------------------------------------------- o mapa de luz (uma imagem por tela, a cada quadro, só à noite)
let ctx = null, tex = null
function init() {
  const c = document.createElement('canvas')
  c.width = c.height = SIZE
  ctx = c.getContext('2d')
  tex = new THREE.CanvasTexture(c)
  tex.flipY = false // linha 0 da imagem = menor z
  tex.generateMipmaps = false
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.colorSpace = THREE.NoColorSpace
  VISION.map.value = tex
}
// mancha redonda: cheia até r0, some em r1 (metros). level 0..1 = força
function blob(x, z, r0, r1, rgb, level = 1) {
  const g = ctx.createRadialGradient(x, z, r0, x, z, r1), v = Math.round(255 * Math.min(1, Math.max(0, level)))
  g.addColorStop(0, `rgb(${rgb[0] * v},${rgb[1] * v},${rgb[2] * v})`)
  g.addColorStop(1, '#000')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, z, r1, 0, Math.PI * 2); ctx.fill()
}
// Pinta o mapa de UMA tela: chamar logo antes de desenhar essa tela (com a tela dividida, uma vez para cada).
//  x, z = meio da tela no mundo · y = altura do chão de quem olha
//  eyes  = [{ x, z, r (círculo em volta), dx, dz (para onde aponta a lanterna), range (0 = apagada), half (meia-abertura, rad) }]
//  glows = [{ x, z, k (0..1: força; pisca-pisca do gerador, poste esquentando) } + r (redonda: poste) ou hw, hd (retângulo: casa acesa)]
export function PaintVision(x, z, y, eyes, glows) {
  if (!ctx) init()
  const k = SIZE / SPAN, half = SPAN / 2
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.setTransform(k, 0, 0, k, (half - x) * k, (half - z) * k) // daqui em diante, desenha em metros do mundo
  ctx.globalCompositeOperation = 'lighten' // cada cor (R, G, B) guarda o maior valor: os três canais não se misturam
  for (const g of glows) {
    const r = g.r ?? Math.max(g.hw, g.hd) + 2
    if (Math.abs(g.x - x) > half + r || Math.abs(g.z - z) > half + r) continue
    if (g.r) { blob(g.x, g.z, g.r * 0.5, g.r, [0, 0, 1], g.k ?? 1); continue }
    // casa acesa: o retângulo da casa com a borda desfocada (um pouco de luz vaza para fora)
    ctx.filter = 'blur(2px)'
    ctx.fillStyle = `rgb(0,0,${Math.round(255 * Math.min(1, Math.max(0, g.k ?? 1)))})`
    ctx.fillRect(g.x - g.hw - 0.4, g.z - g.hd - 0.4, g.hw * 2 + 0.8, g.hd * 2 + 0.8)
    ctx.filter = 'none'
  }
  for (const e of eyes) {
    if (Math.abs(e.x - x) > half + 25 || Math.abs(e.z - z) > half + 25) continue
    blob(e.x, e.z, e.r * 0.45, e.r, [1, 0, 0])
    if (!(e.range > 0)) continue
    // cone da lanterna: cheio até 55% do alcance, some no fim; bordas desfocadas
    const a = Math.atan2(e.dz, e.dx), g = ctx.createRadialGradient(e.x, e.z, e.range * 0.55, e.x, e.z, e.range)
    g.addColorStop(0, '#0f0'); g.addColorStop(1, '#000')
    ctx.fillStyle = g
    ctx.filter = 'blur(1.5px)'
    ctx.beginPath(); ctx.moveTo(e.x, e.z); ctx.arc(e.x, e.z, e.range, a - e.half, a + e.half); ctx.closePath(); ctx.fill()
    ctx.filter = 'none'
  }
  // moldura preta: fora do mapa a imagem repete a borda, que tem de ser escura
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3
  ctx.strokeRect(0, 0, SIZE, SIZE)
  VISION.box.value.set(x, z, 1 / SPAN, y)
  tex.needsUpdate = true
}
