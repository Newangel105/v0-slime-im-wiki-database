import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const OFFICIAL_HOST = "api.ten-sura-m.wfs.games"
const OFFICIAL_US_HOST = "api-us.ten-sura-m.wfs.games"
const ANNOUNCEMENT_MODAL_BG = "#fff7e8"

function injectCssAndBackButtonPatch(html: string, origin: string, proxyOrigin: string) {
  const patch = `
    <base href="${origin}/" />

    <style id="slime-announcement-fixes">
      html,
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: ${ANNOUNCEMENT_MODAL_BG} !important;
        overflow-x: hidden !important;
        width: 100% !important;
        min-width: 0 !important;
      }

      * {
        box-sizing: border-box;
      }

      body::before,
      body::after {
        background: ${ANNOUNCEMENT_MODAL_BG} !important;
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
        background: ${ANNOUNCEMENT_MODAL_BG} !important;
      }

      ::-webkit-scrollbar-thumb {
        background: #0f8b9a !important;
        border-radius: 8px;
        border: 2px solid ${ANNOUNCEMENT_MODAL_BG};
      }
    </style>

    <script>
      (() => {
        let lockedGutter = null;
        const proxyOrigin = ${JSON.stringify(proxyOrigin)};
        const allowedHosts = new Set([${JSON.stringify(OFFICIAL_HOST)}, ${JSON.stringify(OFFICIAL_US_HOST)}]);
        const modalBg = ${JSON.stringify(ANNOUNCEMENT_MODAL_BG)};

        const applyAnnouncementChrome = () => {
          document.documentElement.style.setProperty("background", modalBg, "important");
          if (document.body) {
            document.body.style.setProperty("background", modalBg, "important");
          }
        };

        const rewriteAnnouncementLinks = () => {
          const links = Array.from(document.querySelectorAll("a[href]"));

          for (const link of links) {
            const href = link.getAttribute("href");
            if (!href || href.startsWith(proxyOrigin + "/api/recruit-article")) continue;

            let url;

            try {
              url = new URL(href, window.location.href);
            } catch {
              continue;
            }

            if (!allowedHosts.has(url.host) || !url.pathname.startsWith("/web/announcement")) continue;

            const proxiedHref = proxyOrigin + "/api/recruit-article?src=" + encodeURIComponent(url.toString());
            link.href = proxiedHref;
            link.setAttribute("href", proxiedHref);
            link.target = "_self";
            link.setAttribute("target", "_self");
            link.rel = "";
          }
        };

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
          applyAnnouncementChrome();
          rewriteAnnouncementLinks();
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

        new MutationObserver(() => {
          patchLeftGutter();
        }).observe(document.documentElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["href", "style", "class"],
        });
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

  const isAnnouncementPage = url.pathname === "/web/announcement" || url.pathname.startsWith("/web/announcement/")

  if (url.protocol !== "https:" || ![OFFICIAL_HOST, OFFICIAL_US_HOST].includes(url.host) || !isAnnouncementPage) {
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
  const patchedHtml = injectCssAndBackButtonPatch(html, url.origin, request.nextUrl.origin)

  return new NextResponse(patchedHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  })
}
