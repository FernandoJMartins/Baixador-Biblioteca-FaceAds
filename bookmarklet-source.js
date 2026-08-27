// ==== Baixa TODAS as midias da Biblioteca de Anuncios do Meta em 1 ZIP ====
// ZIP construido na mao (metodo store, sem compressao) pra nao depender de
// biblioteca externa (a CSP do Meta bloqueia CDN).
(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---- Rola a pagina pra forcar carregar tudo (lazy load) ----
  const autoScroll = async () => {
    let ultimaAltura = 0, paradas = 0;
    while (paradas < 3) {
      window.scrollTo(0, document.body.scrollHeight);
      await sleep(1200);
      const altura = document.body.scrollHeight;
      if (altura === ultimaAltura) paradas++; else paradas = 0;
      ultimaAltura = altura;
    }
    window.scrollTo(0, 0);
  };

  const querRolar = confirm(
    "Rolar a pagina automaticamente pra carregar TODOS os anuncios antes de baixar?\n\n" +
    "OK = rola tudo (pode demorar)\nCancelar = usa so o que ja carregou"
  );
  if (querRolar) await autoScroll();

  // ---- Coleta URLs ----
  const urls = new Set();
  document.querySelectorAll("img").forEach(img => {
    const src = img.currentSrc || img.src;
    if (src && /fbcdn|scontent/.test(src) && img.naturalWidth > 120 && img.naturalHeight > 120) {
      urls.add(src);
    }
  });
  const videos = new Set();
  document.querySelectorAll("video").forEach(v => {
    const src = v.currentSrc || v.src;
    if (src && src.startsWith("http")) videos.add(src);
    v.querySelectorAll("source").forEach(s => { if (s.src && s.src.startsWith("http")) videos.add(s.src); });
  });

  const todas = [...urls, ...videos];
  if (todas.length === 0) { alert("Nenhuma midia encontrada. Role a pagina e tente de novo."); return; }
  if (!confirm(`Encontrei ${urls.size} imagem(ns) e ${videos.size} video(s).\n\nBaixar tudo num ZIP?`)) return;

  // ---- CRC32 (tabela) ----
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (bytes) => {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };

  // ---- Baixa cada arquivo como bytes (pulando repetidos) ----
  const arquivos = [];
  const urlsVistas = new Set();   // pre-filtro: mesmo caminho (ignora assinatura ?...)
  const crcsVistos = new Set();   // filtro real: bytes identicos = mesma imagem
  let i = 0, erros = 0, repetidos = 0;
  for (const u of todas) {
    // pre-filtro por caminho da URL, sem os parametros de assinatura
    let chave = u;
    try { const p = new URL(u); chave = p.origin + p.pathname; } catch (e) {}
    if (urlsVistas.has(chave)) { repetidos++; continue; }
    urlsVistas.add(chave);

    try {
      const resp = await fetch(u);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const crc = crc32(buf);
      if (crcsVistos.has(crc)) { repetidos++; continue; } // mesmo conteudo, pula
      crcsVistos.add(crc);
      i++;
      const tipo = resp.headers.get("content-type") || "";
      let ext = (tipo.split("/")[1] || "").split(";")[0];
      if (!ext) ext = u.includes(".mp4") ? "mp4" : "jpg";
      arquivos.push({ nome: `meta_ad_${String(i).padStart(3, "0")}.${ext}`, dados: buf, crc });
    } catch (e) { erros++; console.warn("Falhou:", u, e); }
  }
  if (arquivos.length === 0) { alert("Nao consegui baixar nenhum arquivo."); return; }

  // ---- Monta o ZIP (store / sem compressao) ----
  const enc = new TextEncoder();
  const partes = [];       // pedacos do arquivo final
  const central = [];      // entradas do diretorio central
  let offset = 0;

  const u16 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
  const u32 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
  const push = (arr) => { partes.push(arr); offset += arr.length; };

  for (const f of arquivos) {
    const nomeBytes = enc.encode(f.nome);
    const crc = f.crc;
    const tam = f.dados.length;
    const inicio = offset;

    // Local file header
    push(u32(0x04034b50));
    push(u16(20)); push(u16(0)); push(u16(0));   // versao, flags, metodo(0=store)
    push(u16(0)); push(u16(0));                  // hora, data
    push(u32(crc)); push(u32(tam)); push(u32(tam));
    push(u16(nomeBytes.length)); push(u16(0));
    push(nomeBytes);
    push(f.dados);

    // Central directory record (guarda pra depois)
    const c = [];
    const cpush = a => c.push(a);
    cpush(u32(0x02014b50));
    cpush(u16(20)); cpush(u16(20)); cpush(u16(0)); cpush(u16(0));
    cpush(u16(0)); cpush(u16(0));
    cpush(u32(crc)); cpush(u32(tam)); cpush(u32(tam));
    cpush(u16(nomeBytes.length)); cpush(u16(0)); cpush(u16(0));
    cpush(u16(0)); cpush(u16(0)); cpush(u32(0));
    cpush(u32(inicio));
    cpush(nomeBytes);
    central.push({ bytes: c });
  }

  // Escreve diretorio central
  const inicioCentral = offset;
  for (const c of central) for (const a of c.bytes) push(a);
  const tamCentral = offset - inicioCentral;

  // End of central directory
  push(u32(0x06054b50));
  push(u16(0)); push(u16(0));
  push(u16(arquivos.length)); push(u16(arquivos.length));
  push(u32(tamCentral)); push(u32(inicioCentral));
  push(u16(0));

  const blob = new Blob(partes, { type: "application/zip" });
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = URL.createObjectURL(blob);
  a.download = `meta_ads_${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  alert(`Pronto! ZIP com ${arquivos.length} arquivo(s) unico(s).\nRepetidos ignorados: ${repetidos}. Falhas: ${erros}.\n(Videos "blob:" o navegador nao deixa baixar.)`);
})();
