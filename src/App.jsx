import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import "./App.css";

const STORAGE_KEY = "organizador-leilao-pokemon";

function criarCarta() {
  return {
    id: crypto.randomUUID(),
    nome: "",
    valor: "",
  };
}

function criarPessoa() {
  return {
    id: crypto.randomUUID(),
    nome: "",
    cartas: [criarCarta()],
  };
}

function normalizarValor(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return 0;
  }

  const numero = Number(
    String(valor)
      .replace(/\./g, "")
      .replace(",", ".")
  );

  return Number.isNaN(numero) ? 0 : numero;
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarValorInput(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return "";
  }

  return String(valor);
}

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

  pdf.addImage(
    imagem,
    "PNG",
    x - raio,
    y - raio,
    raio * 2,
    raio * 2
  );
}

function App() {
  const [pessoas, setPessoas] = useState(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);

      if (!salvo) {
        return [criarPessoa()];
      }

      const dados = JSON.parse(salvo);

      if (!Array.isArray(dados) || dados.length === 0) {
        return [criarPessoa()];
      }

      return dados;
    } catch {
      return [criarPessoa()];
    }
  });

  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState("az");
  const [salvo, setSalvo] = useState(true);

  const pessoaNomeRefs = useRef({});
  const cartaNomeRefs = useRef({});
  const cartaValorRefs = useRef({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pessoas));
      setSalvo(true);
    } catch {
      setSalvo(false);
    }
  }, [pessoas]);

  function adicionarPessoa() {
    const novaPessoa = criarPessoa();

    setPessoas((atual) => [...atual, novaPessoa]);

    setTimeout(() => {
      pessoaNomeRefs.current[novaPessoa.id]?.focus();
    }, 50);
  }

  function removerPessoa(pessoaId) {
    const pessoa = pessoas.find((item) => item.id === pessoaId);

    if (!pessoa) return;

    const confirmou = window.confirm(
      `Deseja realmente remover "${pessoa.nome || "esta pessoa"}"?`
    );

    if (!confirmou) return;

    setPessoas((atual) =>
      atual.filter((item) => item.id !== pessoaId)
    );
  }

  function atualizarNomePessoa(pessoaId, nome) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === pessoaId
          ? {
              ...pessoa,
              nome,
            }
          : pessoa
      )
    );
  }

  function adicionarCarta(pessoaId) {
    const novaCarta = criarCarta();

    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === pessoaId
          ? {
              ...pessoa,
              cartas: [...pessoa.cartas, novaCarta],
            }
          : pessoa
      )
    );

    setTimeout(() => {
      cartaNomeRefs.current[novaCarta.id]?.focus();
    }, 50);
  }

  function removerCarta(pessoaId, cartaId) {
    setPessoas((atual) =>
      atual.map((pessoa) => {
        if (pessoa.id !== pessoaId) {
          return pessoa;
        }

        if (pessoa.cartas.length === 1) {
          return pessoa;
        }

        return {
          ...pessoa,
          cartas: pessoa.cartas.filter(
            (carta) => carta.id !== cartaId
          ),
        };
      })
    );
  }

  function atualizarNomeCarta(pessoaId, cartaId, nome) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id !== pessoaId
          ? pessoa
          : {
              ...pessoa,
              cartas: pessoa.cartas.map((carta) =>
                carta.id === cartaId
                  ? {
                      ...carta,
                      nome,
                    }
                  : carta
              ),
            }
      )
    );
  }

  function atualizarValorCarta(pessoaId, cartaId, valor) {
    let novoValor = valor;

    novoValor = novoValor.replace(/[^\d,.]/g, "");

    novoValor = novoValor.replace(/\./g, ",");

    const partes = novoValor.split(",");

    if (partes.length > 2) {
      novoValor =
        partes[0] +
        "," +
        partes.slice(1).join("");
    }

    if (novoValor.includes(",")) {
      const [inteiro, decimal] = novoValor.split(",");

      novoValor =
        inteiro +
        "," +
        decimal.slice(0, 2);
    }

    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id !== pessoaId
          ? pessoa
          : {
              ...pessoa,
              cartas: pessoa.cartas.map((carta) =>
                carta.id === cartaId
                  ? {
                      ...carta,
                      valor: novoValor,
                    }
                  : carta
              ),
            }
      )
    );
  }

  function calcularTotalPessoa(pessoa) {
    return pessoa.cartas.reduce(
      (total, carta) =>
        total + normalizarValor(carta.valor),
      0
    );
  }

  const totalGeral = pessoas.reduce(
    (total, pessoa) =>
      total + calcularTotalPessoa(pessoa),
    0
  );

  const totalCartas = pessoas.reduce(
    (total, pessoa) =>
      total + pessoa.cartas.length,
    0
  );

  const maiorDivida =
    pessoas.length > 0
      ? pessoas.reduce((maior, pessoa) => {
          const valorAtual = calcularTotalPessoa(pessoa);
          const valorMaior = calcularTotalPessoa(maior);

          return valorAtual > valorMaior
            ? pessoa
            : maior;
        }, pessoas[0])
      : null;

  function obterPessoasOrdenadas() {
    const termo = busca.trim().toLowerCase();

    let resultado = pessoas.filter((pessoa) => {
      if (!termo) return true;

      return pessoa.nome
        .toLowerCase()
        .includes(termo);
    });

    resultado = [...resultado];

    if (ordenacao === "az") {
      resultado.sort((a, b) =>
        (a.nome || "Sem nome").localeCompare(
          b.nome || "Sem nome",
          "pt-BR"
        )
      );
    }

    if (ordenacao === "za") {
      resultado.sort((a, b) =>
        (b.nome || "Sem nome").localeCompare(
          a.nome || "Sem nome",
          "pt-BR"
        )
      );
    }

    if (ordenacao === "maior") {
      resultado.sort(
        (a, b) =>
          calcularTotalPessoa(b) -
          calcularTotalPessoa(a)
      );
    }

    if (ordenacao === "menor") {
      resultado.sort(
        (a, b) =>
          calcularTotalPessoa(a) -
          calcularTotalPessoa(b)
      );
    }

    return resultado;
  }

  function handleEnterPessoa(event, pessoa) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    const primeiraCarta = pessoa.cartas[0];

    if (!primeiraCarta) return;

    setTimeout(() => {
      cartaNomeRefs.current[
        primeiraCarta.id
      ]?.focus();
    }, 30);
  }

  function handleEnterNomeCarta(event, cartaId) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    setTimeout(() => {
      cartaValorRefs.current[
        cartaId
      ]?.focus();
    }, 30);
  }

  function handleEnterValor(
    event,
    pessoaId,
    carta
  ) {
    if (event.key !== "Enter") return;

    event.preventDefault();

    if (
      !carta.nome.trim() ||
      carta.valor === ""
    ) {
      return;
    }

    adicionarCarta(pessoaId);
  }

  function limparLeilao() {
    const confirmou = window.confirm(
      "Deseja realmente limpar todo o leilão? Essa ação não pode ser desfeita."
    );

    if (!confirmou) return;

    const novaPessoa = criarPessoa();

    setPessoas([novaPessoa]);

    setBusca("");
    setOrdenacao("az");

    setTimeout(() => {
      pessoaNomeRefs.current[
        novaPessoa.id
      ]?.focus();
    }, 50);
  }

  function desenharCabecalhoPDF(pdf) {
    const larguraPagina = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(7, 12, 27);
    pdf.rect(
      0,
      0,
      larguraPagina,
      42,
      "F"
    );

    desenharPokebola(
      pdf,
      20,
      21,
      7
    );

    pdf.setTextColor(
      255,
      255,
      255
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(18);

    pdf.text(
      "ORGANIZADOR DE LEILÃO",
      31,
      19
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(9);

    pdf.setTextColor(
      148,
      163,
      184
    );

    pdf.text(
      "Pokémon",
      31,
      28
    );
  }

  function desenharRodape(
    paginaAtual,
    totalPaginas
  ) {
    const larguraPagina =
      pdfAtual.internal.pageSize.getWidth();

    const alturaPagina =
      pdfAtual.internal.pageSize.getHeight();

    pdfAtual.setDrawColor(
      226,
      232,
      240
    );

    pdfAtual.line(
      20,
      alturaPagina - 20,
      larguraPagina - 20,
      alturaPagina - 20
    );

    pdfAtual.setFont(
      "helvetica",
      "normal"
    );

    pdfAtual.setFontSize(8);

    pdfAtual.setTextColor(
      100,
      116,
      139
    );

    pdfAtual.text(
      "Organizador de Leilão Pokémon",
      20,
      alturaPagina - 11
    );

    pdfAtual.text(
      `Página ${paginaAtual} de ${totalPaginas}`,
      larguraPagina - 20,
      alturaPagina - 11,
      {
        align: "right",
      }
    );
  }

  let pdfAtual = null;

  function gerarPDF() {
    const pessoasPDF = pessoas.filter(
      (pessoa) =>
        pessoa.nome.trim() ||
        pessoa.cartas.some(
          (carta) =>
            carta.nome.trim() ||
            carta.valor !== ""
        )
    );

    if (pessoasPDF.length === 0) {
      window.alert(
        "Adicione pelo menos uma pessoa ou uma carta antes de gerar o PDF."
      );

      return;
    }

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    pdfAtual = pdf;

    const larguraPagina =
      pdf.internal.pageSize.getWidth();

    const alturaPagina =
      pdf.internal.pageSize.getHeight();

    let y = 55;

    desenharCabecalhoPDF(pdf);

    // Resumo
    pdf.setFillColor(
      241,
      245,
      249
    );

    pdf.roundedRect(
      20,
      y,
      larguraPagina - 40,
      25,
      4,
      4,
      "F"
    );

    pdf.setTextColor(
      15,
      23,
      42
    );

    pdf.setFont(
      "helvetica",
      "bold"
    );

    pdf.setFontSize(10);

    pdf.text(
      "RESUMO DO LEILÃO",
      26,
      y + 8
    );

    pdf.setFont(
      "helvetica",
      "normal"
    );

    pdf.setFontSize(8);

    const dataAtual =
      new Date().toLocaleDateString(
        "pt-BR"
      );

    pdf.text(
      `Data: ${dataAtual}`,
      26,
      y + 17
    );

    // ALTERAÇÃO SOMENTE NO PDF:
    // Participantes -> Adquirentes
    pdf.text(
      `Adquirentes: ${pessoasPDF.length}`,
      100,
      y + 17
    );

    const quantidadeCartasPDF =
      pessoasPDF.reduce(
        (total, pessoa) =>
          total + pessoa.cartas.length,
        0
      );

    pdf.text(
      `Cartas: ${quantidadeCartasPDF}`,
      145,
      y + 17
    );

    y += 40;

    pessoasPDF.forEach(
      (pessoa, indicePessoa) => {
        const nomePessoa =
          pessoa.nome.trim() ||
          `Pessoa ${indicePessoa + 1}`;

        const totalPessoa =
          calcularTotalPessoa(pessoa);

        const alturaBloco =
          31 +
          pessoa.cartas.length * 9 +
          18;

        if (
          y + alturaBloco >
          alturaPagina - 30
        ) {
          pdf.addPage();

          desenharCabecalhoPDF(pdf);

          y = 55;
        }

        // Cabeçalho da pessoa
        pdf.setFillColor(
          15,
          30,
          55
        );

        pdf.roundedRect(
          20,
          y,
          larguraPagina - 40,
          16,
          3,
          3,
          "F"
        );

        pdf.setTextColor(
          255,
          255,
          255
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(10);

        pdf.text(
          nomePessoa,
          26,
          y + 10
        );

        // O valor ao lado do nome foi
        // removido SOMENTE do PDF.

        y += 20;

        // Cabeçalho das cartas
        pdf.setFillColor(
          226,
          232,
          240
        );

        pdf.rect(
          20,
          y,
          larguraPagina - 40,
          8,
          "F"
        );

        pdf.setTextColor(
          71,
          85,
          105
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(7);

        pdf.text(
          "CARTA",
          26,
          y + 5
        );

        pdf.text(
          "VALOR",
          larguraPagina - 26,
          y + 5,
          {
            align: "right",
          }
        );

        y += 8;

        pessoa.cartas.forEach(
          (carta, indiceCarta) => {
            const nomeCarta =
              carta.nome.trim() ||
              `Carta ${indiceCarta + 1}`;

            const valorCarta =
              normalizarValor(
                carta.valor
              );

            if (
              indiceCarta % 2 === 0
            ) {
              pdf.setFillColor(
                248,
                250,
                252
              );

              pdf.rect(
                20,
                y,
                larguraPagina - 40,
                9,
                "F"
              );
            }

            pdf.setTextColor(
              30,
              41,
              59
            );

            pdf.setFont(
              "helvetica",
              "normal"
            );

            pdf.setFontSize(8);

            pdf.text(
              nomeCarta,
              26,
              y + 6
            );

            pdf.setFont(
              "helvetica",
              "bold"
            );

            pdf.text(
              formatarMoeda(
                valorCarta
              ),
              larguraPagina - 26,
              y + 6,
              {
                align: "right",
              }
            );

            y += 9;
          }
        );

        // Total da pessoa
        pdf.setDrawColor(
          203,
          213,
          225
        );

        pdf.line(
          20,
          y + 1,
          larguraPagina - 20,
          y + 1
        );

        y += 8;

        pdf.setTextColor(
          15,
          23,
          42
        );

        pdf.setFont(
          "helvetica",
          "bold"
        );

        pdf.setFontSize(9);

        pdf.text(
          "TOTAL A PAGAR:",
          20,
          y
        );

        pdf.setTextColor(
          37,
          99,
          235
        );

        pdf.text(
          formatarMoeda(totalPessoa),
          larguraPagina - 20,
          y,
          {
            align: "right",
          }
        );

        y += 18;
      }
    );

    const totalPaginas =
      pdf.getNumberOfPages();

    for (
      let pagina = 1;
      pagina <= totalPaginas;
      pagina++
    ) {
      pdf.setPage(pagina);

      desenharRodape(
        pagina,
        totalPaginas
      );
    }

    pdf.save(
      "dividas-leilao-pokemon.pdf"
    );

    pdfAtual = null;
  }

  useEffect(() => {
    function handleAtalho(event) {
      if (
        event.ctrlKey &&
        event.key === "Enter"
      ) {
        event.preventDefault();

        adicionarPessoa();
      }
    }

    window.addEventListener(
      "keydown",
      handleAtalho
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleAtalho
      );
    };
  }, []);

  const pessoasExibidas =
    obterPessoasOrdenadas();

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">
          <div className="pokebola-logo">
            <span />
          </div>

          <div>
            <h1>
              Organizador de Leilão
            </h1>

            <p>Pokémon</p>
          </div>
        </div>

        <button
          className="btn-adicionar-pessoa"
          onClick={adicionarPessoa}
        >
          + Nova pessoa
        </button>
      </header>

      <main className="conteudo">
        <section className="resumo">
          <div className="resumo-card destaque">
            <span>
              💰 Total do leilão
            </span>

            <strong>
              {formatarMoeda(totalGeral)}
            </strong>
          </div>

          <div className="resumo-card">
            <span>
              👥 Participantes
            </span>

            <strong>
              {pessoas.length}
            </strong>
          </div>

          <div className="resumo-card">
            <span>
              📜 Cartas
            </span>

            <strong>
              {totalCartas}
            </strong>
          </div>

          <div className="resumo-card">
            <span>
              💵 Maior dívida
            </span>

            <strong>
              {formatarMoeda(
                maiorDivida
                  ? calcularTotalPessoa(
                      maiorDivida
                    )
                  : 0
              )}
            </strong>

            <small>
              {maiorDivida?.nome ||
                "—"}
            </small>
          </div>
        </section>

        <section className="filtros">
          <div className="busca">
            <span>🔍</span>

            <input
              type="text"
              placeholder="Pesquisar participante..."
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
            />
          </div>

          <select
            value={ordenacao}
            onChange={(event) =>
              setOrdenacao(event.target.value)
            }
          >
            <option value="az">
              A → Z
            </option>

            <option value="za">
              Z → A
            </option>

            <option value="maior">
              Maior dívida
            </option>

            <option value="menor">
              Menor dívida
            </option>
          </select>
        </section>

        {pessoasExibidas.length === 0 ? (
          <section className="vazio">
            <div>🔍</div>

            <h2>
              Nenhuma pessoa encontrada
            </h2>

            <p>
              Tente pesquisar por outro nome.
            </p>
          </section>
        ) : (
          <section className="lista-pessoas">
            {pessoasExibidas.map(
              (pessoa, indicePessoa) => {
                const totalPessoa =
                  calcularTotalPessoa(
                    pessoa
                  );

                return (
                  <article
                    className="pessoa-card"
                    key={pessoa.id}
                  >
                    <div className="pessoa-header">
                      <div className="pessoa-identidade">
                        <span className="numero-pessoa">
                          {String(
                            indicePessoa + 1
                          ).padStart(2, "0")}
                        </span>

                        <input
                          ref={(elemento) => {
                            pessoaNomeRefs.current[
                              pessoa.id
                            ] = elemento;
                          }}
                          className="nome-pessoa"
                          type="text"
                          value={pessoa.nome}
                          placeholder="Nome da pessoa"
                          onChange={(event) =>
                            atualizarNomePessoa(
                              pessoa.id,
                              event.target.value
                            )
                          }
                          onKeyDown={(event) =>
                            handleEnterPessoa(
                              event,
                              pessoa
                            )
                          }
                        />
                      </div>

                      <div className="pessoa-total">
                        <span>
                          Total a pagar
                        </span>

                        <strong>
                          {formatarMoeda(
                            totalPessoa
                          )}
                        </strong>
                      </div>

                      <button
                        className="btn-remover-pessoa"
                        onClick={() =>
                          removerPessoa(
                            pessoa.id
                          )
                        }
                        title="Remover pessoa"
                      >
                        🗑️
                      </button>
                    </div>

                    <div className="cartas-area">
                      <div className="cartas-titulo">
                        <span>
                          📜 CARTAS
                        </span>

                        <small>
                          {pessoa.cartas.length}{" "}
                          {pessoa.cartas.length ===
                          1
                            ? "CARTA"
                            : "CARTAS"}
                        </small>
                      </div>

                      <div className="lista-cartas">
                        {pessoa.cartas.map(
                          (
                            carta,
                            indiceCarta
                          ) => (
                            <div
                              className="carta-linha"
                              key={carta.id}
                            >
                              <span className="numero-carta">
                                {indiceCarta + 1}
                              </span>

                              <input
                                ref={(elemento) => {
                                  cartaNomeRefs.current[
                                    carta.id
                                  ] = elemento;
                                }}
                                className="nome-carta"
                                type="text"
                                value={carta.nome}
                                placeholder="Nome da carta"
                                onChange={(
                                  event
                                ) =>
                                  atualizarNomeCarta(
                                    pessoa.id,
                                    carta.id,
                                    event.target
                                      .value
                                  )
                                }
                                onKeyDown={(
                                  event
                                ) =>
                                  handleEnterNomeCarta(
                                    event,
                                    carta.id
                                  )
                                }
                              />

                              <div className="preco-container">
                                <span className="preco-simbolo">
                                  R$
                                </span>

                                <input
                                  ref={(elemento) => {
                                    cartaValorRefs.current[
                                      carta.id
                                    ] = elemento;
                                  }}
                                  className="preco-input"
                                  type="text"
                                  inputMode="decimal"
                                  value={formatarValorInput(
                                    carta.valor
                                  )}
                                  placeholder="0,00"
                                  onChange={(
                                    event
                                  ) =>
                                    atualizarValorCarta(
                                      pessoa.id,
                                      carta.id,
                                      event.target
                                        .value
                                    )
                                  }
                                  onKeyDown={(
                                    event
                                  ) =>
                                    handleEnterValor(
                                      event,
                                      pessoa.id,
                                      carta
                                    )
                                  }
                                />
                              </div>

                              <button
                                className="btn-remover-carta"
                                onClick={() =>
                                  removerCarta(
                                    pessoa.id,
                                    carta.id
                                  )
                                }
                                title="Remover carta"
                              >
                                ×
                              </button>
                            </div>
                          )
                        )}
                      </div>

                      <button
                        className="btn-adicionar-carta"
                        onClick={() =>
                          adicionarCarta(
                            pessoa.id
                          )
                        }
                      >
                        + Adicionar outra carta
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </section>
        )}

        <section className="acoes-rodape">
          <div className="botoes-principais">
            <button
              className="btn-pdf"
              onClick={gerarPDF}
            >
              📄 Gerar PDF
            </button>

            <button
              className="btn-limpar"
              onClick={limparLeilao}
            >
              🗑️ Limpar leilão
            </button>
          </div>

          <div className="status">
            {salvo
              ? "💾 Dados salvos automaticamente neste navegador"
              : "⚠️ Não foi possível salvar os dados"}
          </div>

          <div className="atalho">
            Atalho:{" "}
            <strong>
              Ctrl + Enter
            </strong>{" "}
            adiciona participante
          </div>
        </section>
      </main>

      <footer className="rodape">
        <span>
          Organizador de Leilão Pokémon
        </span>

        <span>
          Dados armazenados localmente neste navegador
        </span>
      </footer>
    </div>
  );
}

export default App;