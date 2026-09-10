# Branch consolidation — 10 September 2026

The single integration target is `main`. PR #31 merges `local/v0.9.0` directly into `main` and includes releases previously accumulated on chained release branches. The PR remains unmerged for the owner to accept.

Only `main` and `local/v0.9.0` remain as working branches after cleanup. Historical tips, including divergent local and remote tips, are preserved as annotated archive tags on GitHub. These are recovery checkpoints, not published releases.

The pre-existing uncommitted newsletter/reader work in `site/` was committed separately as `9926fe7`; it is an older implementation and is archived rather than overwriting its newer release equivalents. Generated-cache symlink entries in two old worktrees were also committed separately. Ignored dependencies, generated images, caches and local worktree directories remain on disk; they are not release source code.

Old worktrees are detached at their saved commits. The main `site/` checkout is switched to `local/v0.9.0` so future work starts from the consolidated version. `main` stays at the GitHub main tip until the PR is accepted.

## Recovery

Fetch the archive tags, then restore the desired snapshot into a new worktree:

```sh
git fetch origin --tags
git worktree add -b local/recovered-work ../recovered-work archive/2026-09-10/<commit-prefix>
```

## Saved references before cleanup

| Original reference | Commit | Archive tag |
| --- | --- | --- |
| `refs/heads/agent/v0-2-cloudflare-content` | `3da86d845793` | `archive/2026-09-10/3da86d845793` |
| `refs/heads/agent/v0-3-series-and-dates` | `3da86d845793` | `archive/2026-09-10/3da86d845793` |
| `refs/heads/content/ba-do-va-lieu-thuoc` | `a58cbcacb87c` | `archive/2026-09-10/a58cbcacb87c` |
| `refs/heads/local/substack-newsletter-banner` | `9926fe76cf78` | `archive/2026-09-10/9926fe76cf78` |
| `refs/heads/local/title-weight-pagespeed` | `c5cf63bb3612` | `archive/2026-09-10/c5cf63bb3612` |
| `refs/heads/local/v0.5.1-content-update` | `2d6a3e13cd5a` | `archive/2026-09-10/2d6a3e13cd5a` |
| `refs/heads/local/v0.5.2-topic-taxonomy` | `4e9898b43a32` | `archive/2026-09-10/4e9898b43a32` |
| `refs/heads/local/v0.5.3-mobile-header-motion` | `231d03fec562` | `archive/2026-09-10/231d03fec562` |
| `refs/heads/local/v0.5.4-global-surface-and-pensee` | `89a843bbac4b` | `archive/2026-09-10/89a843bbac4b` |
| `refs/heads/local/v0.5.5-content-update` | `8270b36dd359` | `archive/2026-09-10/8270b36dd359` |
| `refs/heads/local/v0.5.6-content-update` | `c6807dcb6f19` | `archive/2026-09-10/c6807dcb6f19` |
| `refs/heads/local/v0.6-google-analytics` | `1af1403701a8` | `archive/2026-09-10/1af1403701a8` |
| `refs/heads/local/v0.6.1-responsive-images` | `0250ce45dcf4` | `archive/2026-09-10/0250ce45dcf4` |
| `refs/heads/local/v0.6.2-newsletter` | `c27edefb1f1d` | `archive/2026-09-10/c27edefb1f1d` |
| `refs/heads/local/v0.6.3-reader-theme-seo` | `dc849fde7709` | `archive/2026-09-10/dc849fde7709` |
| `refs/heads/local/v0.6.4-loading-snippets` | `2bcf9d7c03f7` | `archive/2026-09-10/2bcf9d7c03f7` |
| `refs/heads/local/v0.6.4-newsletter-link` | `a25a0413e88a` | `archive/2026-09-10/a25a0413e88a` |
| `refs/heads/local/v0.6.5-footer` | `4c493c290eb5` | `archive/2026-09-10/4c493c290eb5` |
| `refs/heads/local/v0.7` | `609e25ff1c0d` | `archive/2026-09-10/609e25ff1c0d` |
| `refs/heads/local/v0.7.1` | `e250df032b41` | `archive/2026-09-10/e250df032b41` |
| `refs/heads/local/v0.7.2` | `a3915a56fa69` | `archive/2026-09-10/a3915a56fa69` |
| `refs/heads/local/v0.7.4` | `ea09733ab69e` | `archive/2026-09-10/ea09733ab69e` |
| `refs/heads/local/v0.7.5` | `f2b0a2d379f9` | `archive/2026-09-10/f2b0a2d379f9` |
| `refs/heads/local/v0.7.6` | `afdb89cd8ce6` | `archive/2026-09-10/afdb89cd8ce6` |
| `refs/heads/local/v0.7.6.1` | `cfb2d86f7c03` | `archive/2026-09-10/cfb2d86f7c03` |
| `refs/heads/local/v0.7.7` | `1de3e8c01224` | `archive/2026-09-10/1de3e8c01224` |
| `refs/heads/local/v0.8.0` | `6b64b048f21b` | `archive/2026-09-10/6b64b048f21b` |
| `refs/heads/local/v0.8.1` | `4900e6efaa2c` | `archive/2026-09-10/4900e6efaa2c` |
| `refs/heads/local/v0.9.0` | `78b8716426cb` | `archive/2026-09-10/78b8716426cb` |
| `refs/heads/main` | `726e343504e4` | `archive/2026-09-10/726e343504e4` |
| `refs/heads/release/v0-4` | `3da86d845793` | `archive/2026-09-10/3da86d845793` |
| `refs/heads/release/v0.4.1` | `6cd124c5454e` | `archive/2026-09-10/6cd124c5454e` |
| `refs/heads/release/v0.4.1-sidebar-and-essay-grid` | `f641d61d7e50` | `archive/2026-09-10/f641d61d7e50` |
| `refs/heads/release/v0.4.2-mobile-polish` | `db9f7394aaab` | `archive/2026-09-10/db9f7394aaab` |
| `refs/heads/release/v0.5-archive-pacing` | `8088c3b094a0` | `archive/2026-09-10/8088c3b094a0` |
| `refs/remotes/origin/agent/v0-2-cloudflare-content` | `e42d68acc6ff` | `archive/2026-09-10/e42d68acc6ff` |
| `refs/remotes/origin/agent/v0-3-series-and-dates` | `3da86d845793` | `archive/2026-09-10/3da86d845793` |
| `refs/remotes/origin/content/ba-do-va-lieu-thuoc` | `a58cbcacb87c` | `archive/2026-09-10/a58cbcacb87c` |
| `refs/remotes/origin/local/title-weight-pagespeed` | `afd877585f1e` | `archive/2026-09-10/afd877585f1e` |
| `refs/remotes/origin/local/v0.5.1-content-update` | `2d6a3e13cd5a` | `archive/2026-09-10/2d6a3e13cd5a` |
| `refs/remotes/origin/local/v0.5.2-topic-taxonomy` | `4e9898b43a32` | `archive/2026-09-10/4e9898b43a32` |
| `refs/remotes/origin/local/v0.5.3-mobile-header-motion` | `231d03fec562` | `archive/2026-09-10/231d03fec562` |
| `refs/remotes/origin/local/v0.5.4-global-surface-and-pensee` | `89a843bbac4b` | `archive/2026-09-10/89a843bbac4b` |
| `refs/remotes/origin/local/v0.5.5-content-update` | `d6d6a912f159` | `archive/2026-09-10/d6d6a912f159` |
| `refs/remotes/origin/local/v0.5.6-content-update` | `1846bb746fa7` | `archive/2026-09-10/1846bb746fa7` |
| `refs/remotes/origin/local/v0.6-google-analytics` | `1af1403701a8` | `archive/2026-09-10/1af1403701a8` |
| `refs/remotes/origin/local/v0.6.1-responsive-images` | `0250ce45dcf4` | `archive/2026-09-10/0250ce45dcf4` |
| `refs/remotes/origin/local/v0.6.2-newsletter` | `c27edefb1f1d` | `archive/2026-09-10/c27edefb1f1d` |
| `refs/remotes/origin/local/v0.6.3-reader-theme-seo` | `dc849fde7709` | `archive/2026-09-10/dc849fde7709` |
| `refs/remotes/origin/local/v0.6.4-loading-snippets` | `2bcf9d7c03f7` | `archive/2026-09-10/2bcf9d7c03f7` |
| `refs/remotes/origin/local/v0.6.4-newsletter-link` | `a25a0413e88a` | `archive/2026-09-10/a25a0413e88a` |
| `refs/remotes/origin/local/v0.6.5-footer` | `4c493c290eb5` | `archive/2026-09-10/4c493c290eb5` |
| `refs/remotes/origin/local/v0.7` | `49bd2b195ead` | `archive/2026-09-10/49bd2b195ead` |
| `refs/remotes/origin/local/v0.7.1` | `e250df032b41` | `archive/2026-09-10/e250df032b41` |
| `refs/remotes/origin/local/v0.7.2` | `a3915a56fa69` | `archive/2026-09-10/a3915a56fa69` |
| `refs/remotes/origin/local/v0.7.4` | `ae8792c53078` | `archive/2026-09-10/ae8792c53078` |
| `refs/remotes/origin/local/v0.7.5` | `f2b0a2d379f9` | `archive/2026-09-10/f2b0a2d379f9` |
| `refs/remotes/origin/local/v0.7.6` | `9f741725d9a6` | `archive/2026-09-10/9f741725d9a6` |
| `refs/remotes/origin/local/v0.7.6.1` | `cfb2d86f7c03` | `archive/2026-09-10/cfb2d86f7c03` |
| `refs/remotes/origin/local/v0.7.7` | `1de3e8c01224` | `archive/2026-09-10/1de3e8c01224` |
| `refs/remotes/origin/local/v0.8.0` | `6ef0ba793a3c` | `archive/2026-09-10/6ef0ba793a3c` |
| `refs/remotes/origin/local/v0.8.1` | `4900e6efaa2c` | `archive/2026-09-10/4900e6efaa2c` |
| `refs/remotes/origin/local/v0.9.0` | `a51fc31da3c8` | `archive/2026-09-10/a51fc31da3c8` |
| `refs/remotes/origin/main` | `e6d1cd59cba4` | `archive/2026-09-10/e6d1cd59cba4` |
| `refs/remotes/origin/release/v0.4.1-sidebar-and-essay-grid` | `f641d61d7e50` | `archive/2026-09-10/f641d61d7e50` |
| `refs/remotes/origin/release/v0.4.2-mobile-polish` | `4b08fe0b76fb` | `archive/2026-09-10/4b08fe0b76fb` |
| `refs/remotes/origin/release/v0.5-archive-pacing` | `8088c3b094a0` | `archive/2026-09-10/8088c3b094a0` |

## Future workflow

Create feature/release branches from current `main`, target `main` in every PR, and delete the feature branch after merge. Use release tags for version history rather than keeping a branch for every version. Cloudflare Workers Builds should select `main` as its production branch; this Git cleanup does not alter Cloudflare account settings.

