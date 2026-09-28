# Baixador — Biblioteca de Anúncios (Meta)

Bookmarklet (botão no navegador) que baixa **todas as mídias** de uma pesquisa na
Biblioteca de Anúncios do Meta em **um único ZIP**, com **remoção de repetidos**.
Não depende da API do Meta nem de nenhuma biblioteca externa.

## Arquivos

- **`bookmarklet-source.js`** — código legível/comentado (para ler e editar).
- **`bookmarklet.txt`** — a versão de uma linha (`javascript:...`) para colar num favorito.

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
