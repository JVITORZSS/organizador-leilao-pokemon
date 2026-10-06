import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import "./App.css";

const STORAGE_KEY = "organizador-leilao-pokemon";

function App() {
  const [pessoas, setPessoas] = useState(() => {
    try {
      const dadosSalvos = localStorage.getItem(STORAGE_KEY);

      if (dadosSalvos) {
        return JSON.parse(dadosSalvos);
      }
    } catch (erro) {
      console.error("Erro ao carregar os dados:", erro);
    }

    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(pessoas)
      );
    } catch (erro) {
      console.error("Erro ao salvar os dados:", erro);
    }
  }, [pessoas]);

  function adicionarPessoa() {
    const agora = Date.now();

    const novaPessoa = {
      id: agora,
      nome: "",
      cartas: [
        {
          id: agora + 1,
          nome: "",
          valor: "",
        },
      ],
    };

    setPessoas((atual) => [...atual, novaPessoa]);
  }

  function alterarNomePessoa(id, nome) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === id
          ? { ...pessoa, nome }
          : pessoa
      )
    );
  }

  function adicionarCarta(pessoaId) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === pessoaId
          ? {
              ...pessoa,
              cartas: [
                ...pessoa.cartas,
                {
                  id: Date.now(),
                  nome: "",
                  valor: "",
                },
              ],
            }
          : pessoa
      )
    );
  }

  function alterarCarta(
    pessoaId,
    cartaId,
    campo,
    valor
  ) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === pessoaId
          ? {
              ...pessoa,
              cartas: pessoa.cartas.map((carta) =>
                carta.id === cartaId
                  ? {
                      ...carta,
                      [campo]: valor,
                    }
                  : carta
              ),
            }
          : pessoa
      )
    );
  }

  function removerCarta(pessoaId, cartaId) {
    setPessoas((atual) =>
      atual.map((pessoa) =>
        pessoa.id === pessoaId
          ? {
              ...pessoa,
              cartas:
                pessoa.cartas.length > 1
                  ? pessoa.cartas.filter(
                      (carta) =>
                        carta.id !== cartaId
                    )
                  : pessoa.cartas,
            }
          : pessoa
      )
    );
  }

  function removerPessoa(pessoaId) {
    const pessoa = pessoas.find(
      (item) => item.id === pessoaId
    );

    const nome = pessoa?.nome?.trim();

    const confirmar = window.confirm(
      nome
        ? `Remover ${nome} e todas as cartas dela?`
        : "Remover esta pessoa e todas as cartas dela?"
    );

    if (!confirmar) {
      return;
    }

    setPessoas((atual) =>
      atual.filter(
        (pessoa) => pessoa.id !== pessoaId
      )
    );
  }

  function calcularTotalPessoa(pessoa) {
    return pessoa.cartas.reduce(
      (total, carta) =>
        total + (parseFloat(carta.valor) || 0),
      0
    );
  }

  function formatarValor(valor) {
    return Number(valor || 0).toLocaleString(
      "pt-BR",
      {
        style: "currency",
        currency: "BRL",
      }
    );
  }

  function formatarValorPDF(valor) {
    return `R$ ${Number(valor || 0)
      .toFixed(2)
      .replace(".", ",")}`;
  }

  function gerarPDF() {
    const pessoasComDados = pessoas.filter(
      (pessoa) =>
        pessoa.nome?.trim() ||
        pessoa.cartas.some(
          (carta) =>
            carta.nome?.trim() ||
            parseFloat(carta.valor) > 0
        )
    );

    if (pessoasComDados.length === 0) {
      alert(
        "Adicione pelo menos uma pessoa ou uma carta antes de gerar o PDF."
      );

      return;
    }

    const pdf = new jsPDF();

    const margemEsquerda = 20;
    const margemDireita = 190;
    const larguraUtil =
      margemDireita - margemEsquerda;

    let y = 20;

    function verificarPagina(alturaNecessaria = 10) {
      if (y + alturaNecessaria > 275) {
        pdf.addPage();
        y = 20;
      }
    }

    // TÍTULO
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(
      "ORGANIZADOR DE LEILÃO",
      margemEsquerda,
      y
    );

    y += 8;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(100);

    pdf.text(
      "Registro dos arremates",
      margemEsquerda,
      y
    );

    y += 12;

    pdf.setDrawColor(210);
    pdf.line(
      margemEsquerda,
      y,
      margemDireita,
      y
    );

    y += 12;

    pessoasComDados.forEach((pessoa, indice) => {
      const nomePessoa =
        pessoa.nome?.trim() ||
        `Pessoa ${indice + 1}`;

      const cartasComDados =
        pessoa.cartas.filter(
          (carta) =>
            carta.nome?.trim() ||
            parseFloat(carta.valor) > 0
        );

      const totalPessoa =
        calcularTotalPessoa(pessoa);

      verificarPagina(35);

      // NOME DA PESSOA
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(30);

      pdf.text(
        nomePessoa,
        margemEsquerda,
        y
      );

      y += 8;

      // CABEÇALHO DAS CARTAS
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(100);

      pdf.text(
        "CARTA",
        margemEsquerda,
        y
      );

      pdf.text(
        "VALOR",
        160,
        y
      );

      y += 3;

      pdf.setDrawColor(220);

      pdf.line(
        margemEsquerda,
        y,
        margemDireita,
        y
      );

      y += 7;

      // CARTAS
      cartasComDados.forEach((carta) => {
        verificarPagina(10);

        const nomeCarta =
          carta.nome?.trim() ||
          "Carta sem nome";

        const valor =
          parseFloat(carta.valor) || 0;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(40);

        pdf.text(
          nomeCarta,
          margemEsquerda,
          y
        );

        pdf.text(
          formatarValorPDF(valor),
          160,
          y
        );

        y += 7;
      });

      y += 2;

      verificarPagina(14);

      // TOTAL DA PESSOA
      pdf.setDrawColor(210);

      pdf.line(
        margemEsquerda,
        y,
        margemDireita,
        y
      );

      y += 8;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(30);

      pdf.text(
        "TOTAL A PAGAR:",
        margemEsquerda,
        y
      );

      pdf.text(
        formatarValorPDF(totalPessoa),
        160,
        y
      );

      y += 15;

      // SEPARAÇÃO ENTRE PESSOAS
      if (indice < pessoasComDados.length - 1) {
        pdf.setDrawColor(235);

        pdf.line(
          margemEsquerda,
          y,
          margemDireita,
          y
        );

        y += 12;
      }
    });

    // RODAPÉ DAS PÁGINAS
    const totalPaginas =
      pdf.getNumberOfPages();

    for (
      let pagina = 1;
      pagina <= totalPaginas;
      pagina++
    ) {
      pdf.setPage(pagina);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(140);

      pdf.text(
        `Página ${pagina} de ${totalPaginas}`,
        margemEsquerda,
        287
      );
    }

    pdf.save("dividas-leilao-pokemon.pdf");
  }

  const totalCartas = pessoas.reduce(
    (total, pessoa) =>
      total + pessoa.cartas.length,
    0
  );

  const totalGeral = pessoas.reduce(
    (total, pessoa) =>
      total + calcularTotalPessoa(pessoa),
    0
  );

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>ORGANIZADOR DE LEILÃO</h1>

          <p>
            Controle dos arremates do seu leilão Pokémon
          </p>
        </div>
      </header>

      <main className="container">
        <section className="resumo">
          <div className="resumo-card">
            <span>Pessoas</span>

            <strong>
              {pessoas.length}
            </strong>
          </div>

          <div className="resumo-card">
            <span>Cartas</span>

            <strong>
              {totalCartas}
            </strong>
          </div>

          <div className="resumo-card destaque">
            <span>Total geral</span>

            <strong>
              {formatarValor(totalGeral)}
            </strong>
          </div>
        </section>

        <div className="acoes-topo">
          <button
            className="btn-adicionar"
            onClick={adicionarPessoa}
          >
            + ADICIONAR PESSOA
          </button>
        </div>

        {pessoas.length === 0 && (
          <section className="vazio">
            <div className="vazio-icone">
              🃏
            </div>

            <h2>
              Nenhum arremate registrado
            </h2>

            <p>
              Adicione uma pessoa para começar
              a registrar as cartas do leilão.
            </p>

            <button
              className="btn-adicionar"
              onClick={adicionarPessoa}
            >
              + ADICIONAR PESSOA
            </button>
          </section>
        )}

        <section className="lista-pessoas">
          {pessoas.map((pessoa, indice) => {
            const totalPessoa =
              calcularTotalPessoa(pessoa);

            return (
              <article
                className="pessoa-card"
                key={pessoa.id}
              >
                <div className="pessoa-header">
                  <div className="pessoa-titulo">
                    <div className="avatar">
                      {indice + 1}
                    </div>

                    <input
                      type="text"
                      placeholder="Nome da pessoa"
                      value={pessoa.nome}
                      onChange={(e) =>
                        alterarNomePessoa(
                          pessoa.id,
                          e.target.value
                        )
                      }
                    />
                  </div>

                  <div className="pessoa-total">
                    <span>Total</span>

                    <strong>
                      {formatarValor(
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

                <div className="cartas">
                  <div className="cartas-titulo">
                    <span>Carta</span>

                    <span>
                      Valor do arremate
                    </span>

                    <span></span>
                  </div>

                  {pessoa.cartas.map(
                    (carta) => (
                      <div
                        className="carta-linha"
                        key={carta.id}
                      >
                        <input
                          type="text"
                          placeholder="Nome da carta"
                          value={carta.nome}
                          onChange={(e) =>
                            alterarCarta(
                              pessoa.id,
                              carta.id,
                              "nome",
                              e.target.value
                            )
                          }
                        />

                        <div className="valor-input">
                          <span>R$</span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0,00"
                            value={carta.valor}
                            onChange={(e) =>
                              alterarCarta(
                                pessoa.id,
                                carta.id,
                                "valor",
                                e.target.value
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
          })}
        </section>

        {pessoas.length > 0 && (
          <section className="rodape-total">
            <div>
              <span>
                TOTAL DO LEILÃO
              </span>

              <strong>
                {formatarValor(totalGeral)}
              </strong>
            </div>

            <button
              className="btn-pdf"
              onClick={gerarPDF}
            >
              📄 GERAR PDF
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;