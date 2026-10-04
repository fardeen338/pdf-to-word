import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

// Ensure PDF.js worker is always configured
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

export function initPdfToWord() {
  const container = $("tool-pdf-to-word");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const fileName = container.querySelector(".file-name");
  const fileSizeTag = container.querySelector(".file-size-tag");
  const filePagesTag = container.querySelector(".file-pages-tag");
  const removeBtn = container.querySelector(".remove-btn");
  const convertBtn = container.querySelector(".convert-btn");
  const progressPanel = container.querySelector(".progress-panel");
  const progressBar = container.querySelector(".progress-bar");
  const progressPercent = container.querySelector(".progress-percent");
  const statusText = container.querySelector(".status-text");
  const pageStatus = container.querySelector(".page-status");
  const message = container.querySelector(".message");
  const exportOptions = container.querySelector(".export-options");
  const exportMdBtn = container.querySelector(".export-md-btn");
  const exportTxtBtn = container.querySelector(".export-txt-btn");
  const copyTextBtn = container.querySelector(".copy-text-btn");
  const previewCanvas = container.querySelector(".pdf-preview-canvas");
  const pageRangeInput = container.querySelector(".page-range-input");
  const customRangeInputWrap = container.querySelector(".custom-range-wrap");
  const optHeadings = container.querySelector(".opt-headings");
  const optPageBreaks = container.querySelector(".opt-page-breaks");
  const optStyles = container.querySelector(".opt-styles");

  let selectedFile = null;
  let currentPdfDoc = null;
  let lastExtractedSections = null;

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove("hidden");
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "message hidden";
  }

  function setProgress(percent, status, detail = "") {
    progressPanel.classList.remove("hidden");
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    progressBar.style.width = `${safePercent}%`;
    progressPercent.textContent = `${safePercent}%`;
    statusText.textContent = status;
    pageStatus.textContent = detail;
  }

  function resetState() {
    selectedFile = null;
    currentPdfDoc = null;
    lastExtractedSections = null;
    fileInput.value = "";
    filePanel.classList.add("hidden");
    progressPanel.classList.add("hidden");
    exportOptions.classList.add("hidden");
    convertBtn.disabled = true;
    clearMessage();

    if (previewCanvas) {
      const ctx = previewCanvas.getContext("2d");
      ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  }

  async function renderThumbnail(pdf) {
    try {
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 120 / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      previewCanvas.width = scaledViewport.width;
      previewCanvas.height = scaledViewport.height;

      const ctx = previewCanvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
    } catch (e) {
      console.warn("Thumbnail failed:", e);
    }
  }

  async function selectFile(file) {
    resetState();
    if (!file) return;

    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      showMessage("Please upload a valid PDF document.");
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileSizeTag.textContent = formatBytes(file.size);
    filePagesTag.textContent = "Loading...";
    filePanel.classList.remove("hidden");

    try {
      const arrayBuffer = await file.arrayBuffer();
      currentPdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      filePagesTag.textContent = `${currentPdfDoc.numPages} Page${currentPdfDoc.numPages === 1 ? "" : "s"}`;
      convertBtn.disabled = false;
      await renderThumbnail(currentPdfDoc);
    } catch (err) {
      showMessage(`Could not open PDF: ${err.message}`);
    }
  }

  function parsePageRange(rangeStr, totalPages) {
    if (!rangeStr || !rangeStr.trim()) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set();
    rangeStr.split(",").forEach((part) => {
      const trimmed = part.trim();
      if (trimmed.includes("-")) {
        const [start, end] = trimmed.split("-").map((x) => parseInt(x, 10));
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(totalPages, Math.max(start, end));
          for (let p = min; p <= max; p++) pages.add(p);
        }
      } else {
        const p = parseInt(trimmed, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) pages.add(p);
      }
    });
    const res = Array.from(pages).sort((a, b) => a - b);
    return res.length > 0 ? res : Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  function groupPageItems(items) {
    const rows = [];
    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const fontName = (item.fontName || "").toLowerCase();
      const isBold = /bold|black|heavy|w[789]|demi/i.test(fontName);
      const isItalic = /italic|oblique/i.test(fontName);
      const transform = item.transform || [];
      const fontSize = Math.abs(Number(transform[0] || transform[3] || 12)) || 12;
      const x = Number(transform[4] || 0);
      const y = Number(transform[5] || 0);

      const parsed = { text: item.str, isBold, isItalic, fontSize, x, y };
      let row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, fontSize * 0.35));
      if (!row) {
        row = { y, items: [] };
        rows.push(row);
      }
      row.items.push(parsed);
    }

    rows.sort((a, b) => b.y - a.y);

    return rows.map((row) => {
      row.items.sort((a, b) => a.x - b.x);
      const runs = [];
      let fullText = "";

      for (const item of row.items) {
        const prev = fullText.slice(-1);
        const needsSpace = fullText && prev !== " " && !/^[,.;:!?%)\]}]/.test(item.text) && !/[([{]$/.test(prev);
        const runText = (needsSpace ? " " : "") + item.text;
        fullText += runText;
        runs.push({ text: runText, isBold: item.isBold, isItalic: item.isItalic, fontSize: item.fontSize });
      }

      const trimmed = fullText.trim();
      const maxFontSize = Math.max(...row.items.map((x) => x.fontSize));
      const isBullet = /^[•–\-\*\u2022\u25CF\u25CB\u25AA]\s+/.test(trimmed);

      return { text: trimmed, runs, fontSize: maxFontSize, isBullet };
    }).filter((r) => r.text);
  }

  async function convert() {
    if (!currentPdfDoc || !selectedFile) return;
    clearMessage();
    convertBtn.disabled = true;

    try {
      setProgress(5, "Reading pages...", "Extracting text layers...");
      const totalPages = currentPdfDoc.numPages;
      const isCustom = container.querySelector('input[name="p2w-range"]:checked')?.value === "custom";
      const targetPages = isCustom ? parsePageRange(pageRangeInput.value, totalPages) : Array.from({ length: totalPages }, (_, i) => i + 1);

      const sections = [];
      for (let i = 0; i < targetPages.length; i++) {
        const pageNum = targetPages[i];
        setProgress(10 + (i / targetPages.length) * 75, `Processing Page ${pageNum} of ${totalPages}`, "Formatting typography...");
        const page = await currentPdfDoc.getPage(pageNum);
        const content = await page.getTextContent();
        sections.push({ pageNumber: pageNum, rows: groupPageItems(content.items) });
        await new Promise(requestAnimationFrame);
      }

      lastExtractedSections = sections;
      setProgress(88, "Building Word Document (.docx)...", "Assembling document structure...");

      if (!window.docx) throw new Error("docx.js library not loaded.");
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } = window.docx;

      const children = [];
      sections.forEach((section, idx) => {
        if (optPageBreaks.checked && idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

        if (section.rows.length === 0) {
          children.push(new Paragraph({ children: [new TextRun({ text: `[Page ${section.pageNumber} contains no extractable text]`, italics: true })] }));
          return;
        }

        for (const row of section.rows) {
          const isH1 = optHeadings.checked && row.fontSize >= 20 && row.text.length < 80;
          const isH2 = optHeadings.checked && row.fontSize >= 15 && row.fontSize < 20 && row.text.length < 90;

          const runs = row.runs.map((r) => new TextRun({
            text: r.text,
            bold: optStyles.checked ? (r.isBold || isH1 || isH2) : (isH1 || isH2),
            italics: optStyles.checked ? r.isItalic : false,
            size: Math.max(18, Math.min(38, Math.round(r.fontSize * 2)))
          }));

          children.push(new Paragraph({
            children: runs,
            heading: isH1 ? HeadingLevel.HEADING_1 : isH2 ? HeadingLevel.HEADING_2 : undefined,
            bullet: row.isBullet ? { level: 0 } : undefined,
            spacing: { after: isH1 || isH2 ? 140 : 80 }
          }));
        }
      });

      const doc = new Document({ creator: "PDF Suite", title: safeFileName(selectedFile.name), sections: [{ children }] });
      const blob = await Packer.toBlob(doc);

      downloadBlob(blob, `${safeFileName(selectedFile.name)}.docx`);
      setProgress(100, "Done!", "Word document downloaded.");
      showMessage("Converted successfully! You can also export other formats below.", "success");
      exportOptions.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showMessage(`Conversion failed: ${err.message}`);
      progressPanel.classList.add("hidden");
    } finally {
      convertBtn.disabled = false;
    }
  }

  // Event bindings
  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => selectFile(e.target.files[0]));
  removeBtn.addEventListener("click", resetState);
  convertBtn.addEventListener("click", convert);
  setupDragDrop(dropZone, selectFile);

  container.querySelectorAll('input[name="p2w-range"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      customRangeInputWrap.classList.toggle("hidden", e.target.value !== "custom");
    });
  });

  exportMdBtn.addEventListener("click", () => {
    if (!lastExtractedSections) return;
    let md = `# ${safeFileName(selectedFile.name)}\n\n`;
    lastExtractedSections.forEach((sec, idx) => {
      if (idx > 0) md += `\n---\n*Page ${sec.pageNumber}*\n\n`;
      sec.rows.forEach((r) => md += `${r.text}\n\n`);
    });
    downloadBlob(new Blob([md], { type: "text/markdown" }), `${safeFileName(selectedFile.name)}.md`);
  });

  exportTxtBtn.addEventListener("click", () => {
    if (!lastExtractedSections) return;
    let txt = "";
    lastExtractedSections.forEach((sec) => sec.rows.forEach((r) => txt += `${r.text}\n`));
    downloadBlob(new Blob([txt], { type: "text/plain" }), `${safeFileName(selectedFile.name)}.txt`);
  });

  copyTextBtn.addEventListener("click", async () => {
    if (!lastExtractedSections) return;
    let txt = "";
    lastExtractedSections.forEach((sec) => sec.rows.forEach((r) => txt += `${r.text}\n`));
    await navigator.clipboard.writeText(txt);
    showMessage("Text copied to clipboard!", "success");
  });
}
