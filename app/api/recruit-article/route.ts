import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// The official announcement feed/articles are served from the regional API hosts.
// The feed (list) page lives at  <host>/web/announcement?language=N  and an
// individual article at  <host>/web/announcement/<id>?...  — accept both.
const OFFICIAL_HOSTS = new Set([
  "api.ten-sura-m.wfs.games",
  "api-us.ten-sura-m.wfs.games",
  "api-eu.ten-sura-m.wfs.games",
  "api-ap.ten-sura-m.wfs.games",
])

function injectCssAndBackButtonPatch(html: string, origin: string) {
  const patch = `
    <base href="${origin}/" />

    <style id="slime-announcement-fixes">
      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: #1b1a18 !important;
        overflow-x: hidden !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      * {
        box-sizing: border-box;
      }

      body::before,
      body::after {
        background: #1b1a18 !important;
      }

      .backBtn,
      .btnBack,
      .returnBtn,
      .back-button,
      .back_button,
      button[aria-label="Back"],
      a[aria-label="Back"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      [data-slime-gutter-patched="1"] {
        max-width: none !important;
      }

      ::-webkit-scrollbar {
        width: 12px;
        height: 12px;
      }

      ::-webkit-scrollbar-track {
        background: #1b1a18 !important;
      }

      ::-webkit-scrollbar-thumb {
        background: #8f8f8f !important;
        border-radius: 8px;
        border: 2px solid #1b1a18;
      }
    </style>

    <script>
      (() => {
        let lockedGutter = null;

        const isElementVisible = (el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            rect.width > 2 &&
            rect.height > 2
          );
        };

        const removeBackButton = () => {
          const nodes = Array.from(document.querySelectorAll("a, button"));

          for (const el of nodes) {
            if (!isElementVisible(el)) continue;

            const rect = el.getBoundingClientRect();

            const text = [
              el.textContent || "",
              el.getAttribute("aria-label") || "",
              el.getAttribute("title") || "",
              el.id || "",
              typeof el.className === "string" ? el.className : "",
            ]
              .join(" ")
              .toLowerCase();

            const nearTopLeft =
              rect.left <= 120 &&
              rect.top <= 120 &&
              rect.width <= 170 &&
              rect.height <= 170;

            const looksLikeBack =
              /(^|[\\s_-])back($|[\\s_-])/.test(text) ||
              /(^|[\\s_-])return($|[\\s_-])/.test(text);

            // The official page back control is a small top-left button. Do not
            // remove normal article links/buttons unless they identify as back/return.
            if (looksLikeBack || (nearTopLeft && rect.width <= 110 && rect.height <= 110)) {
              el.remove();
            }
          }
        };

        const detectContentGutter = () => {
          const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
          const candidates = Array.from(
            document.querySelectorAll("main, article, section, header, footer, div, table")
          );

          let best = 0;
          let bestScore = -Infinity;

          for (const el of candidates) {
            if (!isElementVisible(el)) continue;

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (style.position === "fixed") continue;
            if (rect.top < -20 || rect.top > window.innerHeight * 1.5) continue;
            if (rect.left < 16 || rect.left > 140) continue;
            if (rect.width < viewportWidth * 0.45) continue;

            // Prefer a wide container near the top, but allow body-section bars too.
            const rightGap = Math.abs(viewportWidth - rect.right);
            const score = rect.width - rightGap * 0.35 - rect.top * 0.05;

            if (score > bestScore) {
              bestScore = score;
              best = Math.round(rect.left);
            }
          }

          if (best < 16 || best > 140) return 0;
          return best;
        };

        const hasPatchedAncestor = (el) => {
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (parent.dataset && parent.dataset.slimeGutterPatched === "1") return true;
            parent = parent.parentElement;
          }
          return false;
        };

        const patchLeftGutter = () => {
          removeBackButton();

          const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
          const gutter = lockedGutter || detectContentGutter();

          if (!gutter) return;
          lockedGutter = gutter;
          document.documentElement.style.setProperty("--slime-left-gutter", gutter + "px");

          const blocks = Array.from(
            document.querySelectorAll("main, article, section, header, footer, div, table")
          );

          for (const el of blocks) {
            if (!isElementVisible(el)) continue;
            if (el.dataset.slimeGutterPatched === "1") continue;
            if (hasPatchedAncestor(el)) continue;

            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            if (style.position === "fixed") continue;
            if (rect.left < gutter - 6 || rect.left > gutter + 24) continue;
            if (rect.width < viewportWidth * 0.42) continue;

            el.dataset.slimeGutterPatched = "1";
            el.style.setProperty("margin-left", "-" + gutter + "px", "important");
            el.style.setProperty("padding-left", "0px", "important");
            el.style.setProperty("max-width", "none", "important");
            el.style.setProperty("width", "calc(100% + " + gutter + "px)", "important");
          }
        };

        window.addEventListener("DOMContentLoaded", patchLeftGutter);
        window.addEventListener("load", patchLeftGutter);
        window.addEventListener("resize", () => {
          lockedGutter = null;
          for (const el of Array.from(document.querySelectorAll('[data-slime-gutter-patched="1"]'))) {
            el.dataset.slimeGutterPatched = "";
            el.style.removeProperty("margin-left");
            el.style.removeProperty("padding-left");
            el.style.removeProperty("max-width");
            el.style.removeProperty("width");
          }
          setTimeout(patchLeftGutter, 50);
        });

        setTimeout(patchLeftGutter, 50);
        setTimeout(patchLeftGutter, 250);
        setTimeout(patchLeftGutter, 750);
        setTimeout(patchLeftGutter, 1500);
      })();
    </script>
  `

  let patched = html.replace(
    /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
    "",
  )

  patched = patched.replace(/<base[^>]*>/gi, "")

  if (patched.includes("</head>")) {
    return patched.replace("</head>", `${patch}</head>`)
  }

  return `${patch}${patched}`
}

export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src")

  if (!src) {
    return new NextResponse("Missing src", { status: 400 })
  }

  let url: URL

  try {
    url = new URL(src)
  } catch {
    return new NextResponse("Invalid src", { status: 400 })
  }

  if (
    url.protocol !== "https:" ||
    !OFFICIAL_HOSTS.has(url.host) ||
    !url.pathname.startsWith("/web/announcement")
  ) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const upstream = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      "user-agent": "Mozilla/5.0",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  })

  if (!upstream.ok) {
    return new NextResponse(`Announcement fetch failed: ${upstream.status}`, {
      status: upstream.status,
    })
  }

  const html = await upstream.text()
  const patchedHtml = injectCssAndBackButtonPatch(html, url.origin)

  return new NextResponse(patchedHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  })
}
