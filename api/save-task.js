const { Octokit } = require("octokit");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  // Certifique-se de que a variável de ambiente GITHUB_TOKEN está configurada na Vercel
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error("Variável de ambiente GITHUB_TOKEN não definida!");
    return res.status(500).json({ error: "Variável de ambiente GITHUB_TOKEN não definida." });
  }

  const owner = "adirson52";
  const repo = "gtd_kamban";
  const path = "public/tasks.csv";

  const octokit = new Octokit({ auth: token });

  const { titulo, status, tags, data_limite, responsavel } = req.body;
  console.log("Dados recebidos:", req.body);

  try {
    // Obtém o conteúdo atual do CSV
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: "main"
    });
    console.log("Arquivo CSV obtido com sucesso.");

    // Converte o conteúdo de base64 para string e remove espaços extras
    const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8").trim();
    const linhas = currentContent.split("\n");
    const lastLine = linhas[linhas.length - 1];
    const lastId = parseInt(lastLine.split(",")[0]) || 0;
    const nextId = lastId + 1;
    console.log("Último ID:", lastId, "| Próximo ID:", nextId);

    // Cria uma nova linha para a nova tarefa
    const novaLinha = `\n${nextId},"${titulo}","","${status}","${tags}","${data_limite}","${responsavel}"`;
    const novoConteudo = currentContent + novaLinha;
    console.log("Novo conteúdo gerado para o CSV.");

    // Atualiza o arquivo com o novo conteúdo
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
    res.status(200).json({ message: "Tarefa adicionada com sucesso!" });
  } catch (error) {
    console.error("Erro ao salvar CSV:", error);
    res.status(500).json({ error: error.message });
  }
};
