import { escapeHtml as safe, formatNumber, lifeState } from './contracts.js';

export const HISTORY_PAGE_SIZE = 10;
// A janela acessível continua limitada pelo contrato existente (90 coletas).
export function historyPage(points, requested = 1) {
  const ordered = points.map((point,index)=>({...point,index}))
    .filter(point=>Number.isFinite(Date.parse(point.observed_at)))
    .sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at)||b.index-a.index);
  const pages = Math.max(1, Math.ceil(ordered.length/HISTORY_PAGE_SIZE));
  const page = Math.min(pages,Math.max(1,Number.isInteger(requested)?requested:1));
  return {page,pages,total:ordered.length,rows:ordered.slice((page-1)*HISTORY_PAGE_SIZE,page*HISTORY_PAGE_SIZE)};
}
export function historyTable(points, requested, formatDate) {
  const result=historyPage(points,requested);
  return {...result,html:`<div class="table-scroll"><table class="ranking-table history-table"><caption class="sr-only">Valores das coletas, mais recentes primeiro</caption><thead><tr><th>Data</th><th>Kills</th><th>Estado</th></tr></thead><tbody>${result.rows.map(point=>`<tr><td>${safe(formatDate(point.observed_at))}</td><td>${formatNumber(point.kills_total)}</td><td>${lifeState(point.alive).label}</td></tr>`).join('')}</tbody></table></div><nav class="history-pagination" aria-label="Paginação das coletas"><button data-history-page="${result.page-1}" data-history-direction="previous" ${result.page===1?'disabled':''}>← Anterior</button><span role="status">Página ${result.page} de ${result.pages}<small>${result.total} coletas disponíveis</small></span><button data-history-page="${result.page+1}" data-history-direction="next" ${result.page===result.pages?'disabled':''}>Próxima →</button></nav>`};
}
