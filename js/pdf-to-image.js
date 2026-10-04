import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

// Ensure PDF.js worker is always configured
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";

export function initPdfToImage() {
  const container = $("tool-pdf-to-image");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const fileName = container.querySelector(".file-name");
  const fileMeta = container.querySelector(".file-meta");
  const removeBtn = container.querySelector(".remove-btn");
  const convertBtn = container.querySelector(".convert-btn");
  const downloadZipBtn = container.querySelector(".download-zip-btn");
  const progressPanel = container.querySelector(".progress-panel");
  const progressBar = container.querySelector(".progress-bar");
  const progressPercent = container.querySelector(".progress-percent");
  const statusText = container.querySelector(".status-text");
  const message = container.querySelector(".message");
  const gallery = container.querySelector(".image-gallery");
  const formatSelect = container.querySelector(".format-select");
  const qualitySelect = container.querySelector(".quality-select");

  let selectedFile = null;
  let currentPdfDoc = null;
  let renderedImages = [];

  function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = `message ${type}`;
    message.classList.remove("hidden");
  }

  function clearMessage() {
    message.textContent = "";
    message.className = "message hidden";
  }

  function setProgress(percent, status) {
    progressPanel.classList.remove("hidden");
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    progressBar.style.width = `${safePercent}%`;
    progressPercent.textContent = `${safePercent}%`;
    statusText.textContent = status;
  }

  function reset() {
    selectedFile = null;
    currentPdfDoc = null;
    renderedImages = [];
    fileInput.value = "";
    filePanel.classList.add("hidden");
    progressPanel.classList.add("hidden");
    downloadZipBtn.classList.add("hidden");
    gallery.innerHTML = "";
    convertBtn.disabled = true;
    clearMessage();
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
    fileMeta.textContent = `${formatBytes(file.size)} · Reading pages...`;
    filePanel.classList.remove("hidden");

    try {
      const buffer = await file.arrayBuffer();
      currentPdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
      fileMeta.textContent = `${formatBytes(file.size)} · ${currentPdfDoc.numPages} Page${currentPdfDoc.numPages === 1 ? "" : "s"}`;
      convertBtn.disabled = false;
    } catch (e) {
      console.error("PDF read error:", e);
      showMessage(`Could not read PDF: ${e.message || e}`);
    }
  }

  async function convertToImages() {
    if (!currentPdfDoc || !selectedFile) return;
    clearMessage();
    convertBtn.disabled = true;
    gallery.innerHTML = "";
    renderedImages = [];

    const format = formatSelect.value;
    const ext = format === "image/png" ? "png" : "jpg";
    const scale = parseFloat(qualitySelect.value) || 2.0;

    try {
      for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
        setProgress(
          ((pageNum - 1) / currentPdfDoc.numPages) * 100,
          `Rendering page ${pageNum} of ${currentPdfDoc.numPages}...`
        );

        const page = await currentPdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");

        if (ext === "jpg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, format, 0.92));
        const dataUrl = canvas.toDataURL(format, 0.92);
        const pageFileName = `${safeFileName(selectedFile.name)}_page_${pageNum}.${ext}`;

        renderedImages.push({ pageNum, blob, dataUrl, filename: pageFileName });

        const card = document.createElement("div");
        card.className = "image-card";
        card.innerHTML = `
          <img src="${dataUrl}" alt="Page ${pageNum}" />
          <div class="image-card-footer">
            <span>Page ${pageNum}</span>
            <button type="button" class="secondary-btn btn-sm">Download</button>
          </div>
        `;
        card.querySelector("button").addEventListener("click", () => downloadBlob(blob, pageFileName));
        gallery.appendChild(card);
      }

      setProgress(100, "All pages rendered successfully!");
      downloadZipBtn.classList.remove("hidden");
      showMessage(`Rendered ${renderedImages.length} images. Download individually or as a ZIP archive below.`, "success");
    } catch (e) {
      console.error("Image rendering error:", e);
      showMessage(`Rendering failed: ${e.message || e}`);
    } finally {
      convertBtn.disabled = false;
    }
  }

  async function downloadAllZip() {
    if (renderedImages.length === 0 || !window.JSZip) return;
    showMessage("Packaging ZIP archive...", "success");
    const zip = new window.JSZip();
    renderedImages.forEach((img) => {
      zip.file(img.filename, img.blob);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `${safeFileName(selectedFile.name)}_images.zip`);
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => selectFile(e.target.files[0]));
  removeBtn.addEventListener("click", reset);
  convertBtn.addEventListener("click", convertToImages);
  downloadZipBtn.addEventListener("click", downloadAllZip);
  setupDragDrop(dropZone, selectFile);
}
