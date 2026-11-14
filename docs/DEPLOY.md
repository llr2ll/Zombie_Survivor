# Como colocar o jogo no ar (de graça)

Você precisa fazer isso uma vez. Depois, qualquer atualização do código sobe automaticamente pelo GitHub.

Precisa de duas contas gratuitas:
- **Cloudflare** — fica com o servidor de salas (o "apresentador")
- **Netlify** (ou Cloudflare Pages) — fica com o site do jogo

---

## 1. Servidor de salas na Cloudflare (5 min)

O servidor só serve para apresentar o PC e o celular na entrada da sala. Depois disso, os dois conversam direto sem passar por ele.

### Criar conta e instalar o Wrangler

1. Crie uma conta gratuita em [cloudflare.com](https://cloudflare.com)
2. No terminal do Codespaces:
   ```bash
   cd worker
   npm install
   npx wrangler login   # abre o navegador para você entrar na sua conta
   ```

### Publicar o servidor

```bash
npx wrangler deploy
```

Vai aparecer algo como:
```
Published paroquia-relay (...)
  https://paroquia-relay.SEU_USUARIO.workers.dev
```

Copie esse endereço — você vai precisar dele no passo 2.

### Testar

Abra o jogo normalmente no Codespaces (`npm run dev`). Por enquanto ele ainda usa o servidor local — o Worker só entra depois que você configurar o site no ar.

---

## 2. Site do jogo na Netlify (10 min)

### Criar conta e conectar ao GitHub

1. Crie uma conta gratuita em [netlify.com](https://netlify.com)
2. Clique em **Add new site → Import an existing project**
3. Escolha **GitHub** e autorize
4. Selecione o repositório `llr2ll/Zombie_Survivor`

### Configurar o build

| Campo | Valor |
|-------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |

### Adicionar a variável de ambiente

Ainda nas configurações do site, vá em **Environment variables** e adicione:

| Nome | Valor |
|------|-------|
| `VITE_WS_URL` | `wss://paroquia-relay.SEU_USUARIO.workers.dev` |

(troque `SEU_USUARIO` pelo seu usuário da Cloudflare)

Clique em **Deploy site**. Em 1–2 minutos o jogo estará no ar.

---

## 3. Depois do deploy

- Qualquer `git push` na branch `main` atualiza o site automaticamente (Netlify faz o build sozinho).
- O Worker não precisa de atualização a menos que a lógica do servidor mude.
- O Codespaces continua funcionando com `npm run server` como sempre.

---

## Limites gratuitos (mais do que suficiente)

| Serviço | Limite grátis |
|---------|--------------|
| Cloudflare Worker | 100.000 salas/dia |
| Cloudflare Durable Objects | 400.000 s de CPU/mês (o Worker dorme entre mensagens) |
| Netlify | 100 GB de banda/mês, 300 minutos de build |

Para uma demo ou jogo pequeno, esses limites nunca vão ser atingidos.

---

## Se a Cloudflare bloquear jogadores no mesmo Wi-Fi

Redes de empresa ou escola às vezes bloqueiam WebRTC. Nesse caso, o jogo cai automaticamente para o plano B (todos os comandos passam pelo servidor). Funciona igual, só um pouco mais lento.

Se quiser suporte total a redes bloqueadas, a Cloudflare tem um servidor TURN gratuito (1.000 GB/mês). Me peça e eu configuro.
