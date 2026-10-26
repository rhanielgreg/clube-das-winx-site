export function footerHtml() {
  return `<a class="brand" href="/index.html"><img src="/assets/winx-zomboid-profile.webp" alt=""><span><small>PROJECT ZOMBOID · COMUNIDADE BRASILEIRA</small><b>CLUBE DAS WINX.</b></span></a><nav aria-label="Rodapé"><a href="/index.html#servidor">Servidor</a><a href="/ranking">Campeonato</a><a href="/memorial">Memorial</a><a href="/admin">Administração</a></nav><small>© 2026 Clube das Winx · Desenvolvido por Greg e Emmanuel / Galera Nerd</small>`;
}
export function mountFooter(root = document) {
  root.querySelectorAll('[data-site-footer]').forEach(node => { node.innerHTML = footerHtml(); });
}
