"""
Produces a print-optimised copy of the submission page for Chrome's
--print-to-pdf.

The shareable page is theme-aware and interactive; a printed page is neither.
This strips the theme toggle, pins the light palette (a dark background wastes
ink and reads badly on paper), and adds page-break rules so a table or a section
heading never straddles two pages.
"""

import io
import re
import sys

src, dst = sys.argv[1], sys.argv[2]
s = io.open(src, encoding="utf-8").read()

# Drop the toggle button and its script — nothing to toggle on paper.
s = re.sub(r'<button class="toggle".*?</button>', "", s, flags=re.S)
s = re.sub(r"<script>.*?</script>", "", s, flags=re.S)

print_css = """
<style>
  /* Pin the light palette: the dark theme is for screens. */
  :root, :root[data-theme="dark"], :root[data-theme="light"] {
    --ground: #FFFFFF;
    --panel: #FFFFFF;
    --panel-2: #F4F1EA;
    --rule: rgba(32, 26, 12, 0.16);
    --rule-firm: rgba(32, 26, 12, 0.30);
    --ink: #14100A;
    --ink-2: rgba(20, 16, 10, 0.78);
    --ink-3: rgba(20, 16, 10, 0.55);
    --accent: #7A5A0E;
    --accent-soft: rgba(166, 124, 17, 0.10);
    --ok: #0F5733;
    --ok-soft: rgba(15, 87, 51, 0.10);
    --wait: #7A4E00;
    --wait-soft: rgba(122, 78, 0, 0.10);
    --gap: #8E1F3C;
    --gap-soft: rgba(142, 31, 60, 0.10);
    --shadow: none;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #FFFFFF; --panel: #FFFFFF; --panel-2: #F4F1EA;
      --rule: rgba(32,26,12,.16); --rule-firm: rgba(32,26,12,.30);
      --ink: #14100A; --ink-2: rgba(20,16,10,.78); --ink-3: rgba(20,16,10,.55);
      --accent: #7A5A0E; --accent-soft: rgba(166,124,17,.10);
      --ok: #0F5733; --ok-soft: rgba(15,87,51,.10);
      --wait: #7A4E00; --wait-soft: rgba(122,78,0,.10);
      --gap: #8E1F3C; --gap-soft: rgba(142,31,60,.10);
      --shadow: none;
    }
  }

  @page { size: A4; margin: 16mm 14mm; }

  body { font-size: 10.5pt; line-height: 1.62; }
  .wrap { max-width: none; padding: 0; }
  .rule-top { display: none; }

  header { padding-top: 0; }
  h1 { font-size: 22pt; }
  .thesis { font-size: 12pt; }
  h2 { font-size: 14pt; }
  h3 { font-size: 11pt; }

  /* Keep structures whole across page boundaries. */
  section { break-inside: auto; margin-top: 26px; }
  h2, h3 { break-after: avoid; }
  .scroll, .board, .metrics, .facts, pre, .note { break-inside: avoid; }
  tr, .req, .metric { break-inside: avoid; }
  ol.flow li { break-inside: avoid; }

  .scroll { overflow: visible; }
  table { min-width: 0; width: 100%; table-layout: fixed; }
  th, td { padding: 6px 9px; font-size: 8.8pt; word-break: break-word; }
  .addr { font-size: 7.4pt; }
  a { color: var(--accent); text-decoration: underline; }

  .metrics { grid-template-columns: repeat(5, 1fr); }
  .metric .v { font-size: 15pt; }

  footer { margin-top: 30px; }

  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Headless Chrome does not reliably resolve a CJK fallback from a webfont
     alone — without a locally installed face first in the stack, every Chinese
     glyph silently drops out of the PDF. Windows ships JhengHei/MingLiU, so
     name them explicitly rather than trusting the generic families. */
  body, p, td, th, li, .thesis, .fact .v, .req .t, .req .d, .metric .k, .note {
    font-family: "Microsoft JhengHei", "Noto Sans TC", "PingFang TC",
                 "Microsoft YaHei", system-ui, sans-serif;
  }
  h1, h2, .thesis {
    font-family: "Noto Serif TC", "PMingLiU", "MingLiU", "Microsoft JhengHei",
                 Georgia, serif;
  }
  h3, .fact .k, .eyebrow, .kicker { font-family: "Microsoft JhengHei", sans-serif; }
  .mono, code, pre, .addr, td.num, .metric .v, .chip, th {
    font-family: "IBM Plex Mono", Consolas, "Courier New", monospace;
  }
</style>
"""

s = s.replace("</style>", "</style>" + print_css, 1)
io.open(dst, "w", encoding="utf-8").write(s)
print(f"wrote {dst}")
