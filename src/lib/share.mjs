// Shared URL construction is independent of query strings and reading anchors.
export function shareTargets(title, canonical) {
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: canonical })}`,
    x: `https://twitter.com/intent/tweet?${new URLSearchParams({ text: title, url: canonical })}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${canonical}`)}`,
  };
}
