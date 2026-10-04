import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

export function initWatermarkPdf() {
  const container = $("tool-watermark-pdf");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const fileName = container.querySelector(".file-name");
  const removeBtn = container.querySelector(".remove-btn");
  const applyBtn = container.querySelector(".apply-btn");
  const watermarkText = container.querySelector(".watermark-text");
  const watermarkSize = container.querySelector(".watermark-size");
  const watermarkOpacity = container.querySelector(".watermark-opacity");
  const watermarkAngle = container.querySelector(".watermark-angle");
  const watermarkColor = container.querySelector(".watermark-color");
  const message = container.querySelector(".message");

  let selectedFile = null;
  let pdfBytes = null;

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
    pdfBytes = null;
    fileInput.value = "";
    filePanel.classList.add("hidden");
    applyBtn.disabled = true;
    clearMessage();
  }

  async function selectFile(file) {
    reset();
    if (!file) return;

    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      showMessage("Please upload a PDF file.");
      return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    filePanel.classList.remove("hidden");
    applyBtn.disabled = false;

    try {
      pdfBytes = await file.arrayBuffer();
    } catch (e) {
      showMessage(`Could not read PDF: ${e.message}`);
    }
  }

  function hexToRgbNormalized(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }

  async function applyWatermark() {
    if (!pdfBytes || !window.PDFLib) return;
    clearMessage();
    applyBtn.disabled = true;

    try {
      const { PDFDocument, rgb, degrees, StandardFonts } = window.PDFLib;
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const text = watermarkText.value.trim() || "CONFIDENTIAL";
      const size = parseInt(watermarkSize.value, 10) || 50;
      const opacity = parseFloat(watermarkOpacity.value) || 0.3;
      const angle = parseInt(watermarkAngle.value, 10) || 45;
      const colorHex = watermarkColor.value || "#ff0000";
      const { r, g, b } = hexToRgbNormalized(colorHex);

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, size);
        const textHeight = font.heightAtSize(size);

        // Center calculation
        const x = (width - textWidth) / 2;
        const y = (height - textHeight) / 2;

        page.drawText(text, {
          x,
          y,
          size,
          font,
          color: rgb(r, g, b),
          opacity,
          rotate: degrees(angle)
        });
      }

      const outBytes = await pdfDoc.save();
      const blob = new Blob([outBytes], { type: "application/pdf" });
      downloadBlob(blob, `${safeFileName(selectedFile.name)}_watermarked.pdf`);
      showMessage("Watermark applied and PDF downloaded successfully!", "success");
    } catch (e) {
      console.error(e);
      showMessage(`Failed to watermark PDF: ${e.message}`);
    } finally {
      applyBtn.disabled = false;
    }
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => selectFile(e.target.files[0]));
  removeBtn.addEventListener("click", reset);
  applyBtn.addEventListener("click", applyWatermark);
  setupDragDrop(dropZone, selectFile);
}
