/* =====================  UTILIDADES  ===================== */
function exibirAviso(txt) {
  const el = document.getElementById("aviso");
  el.textContent = txt;
  el.style.display = "block";
}
function salvarTarefaLocal(t) {
  const arr = JSON.parse(localStorage.getItem("tarefasCache") || "[]");
  arr.push(t);
  localStorage.setItem("tarefasCache", JSON.stringify(arr));
}
function salvarEdicaoLocal(t) {
  let arr = JSON.parse(localStorage.getItem("tarefasCacheEditar") || "[]");
  arr = arr.filter((x) => x.id !== t.id);
  arr.push(t);
  localStorage.setItem("tarefasCacheEditar", JSON.stringify(arr));
}

/* =====================  CARREGA CSV E RENDERIZA  ===================== */
async function carregarTarefas() {
  try {
    // tenta /tasks.csv ou /public/tasks.csv
    let res = await fetch("/tasks.csv");
    if (!res.ok) res = await fetch("/public/tasks.csv");
    if (!res.ok) throw new Error("CSV não encontrado");
    const texto = await res.text();
    const linhas = texto.trim().split("\n").slice(1);

    const tarefasCSV = linhas.map((l) => {
      const campos =
        l.match(/(".*?"|[^",]+)(?=,|$)/g)?.map((c) => c.replace(/^"|"$/g, "").trim()) || [];
      while (campos.length < 7) campos.push("");
      const [id, titulo, descricao, status, tags, data_limite, responsavel] = campos;
      return { id, titulo, descricao, status, tags, data_limite, responsavel };
    });

    if (tarefasCSV.length > 0) localStorage.removeItem("tarefasCache");
    const cache = JSON.parse(localStorage.getItem("tarefasCache") || "[]");
    const tarefas = tarefasCSV.length ? tarefasCSV : cache;

    const colunas = {
      urgente: "Urgente",
      nao_iniciado: "Não Iniciado",
      em_andamento: "Em Andamento",
      com_data: "Com Data",
    };

    const kanban = document.getElementById("kanban");
    kanban.innerHTML = "";

    Object.entries(colunas).forEach(([key, label]) => {
      const col = document.createElement("div");
      col.className = "column";
      col.innerHTML = `<h2>${label}</h2>`;

      tarefas
        .filter((t) => t.status === key)
        .forEach((t) => {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `
            <div class="title">${t.titulo}</div>
            <div class="tags">
              ${t.tags
                .split(";")
                .filter(Boolean)
                .map((tag) => `<span class="tag">${tag}</span>`)
                .join("")}
            </div>
            ${t.data_limite ? `<div class="date">Prazo: ${t.data_limite}</div>` : ""}
            <button class="edit-btn">Editar</button>
            <button class="done-btn">Done</button>
          `;

          card.querySelector(".edit-btn").onclick = () => abrirModalEdicao(t);
          card.querySelector(".done-btn").onclick = () => confirmarConclusao(t);

          col.appendChild(card);
        });

      kanban.appendChild(col);
    });
  } catch (err) {
    console.error(err);
  }
}

/* =====================  NOVA TAREFA  ===================== */
document.getElementById("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const nova = {
    id: Date.now().toString(),
    titulo: f.titulo.value,
    descricao: "",
    status: f.status.value,
    tags: f.tags.value,
    data_limite: f.data_limite.value,
    responsavel: f.responsavel.value,
  };
  try {
    const r = await fetch("/api/save-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nova),
    });
    const j = await r.json();
    alert(j.message || j.error);

    f.reset();
    exibirAviso("Sua tarefa foi enviada, aguarde atualização...");
    salvarTarefaLocal(nova);
    carregarTarefas();

    setTimeout(() => {
      localStorage.removeItem("tarefasCache");
      location.reload();
    }, 10000);
  } catch (err) {
    console.error(err);
  }
});

/* =====================  MODAL EDIÇÃO  ===================== */
function abrirModalEdicao(t) {
  document.getElementById("overlay").style.display = "block";
  const m = document.getElementById("editModal");
  m.style.display = "block";
  const f = document.getElementById("editForm");
  Object.keys(t).forEach((k) => {
    if (f[k]) f[k].value = t[k];
  });
}
function fecharModal() {
  document.getElementById("overlay").style.display = "none";
  document.getElementById("editModal").style.display = "none";
}
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const edit = {
    id: f.id.value,
    titulo: f.titulo.value,
    descricao: f.descricao.value,
    status: f.status.value,
    tags: f.tags.value,
    data_limite: f.data_limite.value,
    responsavel: f.responsavel.value,
  };
  try {
    const r = await fetch("/api/edit-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    const j = await r.json();
    alert(j.message || j.error);

    fecharModal();
    exibirAviso("Sua edição foi enviada, aguarde atualização...");
    salvarEdicaoLocal(edit);
    carregarTarefas();

    setTimeout(() => {
      localStorage.removeItem("tarefasCacheEditar");
      location.reload();
    }, 10000);
  } catch (err) {
    console.error(err);
  }
});

/* =====================  CONCLUIR TAREFA  ===================== */
async function confirmarConclusao(tarefa) {
  const ok = confirm(`Marcar a tarefa "${tarefa.titulo}" como concluída?`);
  if (!ok) return;

  try {
    const res = await fetch("/api/complete-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: tarefa.id,
        concluded_by: tarefa.responsavel || "freitas",
      }),
    });
    const json = await res.json();
    alert(json.message || json.error);

    carregarTarefas();          // atualiza o quadro
  } catch (err) {
    console.error("Erro ao concluir:", err);
    alert("Falha ao concluir tarefa.");
  }
}

/* =====================  MODAL CONCLUÍDAS  ===================== */
const modal = document.getElementById("modal-concluidas");
const lista = document.getElementById("lista-concluidas");

document.getElementById("btn-concluidas").onclick = async () => {
  modal.style.display = "flex";
  lista.innerHTML = "<p>Carregando...</p>";
  try {
    let r = await fetch("/concluded.csv");
    if (!r.ok) r = await fetch("/public/concluded.csv");
    if (!r.ok) throw new Error("CSV concluído não encontrado");
    const txt = await r.text();
    const linhas = txt.trim().split("\n").slice(1);

    if (!linhas.length) {
      lista.innerHTML = "<p>Nenhuma tarefa concluída ainda.</p>";
      return;
    }

    lista.innerHTML = "";
    linhas.forEach((l) => {
      const cols = l
        .split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/)
        .map((c) => c.replace(/\"/g, ""));
      const [id, titulo, desc, status, tags, data_limite, concluded_at, concluded_by] =
        cols;

      const div = document.createElement("div");
      div.className = "card";
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between">
          <span class="title">${titulo}</span>
          <span class="date">${new Date(concluded_at).toLocaleDateString()}</span>
        </div>
        <div class="tags">
          ${tags
            .split(";")
            .filter(Boolean)
            .map((t) => `<span class="tag">${t}</span>`)
            .join("")}
        </div>
        <div class="date">Concluído por: ${concluded_by || "-"}</div>
      `;
      lista.appendChild(div);
    });
  } catch (err) {
    lista.innerHTML = '<p style="color:red">Erro ao carregar concluídas.</p>';
    console.error(err);
  }
};

document.getElementById("close-modal").onclick = () => (modal.style.display = "none");
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.style.display = "none";
});

/* =====================  INICIALIZA  ===================== */
carregarTarefas();
