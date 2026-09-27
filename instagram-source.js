// ==== Baixa TODOS os posts (fotos/videos) + destaques de um perfil do Insta em 1 ZIP ====
// Roda em instagram.com JA LOGADO. Usa a API web interna (mesma origem, seus
// cookies) pra pegar tudo na maior qualidade. ZIP montado na mao (store), sem
// depender de CDN externa (a CSP do Insta bloqueia).
(async () => {
  const APP_ID = "936619743392459";           // id do app web do Instagram
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // Chama a API. Trata rate limit: 429, OU 200 devolvendo HTML (bloqueio
  // disfarcado) -> espera e tenta de novo (backoff). So devolve se vier JSON.
  const api = async (url, tentativas = 5) => {
    for (let t = 0; t < tentativas; t++) {
      const r = await fetch(url, {
        headers: { "x-ig-app-id": APP_ID, "x-requested-with": "XMLHttpRequest" },
        credentials: "include",
      });
      if (r.status === 429) { await sleep((t + 1) * 8000); continue; }  // 8s,16s,24s...
      const txt = await r.text();
      let j;
      try { j = JSON.parse(txt); }
      catch (e) { await sleep((t + 1) * 8000); continue; }             // veio HTML = bloqueio
      if (!r.ok) throw new Error("HTTP " + r.status + " em " + url);
      return j;
    }
    throw new Error("O Instagram esta limitando as chamadas (429 ou resposta HTML) em:\n" + url +
      "\n\nEspere bastante (30-60 min) sem ficar tentando, e rode de novo.");
  };
  // Tenta achar o id do usuario no HTML da propria pagina (evita chamada de API).
  const idDaPagina = (u) => {
    const html = document.documentElement.innerHTML;
    let m = html.match(/"profilePage_(\d+)"/);
    if (m) return m[1];
    const nome = u.replace(/[^A-Za-z0-9_.]/g, "");
    m = html.match(new RegExp('"id":"(\\d+)","username":"' + nome + '"')) ||
        html.match(new RegExp('"username":"' + nome + '"[^}]*?"id":"(\\d+)"')) ||
        html.match(new RegExp('"pk":"?(\\d+)"?[^}]*?"username":"' + nome + '"'));
    return m ? m[1] : "";
  };

  // ---- Descobre o @usuario (pela URL, ou pergunta) ----
  let user = (location.pathname.split("/").filter(Boolean)[0] || "").replace(/^@/, "");
  const reservadas = new Set(["", "explore", "reels", "direct", "stories", "accounts", "p"]);
  if (reservadas.has(user)) {
    user = (prompt("Nome de usuario do perfil (sem @):", "") || "").trim().replace(/^@/, "");
  }
  if (!user) { alert("Perfil nao identificado. Abra a pagina do perfil e tente de novo."); return; }

  // ---- Pega o id do usuario (1o da propria pagina, senao pela API) ----
  let userId = idDaPagina(user);
  if (!userId) {
    try {
      const info = await api(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(user)}`);
      const u = info.data.user;
      userId = u.id;
      if (u.is_private && !u.followed_by_viewer) {
        if (!confirm(`@${user} e privado e voce nao segue. Provavelmente nao vai baixar nada.\nContinuar mesmo assim?`)) return;
      }
    } catch (e) {
      alert("Nao consegui achar @" + user + ".\nVoce esta logado? O perfil existe?\n\n" + e.message +
        "\n\nDica: abra a pagina do proprio perfil (instagram.com/" + user + ") antes de clicar. Se for 429, espere uns minutos.");
      return;
    }
  }

  // ---- Helpers: escolhe a MAIOR resolucao de cada midia ----
  const melhorImg = m => {
    const c = (m.image_versions2 && m.image_versions2.candidates) || [];
    const best = c.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    return best && best.url;
  };
  const melhorVideo = m => {
    const v = m.video_versions || [];
    const best = v.slice().sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
    return best && best.url;
  };
  // Um "media" pode ser foto, video ou carrossel -> devolve lista de URLs
  const urlsDeMidia = (m) => {
    const out = [];
    const sub = m.carousel_media || [m];
    for (const s of sub) {
      const vid = melhorVideo(s);
      if (vid) out.push(vid); else { const img = melhorImg(s); if (img) out.push(img); }
    }
    return out;
  };

  const alvos = [];   // { url, tag }  (tag entra no nome do arquivo)

  // ---- Posts do feed (paginado) ----
  let maxId = "", pagina = 0, totalPosts = 0;
  do {
    const url = `/api/v1/feed/user/${userId}/?count=33` + (maxId ? `&max_id=${maxId}` : "");
    let data;
    try {
      data = await api(url);
    } catch (e) {
      if (pagina === 0) { alert("Nao consegui ler os posts.\n\n" + e.message); return; }
      console.warn("Falha ao paginar posts (para aqui e usa o que ja tem):", e);
      break;
    }
    for (const it of (data.items || [])) {
      for (const u of urlsDeMidia(it)) { alvos.push({ url: u, tag: "post" }); totalPosts++; }
    }
    maxId = data.more_available ? data.next_max_id : "";
    pagina++;
    await sleep(600);   // respiro pra nao tomar rate limit
  } while (maxId && pagina < 200);

  // ---- Destaques (highlights) ----
  let totalDest = 0;
  try {
    const tray = await api(`/api/v1/highlights/${userId}/highlights_tray/`);
    const reels = (tray.tray || []).map(t => t.id).filter(Boolean);   // "highlight:123..."
    for (let k = 0; k < reels.length; k += 4) {                        // busca em lotes de 4
      const lote = reels.slice(k, k + 4);
      const qs = lote.map(id => `reel_ids=${encodeURIComponent(id)}`).join("&");
      let media;
      try { media = await api(`/api/v1/feed/reels_media/?${qs}`); }
      catch (e) { console.warn("Falha em lote de destaques:", e); continue; }
      const mp = media.reels || {};
      for (const id of lote) {
        const reel = mp[id];
        if (!reel) continue;
        for (const it of (reel.items || [])) {
          for (const u of urlsDeMidia(it)) { alvos.push({ url: u, tag: "destaque" }); totalDest++; }
        }
      }
      await sleep(600);
    }
  } catch (e) { console.warn("Nao consegui ler destaques:", e); }

  if (alvos.length === 0) { alert("Nada encontrado pra baixar (perfil vazio, privado ou sem acesso)."); return; }
  if (!confirm(`@${user}: ${totalPosts} midia(s) de posts + ${totalDest} de destaques.\n\nBaixar tudo num ZIP? (arquivos repetidos sao ignorados)`)) return;

  // ---- CRC32 (tabela) ----
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (bytes) => { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  // ---- Baixa cada arquivo (pulando repetidos por caminho e por bytes) ----
  const arquivos = [];
  const urlsVistas = new Set();
  const crcsVistos = new Set();
  let i = 0, erros = 0, repetidos = 0;
  for (const alvo of alvos) {
    const u = alvo.url;
    let chave = u;
    try { const p = new URL(u); chave = p.origin + p.pathname; } catch (e) {}
    if (urlsVistas.has(chave)) { repetidos++; continue; }
    urlsVistas.add(chave);
    try {
      const resp = await fetch(u);
      const buf = new Uint8Array(await resp.arrayBuffer());
      const crc = crc32(buf);
      if (crcsVistos.has(crc)) { repetidos++; continue; }
      crcsVistos.add(crc);
      i++;
      const tipo = resp.headers.get("content-type") || "";
      let ext = (tipo.split("/")[1] || "").split(";")[0];
      if (!ext) ext = /\.mp4/.test(u) ? "mp4" : "jpg";
      if (ext === "quicktime") ext = "mov";
      arquivos.push({ nome: `${user}_${alvo.tag}_${String(i).padStart(3, "0")}.${ext}`, dados: buf, crc });
    } catch (e) { erros++; console.warn("Falhou:", u, e); }
  }
  if (arquivos.length === 0) { alert("Nao consegui baixar nenhum arquivo (a CDN pode ter bloqueado o acesso)."); return; }

  // ---- Monta o ZIP (store / sem compressao) ----
  const enc = new TextEncoder();
  const partes = [], central = [];
  let offset = 0;
  const u16 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF]);
  const u32 = n => new Uint8Array([n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]);
  const push = (arr) => { partes.push(arr); offset += arr.length; };

  for (const f of arquivos) {
    const nomeBytes = enc.encode(f.nome);
    const crc = f.crc, tam = f.dados.length, inicio = offset;
    // Local file header
    push(u32(0x04034b50));
    push(u16(20)); push(u16(0)); push(u16(0));
    push(u16(0)); push(u16(0));
    push(u32(crc)); push(u32(tam)); push(u32(tam));
    push(u16(nomeBytes.length)); push(u16(0));
    push(nomeBytes); push(f.dados);
    // Central directory record
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
  const inicioCentral = offset;
  for (const c of central) for (const a of c.bytes) push(a);
  const tamCentral = offset - inicioCentral;
  push(u32(0x06054b50));
  push(u16(0)); push(u16(0));
  push(u16(arquivos.length)); push(u16(arquivos.length));
  push(u32(tamCentral)); push(u32(inicioCentral));
  push(u16(0));

  const blob = new Blob(partes, { type: "application/zip" });
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = URL.createObjectURL(blob);
  a.download = `instagram_${user}_${stamp}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  alert(`Pronto! ZIP de @${user} com ${arquivos.length} arquivo(s) unico(s).\nRepetidos ignorados: ${repetidos}. Falhas: ${erros}.`);
})();
