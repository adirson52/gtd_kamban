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
    return res.status(500).json({ error: "Token não configurado." });
  }

  const owner = "adirson52";
  const repo = "gtd_kamban";
  // Caminhos dos arquivos CSV
  const tasksPath = "public/tasks.csv";
  const concludedPath = "public/concluded.csv";

  const octokit = new Octokit({ auth: token });

  // Dados que chegam no POST para conclusão
  // Espera: { id, concluded_by } (o id da tarefa a concluir e quem concluiu)
  const { id, concluded_by } = req.body;
  if (!id) {
    return res.status(400).json({ error: "ID da tarefa não fornecido." });
  }
  console.log("Dados para conclusão:", req.body);

  try {
    // 1. Obter o conteúdo atual do tasks.csv
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: tasksPath,
      ref: "main"
    });
    const tasksContent = Buffer.from(fileData.content, "base64").toString("utf-8").trim();
    const linhasTasks = tasksContent.split("\n");

    // Guarda o cabeçalho
    const header = linhasTasks[0];
    // Processa as linhas (excluindo o cabeçalho) para encontrar a tarefa a ser concluída
    let tarefaEncontrada = null;
    const novasLinhasTasks = linhasTasks.filter((linha, index) => {
      if (index === 0) return true; // cabeçalho
      const cols = linha.split(",");
      if (cols[0] === id) {
        // Guarda os dados da tarefa, para ser usada no CSV de concluídos
        tarefaEncontrada = {
          id: cols[0],
          titulo: cols[1],
          descricao: cols[2],
          status_inicial: cols[3],
          tags: cols[4],
          data_limite: cols[5],
          responsavel_inicial: cols[6]
        };
        // Excluímos essa linha do tasks.csv
        return false;
      }
      return true;
    });

    if (!tarefaEncontrada) {
      return res.status(404).json({ error: "Tarefa não encontrada no tasks.csv." });
    }
    console.log("Tarefa encontrada:", tarefaEncontrada);

    // 2. Atualiza o tasks.csv (removendo a tarefa concluída)
    const novoTasksContent = novasLinhasTasks.join("\n");
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: tasksPath,
      message: `Remove tarefa ${id} (concluída)`,
      content: Buffer.from(novoTasksContent).toString("base64"),
      sha: fileData.sha,
      branch: "main"
    });
    console.log("tasks.csv atualizado (tarefa removida).");

    // 3. Preparar os dados para o concluded.csv
    // Cabeçalho sugerido para concluded.csv:
    // id,titulo,descricao,status_inicial,tags,data_limite,concluded_at,concluded_by,responsavel_inicial
    const concludedAt = new Date().toISOString();
    // Cria a linha de conclusão
    const novaLinhaConcluded = `${tarefaEncontrada.id},"${tarefaEncontrada.titulo}","${tarefaEncontrada.descricao}",` +
      `"${tarefaEncontrada.status_inicial}","${tarefaEncontrada.tags}","${tarefaEncontrada.data_limite}",` +
      `"${concludedAt}","${concluded_by || tarefaEncontrada.responsavel_inicial}","${tarefaEncontrada.responsavel_inicial}"`;

    let concludedContent = "";
    let shaConcluded = null;
    try {
      // Tenta obter o conteúdo atual do concluded.csv
      const { data: fileDataConcluded } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: concludedPath,
        ref: "main"
      });
      concludedContent = Buffer.from(fileDataConcluded.content, "base64").toString("utf-8").trim();
      shaConcluded = fileDataConcluded.sha;
      // Adiciona a nova linha
      concludedContent += "\n" + novaLinhaConcluded;
    } catch (err) {
      // Se o arquivo não existir, cria-o com cabeçalho
      console.log("concluded.csv não encontrado, criando novo arquivo.");
      const headerConcluded = "id,titulo,descricao,status_inicial,tags,data_limite,concluded_at,concluded_by,responsavel_inicial";
      concludedContent = headerConcluded + "\n" + novaLinhaConcluded;
    }

    // 4. Atualiza ou cria o concluded.csv
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: concludedPath,
      message: `Adiciona tarefa ${id} ao concluded.csv`,
      content: Buffer.from(concludedContent).toString("base64"),
      sha: shaConcluded, // se for novo arquivo, sha pode ser undefined
      branch: "main"
    });
    console.log("concluded.csv atualizado com a nova tarefa.");

    return res.status(200).json({ message: "Tarefa marcada como concluída com sucesso!" });
  } catch (error) {
    console.error("Erro ao concluir tarefa:", error);
    return res.status(500).json({ error: error.message });
  }
};
