/** Initialize offscreen controls once they approach view, including after Astro swaps. */
export function whenVisible(selector: string, initialize: () => void) {
  let observer: IntersectionObserver | undefined;
  const observe = () => {
    observer?.disconnect();
    const element = document.querySelector(selector);
    if (!element) return;
    if (!('IntersectionObserver' in window)) return initialize();
    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        initialize();
      },
      { rootMargin: '400px' },
    );
    observer.observe(element);
  };
  document.addEventListener('astro:before-swap', () => observer?.disconnect());
  document.addEventListener('astro:page-load', observe);
  observe();
}
