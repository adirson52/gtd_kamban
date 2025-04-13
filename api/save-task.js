const { Octokit } = require("octokit");

module.exports = async (req, res) => {
  // Permite apenas o método POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Obtém o token da variável de ambiente
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Variável de ambiente GITHUB_TOKEN não definida!");
    return res
      .status(500)
      .json({ error: "Variável de ambiente GITHUB_TOKEN não definida." });
  }

  // Configurações do repositório e arquivo
  const owner = "adirson52";
  const repo = "gtd_kamban";
  const path = "public/tasks.csv";

  // Instancia o Octokit com o token
  const octokit = new Octokit({ auth: token });

  // Extrai os dados do corpo da requisição
  const { titulo, status, tags, data_limite, responsavel } = req.body;
  console.log("Dados recebidos:", req.body);

  try {
    // Obtém o conteúdo atual do CSV do repositório
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: "main"
    });
    console.log("Arquivo CSV obtido com sucesso.");

    // Converte o conteúdo do CSV de base64 para string e remove espaços extras
    const currentContent = Buffer.from(fileData.content, "base64")
      .toString("utf-8")
      .trim();
    const linhas = currentContent.split("\n");
    const lastLine = linhas[linhas.length - 1];

    // Determina o último ID para calcular o próximo
    const lastId = parseInt(lastLine.split(",")[0], 10) || 0;
    const nextId = lastId + 1;
    console.log(`Último ID: ${lastId} | Próximo ID: ${nextId}`);

    // Cria a nova linha da tarefa (assegure que as vírgulas estejam corretamente posicionadas)
    const novaLinha = `\n${nextId},"${titulo}","","${status}","${tags}","${data_limite}","${responsavel}"`;
    const novoConteudo = currentContent + novaLinha;
    console.log("Novo conteúdo gerado para o CSV.");

    // Atualiza o arquivo CSV no repositório via commit
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Adiciona nova tarefa: ${titulo}`,
      content: Buffer.from(novoConteudo).toString("base64"),
      sha: fileData.sha,
      branch: "main"
    });
    console.log("Novo conteúdo commitado com sucesso.");

    return res.status(200).json({ message: "Tarefa adicionada com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar CSV:", error);
    return res.status(500).json({ error: error.message });
  }
};
