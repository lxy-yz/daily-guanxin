const STORAGE_KEY = "daily-guanxin:v1";

const kinds = {
  善: { className: "good", label: "善念" },
  恶: { className: "unwholesome", label: "恶念" },
  觉: { className: "aware", label: "觉察转念" },
  未明: { className: "unclear", label: "未明" },
};

const state = {
  records: loadRecords(),
  days: 7,
};

const els = {
  tabs: document.querySelectorAll(".range-tab"),
  summaryDays: document.querySelector("#summary-days"),
  summaryTotal: document.querySelector("#summary-total"),
  summaryAware: document.querySelector("#summary-aware"),
  summaryRatio: document.querySelector("#summary-ratio"),
  rangeLabel: document.querySelector("#range-label"),
  donutChart: document.querySelector("#donut-chart"),
  donutSvg: document.querySelector("#donut-svg"),
  donutTotal: document.querySelector("#donut-total"),
  donutLegend: document.querySelector("#donut-legend"),
  stackedTrend: document.querySelector("#stacked-trend"),
  trendNote: document.querySelector("#trend-note"),
  reviewDays: document.querySelector("#review-days"),
  emptyReview: document.querySelector("#empty-review"),
  copyReview: document.querySelector("#copy-review"),
};

const chartTooltip = document.createElement("div");
chartTooltip.id = "chart-tooltip";
chartTooltip.className = "chart-tooltip";
chartTooltip.setAttribute("role", "tooltip");
chartTooltip.hidden = true;
document.body.append(chartTooltip);
let tooltipTarget = null;

function hideChartTooltip() {
  tooltipTarget?.removeAttribute("aria-describedby");
  tooltipTarget?.classList.remove("chart-selected");
  tooltipTarget = null;
  chartTooltip.hidden = true;
}

function bindChartTooltip(element, text) {
  element.setAttribute("aria-label", text);
  const show = () => {
    hideChartTooltip();
    tooltipTarget = element;
    element.classList.add("chart-selected");
    element.setAttribute("aria-describedby", chartTooltip.id);
    chartTooltip.textContent = text;
    chartTooltip.hidden = false;
    const target = element.getBoundingClientRect();
    const tip = chartTooltip.getBoundingClientRect();
    const left = Math.max(8, Math.min(target.left + target.width / 2 - tip.width / 2, window.innerWidth - tip.width - 8));
    const top = target.top >= tip.height + 16
      ? target.top - tip.height - 8
      : Math.min(target.bottom + 8, window.innerHeight - tip.height - 8);
    chartTooltip.style.left = `${left}px`;
    chartTooltip.style.top = `${Math.max(8, top)}px`;
  };
  element.addEventListener("click", show);
  element.addEventListener("focus", show);
  element.addEventListener("blur", () => {
    if (tooltipTarget === element) hideChartTooltip();
  });
  element.addEventListener("pointerenter", (event) => {
    if (event.pointerType === "mouse") show();
  });
  element.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse" && tooltipTarget === element) hideChartTooltip();
  });
}

document.addEventListener("pointerdown", (event) => {
  if (tooltipTarget && !tooltipTarget.contains(event.target)) hideChartTooltip();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideChartTooltip();
});
document.addEventListener("scroll", hideChartTooltip, true);
window.addEventListener("resize", hideChartTooltip);

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getRangeRecords() {
  const records = Object.values(state.records).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const latestRecord = records.find((record) => record.entries.length > 0);
  const anchor = latestRecord ? fromDateKey(latestRecord.date) : new Date();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - state.days + 1);

  return records
    .filter((record) => {
      if (state.days >= 3650) return true;
      const date = fromDateKey(record.date);
      return date >= start && date <= anchor;
    })
}

function getRangeDateKeys() {
  const records = Object.values(state.records).sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const latestRecord = records.find((record) => record.entries.length > 0);
  const anchor = latestRecord ? fromDateKey(latestRecord.date) : new Date();

  if (state.days >= 3650) {
    return records
      .filter((record) => record.entries.length > 0)
      .map((record) => record.date)
      .reverse();
  }

  return Array.from({ length: state.days }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - (state.days - 1 - index));
    return toDateKey(date);
  });
}

function countKind(records, kind) {
  return records.reduce(
    (total, record) =>
      total + record.entries.filter((entry) => entry.kind === kind).length,
    0,
  );
}

function getCounts(records) {
  return Object.fromEntries(
    Object.keys(kinds).map((kind) => [kind, countKind(records, kind)]),
  );
}

function renderSummary(records, counts) {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const ratio = total === 0 ? 0 : Math.round((counts["觉"] / total) * 100);
  els.summaryDays.textContent = records.filter(
    (record) => record.entries.length > 0,
  ).length;
  els.summaryTotal.textContent = total;
  els.summaryAware.textContent = counts["觉"];
  els.summaryRatio.textContent = `${ratio}%`;
  els.rangeLabel.textContent =
    state.days >= 3650 ? "全部记录" : `最近 ${state.days} 天`;
}

function renderDistribution(counts) {
  const colors = {
    善: "#23895f",
    恶: "#eb4d4b",
    觉: "#b88022",
    未明: "#8f9aa5",
  };
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  els.donutTotal.textContent = total;
  els.donutSvg.innerHTML = "";
  if (total === 0) {
    const circle = createSvgElement("circle", {
      cx: 50,
      cy: 50,
      r: 48,
      fill: "#eeeeee",
    });
    els.donutSvg.append(circle);
  } else {
    let cursor = -90;
    Object.entries(kinds).forEach(([kind, config]) => {
      const value = counts[kind];
      if (value === 0) return;
      const degrees = (value / total) * 360;
      const end = cursor + degrees;
      const segment = createSvgElement("path", {
        d: describeDonutSegment(50, 50, 48, 30, cursor, end),
        fill: colors[kind],
        tabindex: 0,
      });
      const ratio = Math.round((value / total) * 100);
      bindChartTooltip(segment, `${config.label}：${value}，占 ${ratio}%`);
      els.donutSvg.append(segment);
      cursor = end;
    });
  }

  els.donutLegend.innerHTML = "";
  Object.entries(kinds).forEach(([kind, config]) => {
    const value = counts[kind];
    const ratio = total === 0 ? 0 : Math.round((value / total) * 100);
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-dot ${config.className}"></span>
      <span>${config.label}</span>
      <strong>${value}</strong>
      <em>${ratio}%</em>
    `;
    els.donutLegend.append(row);
  });
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSegment(cx, cy, outerRadius, innerRadius, start, end) {
  const adjustedEnd = end - start >= 360 ? start + 359.99 : end;
  const largeArcFlag = adjustedEnd - start > 180 ? 1 : 0;
  const outerStart = polarToCartesian(cx, cy, outerRadius, start);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, adjustedEnd);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, adjustedEnd);
  const innerStart = polarToCartesian(cx, cy, innerRadius, start);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function renderStackedTrend() {
  const dateKeys = getRangeDateKeys();
  const recordsByDate = new Map(
    Object.values(state.records).map((record) => [record.date, record]),
  );
  const maxTotal = Math.max(
    ...dateKeys.map((dateKey) => {
      const record = recordsByDate.get(dateKey);
      return record ? record.entries.length : 0;
    }),
    1,
  );
  const colorClassByKind = {
    善: "good",
    恶: "unwholesome",
    觉: "aware",
    未明: "unclear",
  };

  els.stackedTrend.innerHTML = "";
  dateKeys.forEach((dateKey) => {
    const record = recordsByDate.get(dateKey) || { entries: [] };
    const counts = getCounts([record]);
    const total = record.entries.length;
    const day = document.createElement("article");
    day.className = "trend-day";

    const bar = document.createElement("div");
    bar.className = "stacked-bar";
    bar.style.height = `${Math.max((total / maxTotal) * 112, total > 0 ? 8 : 0)}px`;

    Object.keys(kinds).forEach((kind) => {
      if (counts[kind] === 0) return;
      const segment = document.createElement("span");
      segment.className = `stack-segment ${colorClassByKind[kind]}`;
      segment.style.flexGrow = counts[kind];
      segment.tabIndex = 0;
      bindChartTooltip(segment, `${dateKey}｜${kinds[kind].label}：${counts[kind]}，占 ${Math.round((counts[kind] / total) * 100)}%`);
      bar.append(segment);
    });

    const label = document.createElement("span");
    label.className = "trend-date";
    label.textContent = dateKey.slice(5).replace("-", "/");
    day.append(bar, label);
    els.stackedTrend.append(day);
  });

  renderTrendNote(dateKeys, recordsByDate);
}

function renderTrendNote(dateKeys, recordsByDate) {
  const activeDays = dateKeys
    .map((dateKey) => recordsByDate.get(dateKey))
    .filter((record) => record && record.entries.length > 0);

  if (activeDays.length < 2) {
    els.trendNote.textContent = "记录多几天后，这里会显示变化提示。";
    return;
  }

  const first = activeDays[0];
  const last = activeDays[activeDays.length - 1];
  const firstRatio = first.entries.length
    ? countKind([first], "觉") / first.entries.length
    : 0;
  const lastRatio = last.entries.length
    ? countKind([last], "觉") / last.entries.length
    : 0;
  const delta = Math.round((lastRatio - firstRatio) * 100);

  if (delta > 0) {
    els.trendNote.textContent = `这段时间，转念占比上升了 ${delta}% 。可继续观察：是什么帮助你停了一下？`;
  } else if (delta < 0) {
    els.trendNote.textContent = `这段时间，转念占比下降了 ${Math.abs(delta)}% 。可轻轻看见，不必急着调整。`;
  } else {
    els.trendNote.textContent = "这段时间，转念占比大致平稳。可以继续看念头从何处反复来。";
  }
}

function renderDays(records) {
  els.reviewDays.innerHTML = "";
  els.emptyReview.hidden = records.some((record) => record.entries.length > 0);

  records
    .filter((record) => record.entries.length > 0)
    .forEach((record) => {
      const counts = getCounts([record]);
      const reflection = record.reflection || {};
      const article = document.createElement("article");
      article.className = "review-day-card";
      article.innerHTML = `
        <header>
          <strong>${record.date}</strong>
          <span>${record.entries.length} 念</span>
        </header>
        <p class="day-summary">善 ${counts["善"]} · 恶 ${counts["恶"]} · 觉 ${counts["觉"]} · 未明 ${counts["未明"]}</p>
        <dl>
          <dt>随喜</dt>
          <dd>${escapeHtml(reflection.rejoice || "未写")}</dd>
          <dt>失去自在</dt>
          <dd>${escapeHtml(reflection.bondage || "未写")}</dd>
          <dt>看见而未跟</dt>
          <dd>${escapeHtml(reflection.witness || "未写")}</dd>
        </dl>
      `;
      els.reviewDays.append(article);
    });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReviewText() {
  const records = getRangeRecords().filter((record) => record.entries.length > 0);
  const counts = getCounts(records);
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const label = state.days >= 3650 ? "全部回顾" : `${state.days} 日回顾`;

  return [
    `每日观心 ${label}`,
    `有记录天数：${records.length}`,
    `念头记录：${total}`,
    `善念：${counts["善"]}`,
    `恶念：${counts["恶"]}`,
    `觉察转念：${counts["觉"]}`,
    `未明：${counts["未明"]}`,
    "",
    ...records.map((record) => {
      const dayCounts = getCounts([record]);
      return `${record.date}｜善 ${dayCounts["善"]} 恶 ${dayCounts["恶"]} 觉 ${dayCounts["觉"]} 未明 ${dayCounts["未明"]}`;
    }),
  ].join("\n");
}

async function copyReview() {
  await navigator.clipboard.writeText(buildReviewText());
  showToast("已复制回顾");
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
  hideChartTooltip();
  state.records = loadRecords();
  const records = getRangeRecords();
  const counts = getCounts(records);
  renderSummary(records, counts);
  renderDistribution(counts);
  renderStackedTrend();
  renderDays(records);
  els.tabs.forEach((tab) => {
    tab.classList.toggle("active", Number(tab.dataset.days) === state.days);
  });
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    state.days = Number(tab.dataset.days);
    render();
  });
});

els.copyReview.addEventListener("click", copyReview);

window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY) render();
});

window.addEventListener("focus", render);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});

render();
