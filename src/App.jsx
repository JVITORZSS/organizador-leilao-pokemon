
import { useEffect, useMemo, useRef, useState } from "react";
import jsPDF from "jspdf";
import "./App.css";

const STORAGE_KEY = "organizador-leilao-pokemon";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const criarCarta = () => ({
  id: uid(),
  nome: "",
  valor: "",
  comprador: "",
});

const normalizarNome = (nome) =>
  String(nome || "").trim().toLocaleLowerCase("pt-BR");

const moeda = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function numeroValor(valor) {
  if (valor === "" || valor == null) return 0;

  const texto = String(valor).trim().replace(/\s/g, "");
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}

function formatarValorInput(valor) {
  return valor == null ? "" : String(valor);
}

function carregarCartas() {
  try {
    const dados = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");

    if (!Array.isArray(dados) || !dados.length) {
      return [criarCarta()];
    }

    // Compatibilidade com a versão antiga.
    if (dados[0]?.cartas && Array.isArray(dados[0].cartas)) {
      const cartas = [];

      dados.forEach((pessoa) =>
        (pessoa.cartas || []).forEach((carta) =>
          cartas.push({
            id: carta.id || uid(),
            nome: carta.nome || "",
            valor: carta.valor ?? "",
            comprador: pessoa.nome || "",
          })
        )
      );

      return cartas.length ? cartas : [criarCarta()];
    }

    return dados.map((c) => ({
      id: c.id || uid(),
      nome: c.nome || "",
      valor: c.valor ?? "",
      comprador: c.comprador || c.arrematante || "",
    }));
  } catch {
    return [criarCarta()];
  }
}

// Desenho original da Pokébola: preservado.
function desenharPokebola(pdf, x, y, raio = 7) {
  const escala = 4;
  const tamanho = Math.ceil(raio * 2 * escala + 8 * escala);
  const canvas = document.createElement("canvas");

  canvas.width = tamanho;
  canvas.height = tamanho;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const centro = tamanho / 2;
  const r = raio * escala;

  ctx.clearRect(0, 0, tamanho, tamanho);

  // Parte vermelha
  ctx.beginPath();
  ctx.arc(centro, centro, r, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = "#ef4444";
  ctx.fill();

  // Parte branca
  ctx.beginPath();
  ctx.arc(centro, centro, r, 0, Math.PI);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  // Linha central
  ctx.beginPath();
  ctx.moveTo(centro - r, centro);
  ctx.lineTo(centro + r, centro);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5 * escala;
  ctx.stroke();

  // Círculo central
  ctx.beginPath();
  ctx.arc(centro, centro, r * 0.27, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(centro, centro, r * 0.27, 0, Math.PI * 2);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5 * escala;
  ctx.stroke();

  // Contorno
  ctx.beginPath();
  ctx.arc(centro, centro, r, 0, Math.PI * 2);
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5 * escala;
  ctx.stroke();

  const imagem = canvas.toDataURL("image/png");
  pdf.addImage(imagem, "PNG", x - raio, y - raio, raio * 2, raio * 2);
}

function App() {
  const [cartas, setCartas] = useState(carregarCartas);
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("entrada");
  const [salvo, setSalvo] = useState(true);
  const [sugestaoAberta, setSugestaoAberta] = useState(null);

  const nomeRefs = useRef({});
  const valorRefs = useRef({});
  const compradorRefs = useRef({});

  const compradores = useMemo(() => {
    const porNome = new Map();
    let proximo = 1;

    cartas.forEach((carta) => {
      const nome = String(carta.comprador || "").trim();
      const chave = normalizarNome(nome);

      if (!chave || /^\d+$/.test(nome)) return;

      if (!porNome.has(chave)) {
        porNome.set(chave, {
          token: proximo++,
          nome,
          total: 0,
          quantidade: 0,
        });
      }

      const comprador = porNome.get(chave);
      comprador.total += numeroValor(carta.valor);

      if (carta.nome.trim() || carta.valor !== "") {
        comprador.quantidade++;
      }
    });

    return [...porNome.values()];
  }, [cartas]);

  const tokenPorNome = useMemo(
    () => new Map(compradores.map((c) => [normalizarNome(c.nome), c.token])),
    [compradores]
  );

  const compradorPorToken = useMemo(
    () => new Map(compradores.map((c) => [String(c.token), c.nome])),
    [compradores]
  );

  const obterToken = (nome) => {
    const texto = String(nome || "").trim();

    if (/^\d+$/.test(texto)) return Number(texto);

    return tokenPorNome.get(normalizarNome(texto)) || null;
  };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cartas));
      setSalvo(true);
    } catch {
      setSalvo(false);
    }
  }, [cartas]);

  function atualizarCarta(id, campo, valor) {
    let novoValor = valor;

    if (campo === "valor") {
      novoValor = String(valor)
        .replace(/[^\d,.]/g, "")
        .replace(/\./g, ",");

      const partes = novoValor.split(",");

      if (partes.length > 2) {
        novoValor = `${partes[0]},${partes.slice(1).join("")}`;
      }

      if (partes[1]?.length > 2) {
        novoValor = `${partes[0]},${partes[1].slice(0, 2)}`;
      }
    }

    setCartas((atual) =>
      atual.map((c) =>
        c.id === id ? { ...c, [campo]: novoValor } : c
      )
    );
  }

  function adicionarCarta() {
    const nova = criarCarta();

    setCartas((atual) => [...atual, nova]);

    setTimeout(() => {
      nomeRefs.current[nova.id]?.focus();
    }, 50);
  }

  function removerCarta(id) {
    if (cartas.length === 1) {
      setCartas([criarCarta()]);
      return;
    }

    setCartas((atual) => atual.filter((c) => c.id !== id));
  }

  function limparLeilao() {
    if (
      !window.confirm(
        "Deseja realmente limpar todo o leilão? Essa ação não pode ser desfeita."
      )
    ) {
      return;
    }

    const primeira = criarCarta();

    setCartas([primeira]);
    setBusca("");
    setOrdenacao("entrada");

    setTimeout(() => {
      nomeRefs.current[primeira.id]?.focus();
    }, 50);
  }

  function completarComprador(cartaId, nome) {
    atualizarCarta(cartaId, "comprador", nome);
    setSugestaoAberta(null);
  }

  function resolverTokenComprador(cartaId) {
    const carta = cartas.find((item) => item.id === cartaId);
    const texto = String(carta?.comprador || "").trim();

    if (/^\d+$/.test(texto) && compradorPorToken.has(texto)) {
      atualizarCarta(
        cartaId,
        "comprador",
        compradorPorToken.get(texto)
      );
    }

    setSugestaoAberta((atual) =>
      atual === cartaId ? null : atual
    );
  }

  // Corrigido: Enter no comprador navega para a próxima carta
  // visível. Só cria outra linha quando não existe próxima carta.
  function avancarDoComprador(cartaId, indiceExibido, listaExibida) {
    resolverTokenComprador(cartaId);

    const proximaCarta = listaExibida[indiceExibido + 1];

    if (proximaCarta) {
      setTimeout(() => {
        nomeRefs.current[proximaCarta.id]?.focus();
      }, 50);
    } else {
      adicionarCarta();
    }
  }

  function gerarPDF() {
    const preenchidas = cartas.filter(
      (c) =>
        c.nome.trim() ||
        c.valor !== "" ||
        String(c.comprador).trim()
    );

    if (!preenchidas.length) {
      window.alert("Adicione pelo menos uma carta antes de gerar o PDF.");
      return;
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const largura = pdf.internal.pageSize.getWidth();
    const altura = pdf.internal.pageSize.getHeight();
    const margem = 18;
    const larguraConteudo = largura - margem * 2;
    let y = 40;

    function cabecalho() {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(0, 0, largura, 34, "F");

      pdf.setFillColor(5, 15, 38);
      pdf.setDrawColor(5, 15, 38);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(10, 5, largura - 20, 24, 3, 3, "FD");

      // Mantém o desenho original da Pokébola.
      desenharPokebola(pdf, 21, 17, 7);

      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("ORGANIZADOR DE LEILÃO", 34, 15.5);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(203, 213, 225);
      pdf.text("Pokémon · Registro dos arremates", 34, 22.5);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(
        `DATA DO LEILÃO  ${new Date().toLocaleDateString("pt-BR")}`,
        largura - 15,
        18,
        { align: "right" }
      );
    }

    function novaPagina() {
      pdf.addPage();
      cabecalho();
      y = 40;
    }

    function rodape() {
      const totalPaginas = pdf.getNumberOfPages();

      for (let i = 1; i <= totalPaginas; i++) {
        pdf.setPage(i);
        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.3);
        pdf.line(margem, altura - 16, largura - margem, altura - 16);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(100, 116, 139);

        pdf.text("Organizador de Leilão Pokémon", margem, altura - 9);
        pdf.text(
          `Página ${i} de ${totalPaginas}`,
          largura - margem,
          altura - 9,
          { align: "right" }
        );
      }
    }

    cabecalho();
    y = 40;

    const grupos = new Map();

    preenchidas.forEach((carta) => {
      const nome = String(carta.comprador || "").trim();
      const chave = normalizarNome(nome);

      const nomeGrupo = nome
        ? /^\d+$/.test(nome)
          ? compradorPorToken.get(nome) || `Comprador ${nome}`
          : nome
        : "Sem arrematante informado";

      const token = nome ? obterToken(nome) : null;

      const idGrupo =
        chave && !/^\d+$/.test(nome)
          ? chave
          : nome
            ? `token-${nome}`
            : "sem-comprador";

      if (!grupos.has(idGrupo)) {
        grupos.set(idGrupo, {
          nome: nomeGrupo,
          token,
          cartas: [],
          total: 0,
        });
      }

      const grupo = grupos.get(idGrupo);
      grupo.cartas.push(carta);
      grupo.total += numeroValor(carta.valor);
    });

    grupos.forEach((grupo) => {
      y += 3.5;

      if (y + 32 > altura - 23) novaPagina();

      const titulo = grupo.token
        ? `#${grupo.token}  ${grupo.nome}`
        : grupo.nome;

      const tituloLinhas = pdf.splitTextToSize(
        titulo,
        larguraConteudo - 8
      );

      const alturaBolhaNome = Math.max(
        10,
        tituloLinhas.length * 4.5 + 4
      );

      pdf.setFillColor(71, 85, 105);
      pdf.roundedRect(
        margem,
        y,
        larguraConteudo,
        alturaBolhaNome,
        1.8,
        1.8,
        "F"
      );

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(255, 255, 255);
      pdf.text(tituloLinhas, margem + 4, y + 6.2);

      y += alturaBolhaNome + 3;

      grupo.cartas.forEach((carta) => {
        const nomeCarta = carta.nome.trim() || "Carta sem nome";
        const linhasNome = pdf.splitTextToSize(
          nomeCarta,
          larguraConteudo - 35
        );

        const alturaLinha = Math.max(
          7,
          linhasNome.length * 4.5 + 2
        );

        if (y + alturaLinha + 16 > altura - 20) {
          novaPagina();
        }

        pdf.setFillColor(241, 245, 249);
        pdf.roundedRect(
          margem,
          y,
          larguraConteudo,
          alturaLinha,
          1.5,
          1.5,
          "F"
        );

        pdf.setDrawColor(226, 232, 240);
        pdf.setLineWidth(0.25);
        pdf.roundedRect(
          margem,
          y,
          larguraConteudo,
          alturaLinha,
          1.5,
          1.5,
          "S"
        );

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(51, 65, 85);
        pdf.text(linhasNome, margem + 4, y + 4.8);

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(30, 41, 59);
        pdf.text(
          moeda(numeroValor(carta.valor)),
          largura - margem - 4,
          y + 4.8,
          { align: "right" }
        );

        y += alturaLinha + 1.5;
      });

      // Total ao final das cartas de cada comprador.
      if (y + 15 > altura - 20) novaPagina();

      y += 2;

      pdf.setFillColor(203, 213, 225);
      pdf.roundedRect(
        margem,
        y,
        larguraConteudo,
        12,
        1.5,
        1.5,
        "F"
      );

      pdf.setFillColor(51, 65, 85);
      pdf.roundedRect(margem, y, 2.2, 12, 1, 1, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(15, 23, 42);
      pdf.text("TOTAL", margem + 4, y + 7.6);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(15, 23, 42);
      pdf.text(
        moeda(grupo.total),
        largura - margem - 4,
        y + 7.6,
        { align: "right" }
      );

      y += 19;
    });

    rodape();
    pdf.save("organizador-leilao-pokemon.pdf");
  }

  const cartasExibidas = useMemo(() => {
    const termo = normalizarNome(busca);

    const lista = cartas
      .map((carta, indice) => ({
        ...carta,
        indiceOriginal: indice,
      }))
      .filter((c) => {
        if (!termo) return true;

        return [
          c.nome,
          c.comprador,
          String(obterToken(c.comprador) || ""),
        ].some((v) => normalizarNome(v).includes(termo));
      });

    if (ordenacao === "az") {
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    }

    if (ordenacao === "za") {
      lista.sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR"));
    }

    if (ordenacao === "maior") {
      lista.sort((a, b) => numeroValor(b.valor) - numeroValor(a.valor));
    }

    if (ordenacao === "menor") {
      lista.sort((a, b) => numeroValor(a.valor) - numeroValor(b.valor));
    }

    return lista;
  }, [cartas, busca, ordenacao, tokenPorNome]);

  const totalLeilao = cartas.reduce(
    (s, c) => s + numeroValor(c.valor),
    0
  );

  const cartasPreenchidas = cartas.filter(
    (c) => c.nome.trim() || c.valor !== ""
  ).length;

  const totalCompradores = compradores.length;

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <div className="pokebola-logo" />
          <div>
            <h1>Organizador de Leilão</h1>
            <p>Pokémon · Controle de arremates</p>
          </div>
        </div>

        <button className="btn-adicionar-pessoa" onClick={adicionarCarta}>
          ＋ Nova carta
        </button>
      </header>

      <main className="conteudo">
        <section className="resumo">
          <article className="resumo-card destaque">
            <span>VALOR CADASTRADO</span>
            <strong>{moeda(totalLeilao)}</strong>
            <small>Soma dos preços das cartas</small>
          </article>

          <article className="resumo-card">
            <span>CARTAS CADASTRADAS</span>
            <strong>{cartasPreenchidas}</strong>
            <small>Cartas no leilão</small>
          </article>

          <article className="resumo-card">
            <span>ARREMATANTES</span>
            <strong>{totalCompradores}</strong>
            <small>Compradores identificados</small>
          </article>

          <article className="resumo-card">
            <span>ITENS NA LISTA</span>
            <strong>{cartas.length}</strong>
            <small>Linhas de cadastro</small>
          </article>
        </section>

        <section className="painel-intro">
          <div>
            <span className="eyebrow">CONTROLE DO LEILÃO</span>
            <h2>Cartas e arrematantes</h2>
            <p>
              Cadastre a carta, informe o preço e associe quem arrematou.
            </p>
          </div>

          <button
            className="btn-adicionar-carta-topo"
            onClick={adicionarCarta}
          >
            ＋ Adicionar carta
          </button>
        </section>

        <section className="filtros">
          <label className="busca">
            <span>⌕</span>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar carta, arrematante ou token..."
            />
          </label>

          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value)}
          >
            <option value="entrada">Ordem de cadastro</option>
            <option value="az">Carta: A → Z</option>
            <option value="za">Carta: Z → A</option>
            <option value="maior">Maior preço</option>
            <option value="menor">Menor preço</option>
          </select>
        </section>

        <section className="cartas-painel">
          <div className="cartas-painel-titulo">
            <div>
              <h2>📋 Cartas cadastradas</h2>
              <p>
                Use o nome do comprador na primeira carta e depois o token
                numérico nas próximas.
              </p>
            </div>

            <span className="contador-pill">
              {cartas.length} {cartas.length === 1 ? "item" : "itens"}
            </span>
          </div>

          <div className="cartas-cabecalho">
            <span>#</span>
            <span>CARTA / COLEÇÃO</span>
            <span>PREÇO (R$)</span>
            <span>ARREMATANTE / TOKEN</span>
            <span />
          </div>

          <div className="lista-cartas">
            {cartasExibidas.map((carta, indiceExibido) => {
              const token = obterToken(carta.comprador);
              const textoComprador = String(carta.comprador || "").trim();

              const sugestoes = compradores.filter(
                (c) =>
                  normalizarNome(c.nome).includes(
                    normalizarNome(textoComprador)
                  ) &&
                  normalizarNome(textoComprador) &&
                  normalizarNome(c.nome) !==
                    normalizarNome(textoComprador)
              );

              return (
                <div className="carta-linha" key={carta.id}>
                  <span className="numero-carta">
                    {carta.indiceOriginal + 1}
                  </span>

                  <input
                    ref={(el) => {
                      nomeRefs.current[carta.id] = el;
                    }}
                    className="nome-carta"
                    value={carta.nome}
                    onChange={(e) =>
                      atualizarCarta(carta.id, "nome", e.target.value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        valorRefs.current[carta.id]?.focus();
                      }
                    }}
                    placeholder="Ex.: Pikachu 12/34"
                    aria-label="Nome da carta"
                  />

                  <div className="preco-container">
                    <span className="preco-simbolo">R$</span>
                    <input
                      ref={(el) => {
                        valorRefs.current[carta.id] = el;
                      }}
                      className="preco-input"
                      value={formatarValorInput(carta.valor)}
                      inputMode="decimal"
                      onChange={(e) =>
                        atualizarCarta(carta.id, "valor", e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          compradorRefs.current[carta.id]?.focus();
                        }
                      }}
                      placeholder="0,00"
                      aria-label="Preço da carta"
                    />
                  </div>

                  <div className="comprador-campo">
                    <input
                      ref={(el) => {
                        compradorRefs.current[carta.id] = el;
                      }}
                      value={carta.comprador}
                      onFocus={() => setSugestaoAberta(carta.id)}
                      onChange={(e) => {
                        setSugestaoAberta(carta.id);
                        atualizarCarta(
                          carta.id,
                          "comprador",
                          e.target.value
                        );
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          resolverTokenComprador(carta.id);
                        }, 150);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          avancarDoComprador(
                            carta.id,
                            indiceExibido,
                            cartasExibidas
                          );
                        }
                      }}
                      placeholder="Nome ou token (ex.: 1)"
                      aria-label="Arrematante"
                    />

                    {token && <span className="token-inline">#{token}</span>}

                    {sugestaoAberta === carta.id &&
                      sugestoes.length > 0 && (
                        <div className="sugestoes">
                          {sugestoes.slice(0, 5).map((s) => (
                            <button
                              type="button"
                              key={s.token}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() =>
                                completarComprador(carta.id, s.nome)
                              }
                            >
                              #{s.token} · {s.nome}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <button
                    className="btn-remover-carta"
                    onClick={() => removerCarta(carta.id)}
                    title="Remover carta"
                    aria-label="Remover carta"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          <button className="btn-adicionar-carta" onClick={adicionarCarta}>
            ＋ Adicionar outra carta
          </button>
        </section>

        <section className="tokens-pessoas">
          <div className="tokens-cabecalho">
            <div>
              <span className="eyebrow">REFERÊNCIA RÁPIDA</span>
              <h2>Números dos compradores</h2>
              <p>
                Digite o nome uma vez. Nas próximas cartas, use o token
                correspondente.
              </p>
            </div>

            <span className="tokens-contagem">
              {compradores.length}{" "}
              {compradores.length === 1 ? "arrematante" : "arrematantes"}
            </span>
          </div>

          {compradores.length === 0 ? (
            <p className="tokens-vazio">
              Os números serão criados automaticamente quando você informar
              um comprador.
            </p>
          ) : (
            <div className="tokens-lista">
              {compradores.map((c) => (
                <div className="token-item" key={c.token}>
                  <span className="token-badge">#{c.token}</span>

                  <div className="token-dados">
                    <strong>{c.nome}</strong>
                    <small>
                      {c.quantidade}{" "}
                      {c.quantidade === 1 ? "carta" : "cartas"} · Total
                      individual: {moeda(c.total)}
                    </small>
                  </div>

                  <button
                    className="token-usar"
                    onClick={() => {
                      const vazia = cartas.find(
                        (carta) => !carta.comprador.trim()
                      );

                      if (vazia) {
                        atualizarCarta(vazia.id, "comprador", c.nome);
                        compradorRefs.current[vazia.id]?.focus();
                      } else {
                        const nova = criarCarta();
                        nova.comprador = c.nome;

                        setCartas((atual) => [...atual, nova]);

                        setTimeout(() => {
                          nomeRefs.current[nova.id]?.focus();
                        }, 50);
                      }
                    }}
                  >
                    Usar token
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="acoes-rodape">
          <div className="botoes-principais">
            <button className="btn-pdf" onClick={gerarPDF}>
              ▤ Gerar PDF
            </button>

            <button className="btn-limpar" onClick={limparLeilao}>
              Limpar leilão
            </button>
          </div>

          <div className="status">
            {salvo
              ? "✓ Dados salvos automaticamente neste navegador"
              : "⚠ Não foi possível salvar os dados"}
          </div>

          <div className="atalho">
            Dica: pressione <strong>Enter</strong> no campo do comprador
            para ir à próxima carta ou criar uma nova ao final.
          </div>
        </section>
      </main>

      <footer className="rodape">
        <span>Organizador de Leilão Pokémon</span>
        <span>Dados armazenados localmente neste navegador</span>
      </footer>
    </div>
  );
}

export default App;
