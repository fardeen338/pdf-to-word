import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

// Ensure PDF.js worker is always configured
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

export function initOrganizePdf() {
  const container = $("tool-organize-pdf");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const fileName = container.querySelector(".file-name");
  const removeBtn = container.querySelector(".remove-btn");
  const pagesGrid = container.querySelector(".pages-grid");
  const rotateAllBtn = container.querySelector(".rotate-all-btn");
  const resetPagesBtn = container.querySelector(".reset-pages-btn");
  const saveBtn = container.querySelector(".save-btn");
  const splitBtn = container.querySelector(".split-btn");
  const message = container.querySelector(".message");

  let selectedFile = null;
  let originalPdfBytes = null;
  let pageStates = [];

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove("hidden");
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "message hidden";
  }

  function reset() {
    selectedFile = null;
    originalPdfBytes = null;
    pageStates = [];
    fileInput.value = "";
    filePanel.classList.add("hidden");
    pagesGrid.innerHTML = "";
    saveBtn.disabled = true;
    splitBtn.disabled = true;
    clearMessage();
  }

  function renderGrid() {
    pagesGrid.innerHTML = "";
    const activePages = pageStates.filter((p) => !p.deleted);

    if (activePages.length === 0) {
      showMessage("All pages have been deleted. Click Reset to restore original pages.");
      saveBtn.disabled = true;
      splitBtn.disabled = true;
      return;
    }

    saveBtn.disabled = false;
    splitBtn.disabled = false;

    pageStates.forEach((p) => {
      if (p.deleted) return;

      const card = document.createElement("div");
      card.className = "organize-card";
      card.innerHTML = `
        <div class="organize-preview-wrapper" style="transform: rotate(${p.rotation}deg)">
          <img src="${p.dataUrl}" alt="Page ${p.pageNum}" />
        </div>
        <div class="organize-meta">
          <span>Page ${p.pageNum}</span>
        </div>
        <div class="organize-actions">
          <button type="button" class="btn-rotate" title="Rotate 90° clockwise">↻ Rotate</button>
          <button type="button" class="btn-delete" title="Delete page">🗑️</button>
        </div>
      `;

      card.querySelector(".btn-rotate").addEventListener("click", () => {
        p.rotation = (p.rotation + 90) % 360;
        renderGrid();
      });

      card.querySelector(".btn-delete").addEventListener("click", () => {
        p.deleted = true;
        renderGrid();
      });

      pagesGrid.appendChild(card);
    });
  }

  async function selectFile(file) {
    reset();
    if (!file) return;

    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      showMessage("Please upload a valid PDF file.");
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    filePanel.classList.remove("hidden");
    showMessage("Generating page previews...", "success");

    try {
      originalPdfBytes = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(originalPdfBytes) }).promise;

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.6 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;

        pageStates.push({
          pageNum: i,
          rotation: 0,
          deleted: false,
          dataUrl: canvas.toDataURL("image/jpeg", 0.8)
        });
      }

      clearMessage();
      renderGrid();
    } catch (e) {
      console.error("Organize PDF error:", e);
      showMessage(`Could not read PDF: ${e.message || e}`);
    }
  }

  async function saveOrganizedPdf() {
    if (!originalPdfBytes || !window.PDFLib) return;
    clearMessage();
    saveBtn.disabled = true;

    try {
      const { PDFDocument, degrees } = window.PDFLib;
      const srcDoc = await PDFDocument.load(originalPdfBytes);
      const outDoc = await PDFDocument.create();

      for (const p of pageStates) {
        if (p.deleted) continue;
        const [copiedPage] = await outDoc.copyPages(srcDoc, [p.pageNum - 1]);
        if (p.rotation !== 0) {
          const rotationObj = copiedPage.getRotation();
          const currentRotation = typeof rotationObj?.angle === "number" ? rotationObj.angle : (typeof rotationObj === "number" ? rotationObj : 0);
          copiedPage.setRotation(degrees((currentRotation + p.rotation) % 360));
        }
        outDoc.addPage(copiedPage);
      }

      const outBytes = await outDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      downloadBlob(blob, `${safeFileName(selectedFile.name)}_organized.pdf`);
      showMessage("Organized PDF saved and downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showMessage(`Failed to save PDF: ${e.message || e}`);
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function splitIntoIndividualPdfs() {
    if (!originalPdfBytes || !window.PDFLib || !window.JSZip) return;
    clearMessage();
    splitBtn.disabled = true;
    showMessage("Splitting into individual PDF pages...", "success");

    try {
      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(originalPdfBytes);
      const zip = new window.JSZip();

      for (const p of pageStates) {
        if (p.deleted) continue;
        const singleDoc = await PDFDocument.create();
        const [copiedPage] = await singleDoc.copyPages(srcDoc, [p.pageNum - 1]);
        singleDoc.addPage(copiedPage);

        const bytes = await singleDoc.save();
        zip.file(`${safeFileName(selectedFile.name)}_page_${p.pageNum}.pdf`, bytes);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      downloadBlob(zipBlob, `${safeFileName(selectedFile.name)}_split_pages.zip`);
      showMessage("All pages split and downloaded as ZIP archive!", "success");
    } catch (e) {
      console.error(e);
      showMessage(`Split failed: ${e.message || e}`);
    } finally {
      splitBtn.disabled = false;
    }
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => selectFile(e.target.files[0]));
  removeBtn.addEventListener("click", reset);
  rotateAllBtn.addEventListener("click", () => {
    pageStates.forEach((p) => {
      p.rotation = (p.rotation + 90) % 360;
    });
    renderGrid();
  });
  resetPagesBtn.addEventListener("click", () => {
    pageStates.forEach((p) => {
      p.rotation = 0;
      p.deleted = false;
    });
    renderGrid();
  });
  saveBtn.addEventListener("click", saveOrganizedPdf);
  splitBtn.addEventListener("click", splitIntoIndividualPdfs);
  setupDragDrop(dropZone, selectFile);
}
