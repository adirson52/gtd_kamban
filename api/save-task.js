const { Octokit } = require("octokit");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const token = "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";
  const owner = "adirson52";
  const repo = "gtd_kamban";
  const path = "público/tarefas.csv";

  const octokit = new Octokit({ auth: token });

  const { titulo, status, tags, data_limite, responsavel } = req.body;

  try {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: "main"
    });

    const content = Buffer.from(fileData.content, "base64").toString("utf-8");
    const linhas = content.trim().split("\n");
    const nextId = parseInt(linhas[linhas.length - 1].split(",")[0]) + 1;

    const novaLinha = `\n${nextId},"${titulo}","","${status}","${tags}","${data_limite}","${responsavel}"`;
    const novoConteudo = content + novaLinha;

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message: `Adiciona nova tarefa: ${titulo}`,
      content: Buffer.from(novoConteudo).toString("base64"),
      sha: fileData.sha,
      branch: "main"
    });

    res.status(200).json({ message: "Tarefa adicionada com sucesso!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
