const { Octokit } = require("octokit");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = process.env.GITHUB_TOKEN; 
  if (!token) {
    console.error("Variável GITHUB_TOKEN não definida!");
    return res.status(500).json({ error: "Token não configurado." });
  }

  const owner = "adirson52";   // Ajuste para o seu usuário
  const repo = "gtd_kamban";   // Ajuste para o seu repositório
  const path = "public/tasks.csv";

  const octokit = new Octokit({ auth: token });

  // Dados que chegam do corpo do POST para edição
  const { id, titulo, descricao, status, tags, data_limite, responsavel } = req.body;
  console.log("Editando tarefa:", req.body);

  try {
    // 1. Carrega o CSV existente
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner, repo, path, ref: "main"
    });
    const currentContent = Buffer.from(fileData.content, "base64").toString("utf-8").trim();
    const linhas = currentContent.split("\n");
    const header = linhas[0];  // cabeçalho

    // 2. Mapeia as linhas, procurando pela que tem o ID informado
    //    Formato no CSV: id,titulo,descricao,status,tags,data_limite,responsavel
    const novasLinhas = linhas.map((linha, index) => {
      if (index === 0) return linha; // pula cabeçalho
      const colunas = linha.split(",");
      // colunas[0] deve ser o ID
      if (colunas[0] === id) {
        // substitui essa linha pelos novos valores
        return `${id},"${titulo}","${descricao}","${status}","${tags}","${data_limite}","${responsavel}"`;
      } else {
        return linha; // linha intacta
      }
    });

    const novoConteudo = novasLinhas.join("\n");

    // 3. Commita o arquivo atualizado no GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Edita tarefa ${id}: ${titulo}`,
      content: Buffer.from(novoConteudo).toString("base64"),
      sha: fileData.sha,
      branch: "main"
    });

    console.log("Tarefa editada com sucesso:", id);
    return res.status(200).json({ message: "Tarefa editada com sucesso!" });
  } catch (error) {
    console.error("Erro ao editar CSV:", error);
    res.status(500).json({ error: error.message });
  }
};
