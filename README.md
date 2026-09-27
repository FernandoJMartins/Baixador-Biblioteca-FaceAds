# Baixadores de mídia (Meta & Instagram)

Dois bookmarklets (botões no navegador) que baixam mídias em **um único ZIP**, na
**maior qualidade possível**, com **remoção de repetidos**. Não dependem de
bibliotecas externas nem de APIs pagas.

## Arquivos

**Biblioteca de Anúncios do Meta:**
- **`bookmarklet-source.js`** — código legível/comentado.
- **`bookmarklet.txt`** — versão de uma linha (`javascript:...`) para colar num favorito.

**Perfil do Instagram (posts + destaques):**
- **`instagram-source.js`** — código legível/comentado.
- **`instagram.txt`** — versão de uma linha (`javascript:...`) para colar num favorito.

---

# 1) Biblioteca de Anúncios (Meta)

Baixa **todas as mídias** de uma pesquisa na Biblioteca de Anúncios do Meta.

## Como instalar (Chrome / Edge)

1. Mostre a barra de favoritos: `Ctrl+Shift+B`.
2. Botão direito na barra → **Adicionar página…**
3. Preencha:
   - **Nome:** `Baixar Ads Meta`
   - **URL:** abra `bookmarklet.txt`, selecione tudo (`Ctrl+A`), copie (`Ctrl+C`) e cole aqui.
4. Salvar.

## Como usar

1. Abra a Biblioteca de Anúncios e faça a pesquisa desejada.
2. Clique no favorito.
3. Confirme se quer rolar a página automaticamente (carrega todos os anúncios).
4. Ele baixa um ZIP `meta_ads_<data>.zip` na pasta de Downloads.

## O que ele faz por dentro

- Rola a página para forçar o carregamento (lazy load) de todos os anúncios.
- Coleta as imagens (`fbcdn`/`scontent`).
- **Vídeos em alta resolução:** extrai a URL `video_hd_url` do JSON da própria página
  (o player usa a SD/360p por padrão; a HD só aparece nesse JSON). Só usa a SD
  (`video_sd_url`) como fallback quando não existe HD para aquele vídeo.
- **Ignora repetidos** por dois filtros: caminho da URL (sem a assinatura `?...`)
  e conteúdo idêntico (hash CRC32 dos bytes).
- Monta o ZIP na mão (método *store*, sem recompressão) para não depender de CDN
  (a CSP do Meta bloqueia scripts externos).

## Limitações

- Ele busca a versão HD no JSON da página. Se o Meta não expuser `video_hd_url`
  para um vídeo, cai para a SD disponível.
- **Vídeos `blob:`** não podem ser baixados por bookmarklet (restrição do navegador).
- A remoção de duplicados é por **bytes idênticos**. O mesmo criativo em
  **resoluções diferentes** conta como arquivos distintos.
- Não faz upscale das imagens (mantém o tamanho original servido pelo Meta).

---

# 2) Perfil do Instagram (posts + destaques)

Baixa **todas as fotos e vídeos** dos posts de um perfil **mais os destaques
(highlights)**, sempre na **maior resolução** que o Instagram serve.

## Como instalar

Igual ao do Meta, mas usando o arquivo **`instagram.txt`**:
- **Nome:** `Baixar Insta`
- **URL:** conteúdo de `instagram.txt` (`Ctrl+A`, `Ctrl+C`, colar).

## Como usar

1. **Esteja logado** no Instagram (o bookmarklet usa a sua sessão).
2. Abra a página do perfil que quer baixar (ex.: `instagram.com/usuario`).
3. Clique no favorito. Se não estiver na página de um perfil, ele pergunta o `@`.
4. Confirme e aguarde — ele baixa `instagram_<usuario>_<data>.zip`.

Os arquivos são nomeados `usuario_post_NNN.ext` e `usuario_destaque_NNN.ext`.

## O que ele faz por dentro

- Descobre o **id do usuário** via API web (`/api/v1/users/web_profile_info/`).
- Baixa **todos os posts** paginando o feed (`/api/v1/feed/user/`), incluindo
  cada item dos **carrosséis**.
- Baixa os **destaques** (`/highlights_tray/` + `/feed/reels_media/`).
- Para cada mídia escolhe a **maior resolução** (`image_versions2` /
  `video_versions`), ignora repetidos (caminho + hash CRC32) e monta o ZIP na mão.

## Limitações

- **Precisa estar logado.** Perfis **privados** só funcionam se você **seguir**.
- Usa a API interna do Instagram — se eles mudarem os endpoints, pode parar de
  funcionar (é a natureza de bookmarklet, sem API oficial).
- Perfis muito grandes podem levar um tempo e, em excesso, esbarrar em **rate
  limit** do Instagram (há pausas entre as chamadas pra reduzir isso).
- **Stories atuais** (que não viraram destaque) não são baixados — só posts e
  destaques.
