import * as THREE from 'three'

// =====================================================================================
//  Visão noturna: à noite, o que está longe de quem olha e de toda luz fica escuro (sobra um pouco: VISION.floor).
//  Vê-se em volta de cada "olho" (círculo), no cone de cada lanterna e perto das luzes da lista (postes, salas acesas).
//  Barato: é um trecho no shader de TODO MeshLambertMaterial (o protótipo é trocado aqui, uma vez) que multiplica a
//  luz recebida; o brilho próprio (emissive) e os materiais sem luz (vidros acesos, efeitos) não escurecem.
//  O jogo preenche os números a cada quadro; com dark = 0 (dia) o trecho é pulado.
// =====================================================================================

const EYES = 4, GLOWS = 10
const v4 = (n) => Array.from({ length: n }, () => new THREE.Vector4())
export const VISION = {
  dark: { value: 0 }, // 0 = nada escurece (dia) · 1 = noite fechada
  floor: { value: 0.15 }, // quanto de luz sobra longe de tudo (0 = preto)
  eyes: { value: v4(EYES) }, // (x, z, raio do círculo (0 = sem olho), altura dos pés)
  beams: { value: v4(EYES) }, // lanterna de cada olho: (direção x, direção z, alcance (0 = apagada), cosseno da meia-abertura)
  glows: { value: v4(GLOWS) }, // luzes que deixam ver: (x, z, raio (0 = nenhuma), altura máxima: acima disso, escuro — ex.: o telhado)
  warm: { value: new THREE.Vector3(0.32, 0.24, 0.1) }, // tom quente que a lanterna soma
}
export const VISION_SLOTS = { eyes: EYES, glows: GLOWS }

// uniforms + vis_see(p): 0 (escuro) .. 1 (visto) num ponto do mundo; vis_beam = quanto está dentro de uma lanterna
const DECL = `
uniform float uVisDark; uniform float uVisFloor; uniform vec4 uVisEye[${EYES}]; uniform vec4 uVisBeam[${EYES}]; uniform vec4 uVisGlow[${GLOWS}]; uniform vec3 uVisWarm;
float vis_beam = 0.0;
float vis_see(vec3 p) {
  float see = 0.0; vis_beam = 0.0; vec2 q = p.xz;
  for (int i = 0; i < ${EYES}; i++) {
    if (uVisEye[i].z <= 0.0) continue;
    vec2 d = q - uVisEye[i].xy; float l = length(d);
    see = max(see, 1.0 - smoothstep(uVisEye[i].z * 0.45, uVisEye[i].z, l));
    vec4 b = uVisBeam[i];
    if (b.z > 0.0) {
      float c = dot(d / max(l, 0.001), b.xy);
      float k = smoothstep(b.w, mix(b.w, 1.0, 0.45), c) * (1.0 - smoothstep(b.z * 0.55, b.z, l)) * smoothstep(0.2, 1.2, l)
              * (1.0 - smoothstep(2.6, 4.2, p.y - uVisEye[i].w)); // não sobe até o telhado
      vis_beam = max(vis_beam, k); see = max(see, k);
    }
  }
  for (int i = 0; i < ${GLOWS}; i++) {
    if (uVisGlow[i].z <= 0.0 || p.y > uVisGlow[i].w) continue;
    see = max(see, 1.0 - smoothstep(uVisGlow[i].z * 0.5, uVisGlow[i].z, length(q - uVisGlow[i].xy)));
  }
  return see;
}
// fator que multiplica a cor num ponto do mundo (1 = como de dia)
float vis_factor(vec3 p) { return uVisDark > 0.0 ? mix(1.0, mix(uVisFloor, 1.0, vis_see(p)), uVisDark) : 1.0; }
`
// depois das luzes do Lambert: posição no mundo a partir da posição na câmera (sem varying novo)
const APPLY = `
if (uVisDark > 0.0) {
  vec3 vis_w = cameraPosition + transpose(mat3(viewMatrix)) * (-vViewPosition);
  float vis_k = vis_factor(vis_w);
  reflectedLight.indirectDiffuse += reflectedLight.indirectDiffuse * uVisWarm * vis_beam * uVisDark * 3.0;
  reflectedLight.directDiffuse *= vis_k; reflectedLight.indirectDiffuse *= vis_k;
}
`
function bind(sh) {
  sh.uniforms.uVisDark = VISION.dark
  sh.uniforms.uVisFloor = VISION.floor
  sh.uniforms.uVisEye = VISION.eyes
  sh.uniforms.uVisBeam = VISION.beams
  sh.uniforms.uVisGlow = VISION.glows
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
