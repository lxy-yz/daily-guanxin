const STORAGE_KEY = "daily-guanxin:v1";

const kinds = {
  善: { countId: "count-good", className: "good", label: "善念" },
  恶: { countId: "count-unwholesome", className: "unwholesome", label: "恶念" },
  觉: { countId: "count-aware", className: "aware", label: "觉察转念" },
  未明: { countId: "count-unclear", className: "unclear", label: "未明" },
};

const quotes = [
  "吾日三省吾身。",
  "过则勿惮改。",
  "念起即觉，觉之即无。",
  "不怕念起，只怕觉迟。",
  "境缘无好丑，好丑起于心。",
  "一念放下，万般自在。",
  "知幻即离，不作方便。",
  "心不随境转，即得大自在。",
];

const state = {
  records: loadRecords(),
  selectedDate: toDateKey(new Date()),
  awareOnly: false,
  lastSavedAt: null,
  saveStatusTimer: null,
};

const els = {
  dateInput: document.querySelector("#date-input"),
  markButtons: document.querySelectorAll(".mark-button"),
  pendingNote: document.querySelector("#pending-note"),
  dailyQuote: document.querySelector("#daily-quote"),
  dotRow: document.querySelector("#dot-row"),
  ledger: document.querySelector("#ledger"),
  entryCount: document.querySelector("#entry-count"),
  emptyLedger: document.querySelector("#empty-ledger"),
  clearDay: document.querySelector("#clear-day"),
  copyToday: document.querySelector("#copy-today"),
  copyFull: document.querySelector("#copy-full"),
  filterAware: document.querySelector("#filter-aware"),
  entryTemplate: document.querySelector("#entry-template"),
  saveState: document.querySelector("#save-state"),
  reflections: {
    rejoice: document.querySelector("#rejoice"),
    bondage: document.querySelector("#bondage"),
    witness: document.querySelector("#witness"),
  },
};

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRecords() {
  showSavingState();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
  } catch {
    window.clearTimeout(state.saveStatusTimer);
    state.lastSavedAt = null;
    els.saveState.textContent = "未保存 · 浏览器无法保存记录";
    showToast("暂未保存，请先复制日记备份");
    return false;
  }
  state.lastSavedAt = new Date();
  updateSavedState();
  scheduleSavedStateRefresh();
  return true;
}

function showSavingState() {
  els.saveState.textContent = "保存中...";
}

function updateSavedState() {
  if (!state.lastSavedAt) {
    els.saveState.textContent = "尚未保存";
    return;
  }

  els.saveState.textContent = `已保存 · ${formatSavedTime(state.lastSavedAt)}`;
}

function formatSavedTime(savedAt) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - savedAt.getTime()) / 1000));
  if (diffSeconds < 10) return "刚刚";
  if (diffSeconds < 60) return `${diffSeconds} 秒前`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(savedAt);
}

function scheduleSavedStateRefresh() {
  window.clearTimeout(state.saveStatusTimer);
  state.saveStatusTimer = window.setTimeout(() => {
    updateSavedState();
    scheduleSavedStateRefresh();
  }, 10000);
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function getRecord(dateKey = state.selectedDate) {
  if (!state.records[dateKey]) {
    state.records[dateKey] = {
      date: dateKey,
      entries: [],
      reflection: {
        rejoice: "",
        bondage: "",
        witness: "",
      },
    };
  }
  return state.records[dateKey];
}

function getQuote(dateKey) {
  const digits = dateKey.replaceAll("-", "");
  const sum = [...digits].reduce((total, char) => total + Number(char), 0);
  return quotes[sum % quotes.length];
}

function createEntryId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  // IDs identify local entries; they are not authentication tokens.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function addEntry(kind) {
  const note = els.pendingNote.value.trim();
  const record = getRecord();
  record.entries.unshift({
    id: createEntryId(),
    kind,
    time: formatTime(new Date()),
    note,
  });
  els.pendingNote.value = "";
  const saved = saveRecords();
  render();
  if (saved) {
    showToast(state.awareOnly && kind !== "觉"
      ? `${kinds[kind].label}已记录 · 当前只看转念`
      : `已记录${kinds[kind].label}`);
  }
}

function deleteEntry(id) {
  const record = getRecord();
  record.entries = record.entries.filter((entry) => entry.id !== id);
  saveRecords();
  render();
}

function updateReflection(key, value) {
  getRecord().reflection[key] = value;
  saveRecords();
}

function renderCounters(record) {
  Object.entries(kinds).forEach(([kind, config]) => {
    const count = record.entries.filter((entry) => entry.kind === kind).length;
    document.querySelector(`#${config.countId}`).textContent = count;
  });
}

function renderDots(record) {
  els.dotRow.innerHTML = "";
  record.entries
    .slice()
    .reverse()
    .forEach((entry, index) => {
      const dot = document.createElement("span");
      dot.className = `mind-dot ${kinds[entry.kind].className}`;
      if (entry.kind === "觉" && index % 2 === 1) dot.classList.add("diamond");
      dot.title = `${kinds[entry.kind].label} ${entry.time}`;
      els.dotRow.append(dot);
    });
}

function getVisibleEntries(record) {
  if (!state.awareOnly) return record.entries;
  return record.entries.filter((entry) => entry.kind === "觉");
}

function renderLedger(record) {
  const entries = getVisibleEntries(record);
  els.ledger.innerHTML = "";
  els.entryCount.textContent = `${record.entries.length} 条记录`;
  els.emptyLedger.hidden = entries.length > 0;
  els.filterAware.classList.toggle("active", state.awareOnly);

  entries.forEach((entry) => {
    const row = els.entryTemplate.content.firstElementChild.cloneNode(true);
    const dot = row.querySelector(".entry-dot");
    const kind = row.querySelector(".entry-kind");
    const note = row.querySelector(".entry-note");
    const time = row.querySelector("time");
    const deleteButton = row.querySelector(".delete-entry");
    const config = kinds[entry.kind];

    dot.classList.add(config.className);
    kind.textContent = config.label;
    note.textContent = entry.note || "";
    time.textContent = entry.time;
    deleteButton.addEventListener("click", () => deleteEntry(entry.id));
    els.ledger.append(row);
  });
}

function renderReflections(record) {
  Object.entries(els.reflections).forEach(([key, field]) => {
    field.value = record.reflection[key] || "";
  });
}

function buildTodayText(includeReflection = false) {
  const record = getRecord();
  const counts = Object.fromEntries(
    Object.keys(kinds).map((kind) => [
      kind,
      record.entries.filter((entry) => entry.kind === kind).length,
    ]),
  );
  const lines = [
    `每日观心 ${record.date}`,
    `善念：${counts["善"]}`,
    `恶念：${counts["恶"]}`,
    `觉察转念：${counts["觉"]}`,
    `未明：${counts["未明"]}`,
    "",
    ...record.entries
      .slice()
      .reverse()
      .map((entry, index) => {
        const note = entry.note ? ` ${entry.note}` : "";
        return `${index + 1}. [${entry.kind}] ${entry.time}${note}`;
      }),
    "",
    `今日一省：${getQuote(record.date)}`,
  ];

  if (includeReflection) {
    lines.push(
      "",
      "今天最值得随喜的一念是什么？",
      record.reflection.rejoice || "",
      "",
      "今天哪个念头让我失去了自在？",
      record.reflection.bondage || "",
      "",
      "有没有哪一刻，看见念头而没有跟着走？",
      record.reflection.witness || "",
    );
  }

  return lines.join("\n");
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
  showToast("已复制");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.append(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 180);
  }, 1200);
}

function render() {
  const record = getRecord();
  els.dateInput.value = state.selectedDate;
  els.dailyQuote.textContent = `「${getQuote(state.selectedDate)}」`;
  renderCounters(record);
  renderDots(record);
  renderLedger(record);
  renderReflections(record);
}

els.dateInput.addEventListener("change", (event) => {
  state.selectedDate = event.target.value || toDateKey(new Date());
  render();
});

els.markButtons.forEach((button) => {
  button.addEventListener("click", () => addEntry(button.dataset.kind));
});

els.filterAware.addEventListener("click", () => {
  state.awareOnly = !state.awareOnly;
  render();
});

els.copyToday.addEventListener("click", () => {
  copyText(buildTodayText(false));
});

els.copyFull.addEventListener("click", () => {
  copyText(buildTodayText(true));
});

els.clearDay.addEventListener("click", () => {
  const record = getRecord();
  if (record.entries.length === 0) return;
  const ok = window.confirm("清空今日念头流水？晚课文字会保留。");
  if (!ok) return;
  record.entries = [];
  saveRecords();
  render();
});

Object.entries(els.reflections).forEach(([key, field]) => {
  field.addEventListener("input", (event) => {
    updateReflection(key, event.target.value);
  });
});

render();
