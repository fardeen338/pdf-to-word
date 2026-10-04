import { $ } from "./js/utils.js";
import { initPdfToWord } from "./js/pdf-to-word.js";
import { initPdfToImage } from "./js/pdf-to-image.js";
import { initImagesToPdf } from "./js/images-to-pdf.js";
import { initMergePdf } from "./js/merge-pdf.js";
import { initOrganizePdf } from "./js/organize-pdf.js";
import { initWatermarkPdf } from "./js/watermark-pdf.js";
import { initWordToPdf } from "./js/word-to-pdf.js";

/* ==========================================================================
   1. Theme Management (Light / Dark)
   ========================================================================== */
function initTheme() {
  const themeToggle = $("themeToggle");
  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

  document.documentElement.setAttribute("data-theme", initialTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
    });
  }
}

/* ==========================================================================
   2. Router & View Switcher
   ========================================================================== */
const VALID_TOOLS = [
  "pdf-to-word",
  "pdf-to-image",
  "images-to-pdf",
  "merge-pdf",
  "organize-pdf",
  "watermark-pdf",
  "word-to-pdf"
];

function switchView(toolId) {
  const hubView = $("hub-view");
  const toolContainers = document.querySelectorAll(".tool-view");
  const backToHubBtn = $("backToHubBtn");
  const currentToolTitle = $("currentToolTitle");

  if (!toolId || !VALID_TOOLS.includes(toolId)) {
    // Show Hub Dashboard
    if (hubView) hubView.classList.remove("hidden");
    toolContainers.forEach((el) => el.classList.add("hidden"));
    if (backToHubBtn) backToHubBtn.classList.add("hidden");
    if (currentToolTitle) currentToolTitle.textContent = "All-in-One PDF Suite";
    window.location.hash = "";
  } else {
    // Show specific tool
    if (hubView) hubView.classList.add("hidden");
    toolContainers.forEach((el) => {
      if (el.id === `tool-${toolId}`) {
        el.classList.remove("hidden");
        const heading = el.querySelector(".tool-title")?.textContent;
        if (currentToolTitle && heading) currentToolTitle.textContent = heading;
      } else {
        el.classList.add("hidden");
      }
    });
    if (backToHubBtn) backToHubBtn.classList.remove("hidden");
    window.location.hash = `#${toolId}`;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  // Bind all hub tool cards
  document.querySelectorAll("[data-tool]").forEach((card) => {
    card.addEventListener("click", () => {
      const toolId = card.getAttribute("data-tool");
      switchView(toolId);
    });
  });

  // Bind back to hub button & logo click
  const backToHubBtn = $("backToHubBtn");
  if (backToHubBtn) {
    backToHubBtn.addEventListener("click", () => switchView(null));
  }

  const logoBtn = $("logoBtn");
  if (logoBtn) {
    logoBtn.addEventListener("click", () => switchView(null));
  }

  // Handle URL hash changes
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "");
    switchView(hash);
  });

  // Check initial hash on load
  const initialHash = window.location.hash.replace("#", "");
  switchView(initialHash);
}

/* ==========================================================================
   3. App Initialization
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initNavigation();

  // Initialize tool engines
  initPdfToWord();
  initPdfToImage();
  initImagesToPdf();
  initMergePdf();
  initOrganizePdf();
  initWatermarkPdf();
  initWordToPdf();
});
