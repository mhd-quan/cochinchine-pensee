import { foldSearchText } from '~/lib/searchText';
import { searchPublication } from '~/lib/searchQuery';
type SearchData = { url: string; meta: { title?: string; description?: string }; excerpt: string };
type SearchHit = { id: string; data: () => Promise<SearchData> };
type SearchEngine = {
  options: (options: { ranking: { metaWeights: Record<string, number> } }) => Promise<void>;
  search: (query: string) => Promise<{ results: SearchHit[] }>;
};
let engine: Promise<SearchEngine> | undefined;

function loadEngine() {
  // The index and WASM stay off the critical path, including on the search page.
  const url = '/pagefind/pagefind.js';
  engine ??= import(/* @vite-ignore */ url)
    .then(async (pagefind: SearchEngine) => {
      await pagefind.options({
        ranking: { metaWeights: { title: 5, title_alias: 5, aliases: 1 } },
      });
      return pagefind;
    })
    .catch((error) => {
      engine = undefined;
      throw error;
    });
  return engine;
}

class PublicationSearch extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready) return;
    this.dataset.ready = 'true';
    const lifecycle = new AbortController();
    this.lifecycle = lifecycle;
    const { signal } = lifecycle;
    const input = this.querySelector<HTMLInputElement>('input')!;
    const form = this.querySelector('form')!;
    const status = this.querySelector<HTMLElement>('.search-status')!;
    const list = this.querySelector<HTMLOListElement>('ol')!;
    const more = this.querySelector<HTMLButtonElement>('.search-more')!;
    const pageSize = 10;
    let hits: SearchHit[] = [];
    let shown = 0;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    let composing = false;

    const append = async (ticket: number) => {
      more.disabled = true;
      const data = await Promise.all(hits.slice(shown, shown + pageSize).map((hit) => hit.data()));
      if (ticket !== generation || signal.aborted) return;
      const fragment = document.createDocumentFragment();
      for (const result of data) {
        const destination = new URL(result.url, location.origin);
        if (destination.origin !== location.origin) continue;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = destination.pathname.replace(/\/$/, '') + destination.hash;
        const title = document.createElement('h3');
        title.textContent = result.meta.title ?? 'Bài viết';
        const excerpt = document.createElement('p');
        // Pagefind returns highlighted HTML; copy only text and <mark> nodes.
        const titleMatches = foldSearchText(result.meta.title ?? '').includes(
          foldSearchText(input.value.trim()),
        );
        const snippet =
          titleMatches && result.meta.description ? result.meta.description : result.excerpt;
        const parsed = new DOMParser().parseFromString(snippet, 'text/html');
        for (const child of parsed.body.childNodes) {
          if (child instanceof Element && child.tagName === 'MARK') {
            const mark = document.createElement('mark');
            mark.textContent = child.textContent;
            excerpt.append(mark);
          } else excerpt.append(document.createTextNode(child.textContent ?? ''));
        }
        link.append(title, excerpt);
        item.append(link);
        fragment.append(item);
      }
      list.append(fragment);
      shown += data.length;
      more.disabled = false;
      more.hidden = shown >= hits.length;
    };

    const run = async () => {
      clearTimeout(timer);
      const ticket = ++generation;
      const query = input.value.trim().slice(0, 200);
      more.hidden = true;
      list.replaceChildren();
      shown = 0;
      const url = new URL(location.href);
      query ? url.searchParams.set('q', query) : url.searchParams.delete('q');
      history.replaceState(history.state, '', url);
      if (!query) {
        status.textContent = '';
        this.removeAttribute('aria-busy');
        return;
      }
      status.textContent = 'Đang tìm…';
      this.setAttribute('aria-busy', 'true');
      try {
        const pagefind = await loadEngine();
        const results = await searchPublication(pagefind, query);
        if (ticket !== generation || signal.aborted) return;
        hits = results;
        await append(ticket);
        if (ticket !== generation || signal.aborted) return;
        status.textContent = hits.length
          ? `${hits.length} kết quả`
          : `Không tìm thấy kết quả cho “${query}”. Thử từ khóa khác.`;
      } catch {
        if (ticket !== generation || signal.aborted) return;
        list.replaceChildren();
        status.textContent = 'Chưa tải được tìm kiếm. Nhấn Tìm kiếm để thử lại.';
      } finally {
        if (ticket === generation) this.removeAttribute('aria-busy');
      }
    };

    const queue = () => {
      clearTimeout(timer);
      generation++; // Invalidate a slow response as soon as the query changes.
      this.removeAttribute('aria-busy');
      if (!composing) timer = setTimeout(run, 180);
    };
    input.addEventListener('input', queue, { signal });
    input.addEventListener(
      'compositionstart',
      () => {
        composing = true;
        clearTimeout(timer);
        generation++;
      },
      { signal },
    );
    input.addEventListener(
      'compositionend',
      () => {
        composing = false;
        queue();
      },
      { signal },
    );
    form.addEventListener(
      'submit',
      (event) => {
        event.preventDefault();
        void run();
      },
      { signal },
    );
    more.addEventListener(
      'click',
      async () => {
        const ticket = generation;
        const firstNew = shown;
        try {
          await append(ticket);
          if (ticket === generation) list.children[firstNew]?.querySelector('a')?.focus();
        } catch {
          if (ticket === generation) {
            more.disabled = false;
            status.textContent = 'Chưa tải được kết quả. Thử lại.';
          }
        }
      },
      { signal },
    );
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    input.value = new URLSearchParams(location.search).get('q')?.slice(0, 200) ?? '';
    if (input.value) void run();
  }
  lifecycle?: AbortController;
  disconnectedCallback() {
    this.lifecycle?.abort();
    delete this.dataset.ready;
  }
}
if (!customElements.get('publication-search'))
  customElements.define('publication-search', PublicationSearch);
