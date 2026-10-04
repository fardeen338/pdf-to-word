import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

export function initMergePdf() {
  const container = $("tool-merge-pdf");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const pdfList = container.querySelector(".pdf-list");
  const clearAllBtn = container.querySelector(".clear-all-btn");
  const mergeBtn = container.querySelector(".merge-btn");
  const message = container.querySelector(".message");

  let pdfFiles = []; // Array of { file, id }

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove("hidden");
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "message hidden";
  }

  function renderList() {
    pdfList.innerHTML = "";
    if (pdfFiles.length === 0) {
      filePanel.classList.add("hidden");
      mergeBtn.disabled = true;
      return;
    }

    filePanel.classList.remove("hidden");
    mergeBtn.disabled = pdfFiles.length < 2;

    pdfFiles.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "merge-file-row";
      row.innerHTML = `
        <div class="row-left">
          <span class="badge-num">${index + 1}</span>
          <div class="file-icon-mini">PDF</div>
          <div class="file-text-meta">
            <strong>${item.file.name}</strong>
            <small>${formatBytes(item.file.size)}</small>
          </div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn-move-up" ${index === 0 ? "disabled" : ""} title="Move Up">▲</button>
          <button type="button" class="btn-move-down" ${index === pdfFiles.length - 1 ? "disabled" : ""} title="Move Down">▼</button>
          <button type="button" class="btn-remove" title="Remove">✕</button>
        </div>
      `;

      row.querySelector(".btn-move-up").addEventListener("click", () => {
        if (index > 0) {
          const t = pdfFiles[index];
          pdfFiles[index] = pdfFiles[index - 1];
          pdfFiles[index - 1] = t;
          renderList();
        }
      });

      row.querySelector(".btn-move-down").addEventListener("click", () => {
        if (index < pdfFiles.length - 1) {
          const t = pdfFiles[index];
          pdfFiles[index] = pdfFiles[index + 1];
          pdfFiles[index + 1] = t;
          renderList();
        }
      });

      row.querySelector(".btn-remove").addEventListener("click", () => {
        pdfFiles.splice(index, 1);
        renderList();
      });

      pdfList.appendChild(row);
    });
  }

  function addFiles(files) {
    clearMessage();
    const valid = Array.from(files).filter(
      (f) => f.type.includes("pdf") || f.name.toLowerCase().endsWith(".pdf")
    );
    if (valid.length === 0) {
      showMessage("Please choose valid PDF files.");
      return;
    }

    valid.forEach((file) => pdfFiles.push({ file, id: Math.random() }));
    renderList();
  }

  async function mergePdfs() {
    if (pdfFiles.length < 2 || !window.PDFLib) return;
    clearMessage();
    mergeBtn.disabled = true;

    try {
      const { PDFDocument } = window.PDFLib;
      const mergedPdf = await PDFDocument.create();

      for (const item of pdfFiles) {
        const bytes = await item.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      downloadBlob(blob, `merged-document.pdf`);
      showMessage(`Successfully merged ${pdfFiles.length} PDF files into one!`, "success");
    } catch (e) {
      console.error(e);
      showMessage(`Merge failed: ${e.message}`);
    } finally {
      mergeBtn.disabled = false;
    }
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => addFiles(e.target.files));
  clearAllBtn.addEventListener("click", () => {
    pdfFiles = [];
    fileInput.value = "";
    renderList();
  });
  mergeBtn.addEventListener("click", mergePdfs);
  setupDragDrop(dropZone, addFiles, true);
}
