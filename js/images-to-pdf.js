import { $, formatBytes, safeFileName, downloadBlob, setupDragDrop } from "./utils.js";

export function initImagesToPdf() {
  const container = $("tool-images-to-pdf");
  if (!container) return;

  const dropZone = container.querySelector(".drop-zone");
  const fileInput = container.querySelector(".file-input");
  const browseBtn = container.querySelector(".browse-btn");
  const filePanel = container.querySelector(".file-panel");
  const imagesList = container.querySelector(".images-list");
  const clearAllBtn = container.querySelector(".clear-all-btn");
  const convertBtn = container.querySelector(".convert-btn");
  const orientationSelect = container.querySelector(".orientation-select");
  const marginSelect = container.querySelector(".margin-select");
  const pageSizeSelect = container.querySelector(".page-size-select");
  const message = container.querySelector(".message");

  let imageFiles = []; // Array of { file, dataUrl, id }

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
    imagesList.innerHTML = "";
    if (imageFiles.length === 0) {
      filePanel.classList.add("hidden");
      convertBtn.disabled = true;
      return;
    }

    filePanel.classList.remove("hidden");
    convertBtn.disabled = false;

    imageFiles.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "image-sort-card";
      card.innerHTML = `
        <img src="${item.dataUrl}" alt="${item.file.name}" />
        <div class="card-meta">
          <span class="badge-num">${index + 1}</span>
          <strong title="${item.file.name}">${item.file.name}</strong>
          <small>${formatBytes(item.file.size)}</small>
        </div>
        <div class="card-actions">
          <button type="button" class="btn-move-up" ${index === 0 ? "disabled" : ""} title="Move Left">◀</button>
          <button type="button" class="btn-move-down" ${index === imageFiles.length - 1 ? "disabled" : ""} title="Move Right">▶</button>
          <button type="button" class="btn-remove" title="Remove">✕</button>
        </div>
      `;

      card.querySelector(".btn-move-up").addEventListener("click", () => {
        if (index > 0) {
          const temp = imageFiles[index];
          imageFiles[index] = imageFiles[index - 1];
          imageFiles[index - 1] = temp;
          renderList();
        }
      });

      card.querySelector(".btn-move-down").addEventListener("click", () => {
        if (index < imageFiles.length - 1) {
          const temp = imageFiles[index];
          imageFiles[index] = imageFiles[index + 1];
          imageFiles[index + 1] = temp;
          renderList();
        }
      });

      card.querySelector(".btn-remove").addEventListener("click", () => {
        imageFiles.splice(index, 1);
        renderList();
      });

      imagesList.appendChild(card);
    });
  }

  async function addFiles(files) {
    clearMessage();
    const valid = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (valid.length === 0) {
      showMessage("Please select valid image files (JPG, PNG, WebP).");
      return;
    }

    for (const file of valid) {
      const dataUrl = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(file);
      });
      imageFiles.push({ file, dataUrl, id: Math.random() });
    }

    renderList();
  }

  async function convertImagesToPdf() {
    if (imageFiles.length === 0 || !window.PDFLib) return;
    clearMessage();
    convertBtn.disabled = true;

    try {
      const { PDFDocument, PageSizes } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();

      const marginOption = marginSelect.value;
      const margin = marginOption === "none" ? 0 : marginOption === "small" ? 20 : 40;
      const orientation = orientationSelect.value;
      const basePageSize = pageSizeSelect.value === "letter" ? PageSizes.Letter : PageSizes.A4;

      for (const item of imageFiles) {
        const imageBytes = await item.file.arrayBuffer();
        let embeddedImage;

        if (item.file.type === "image/png") {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
          // For JPG / WebP, canvas converted to JPEG
          if (item.file.type === "image/jpeg" || item.file.type === "image/jpg") {
            embeddedImage = await pdfDoc.embedJpg(imageBytes);
          } else {
            // Draw into canvas to get PNG bytes for other formats
            const img = new Image();
            img.src = item.dataUrl;
            await new Promise((r) => (img.onload = r));
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
            embeddedImage = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
          }
        }

        const imgDims = embeddedImage.scale(1);
        let pageWidth = basePageSize[0];
        let pageHeight = basePageSize[1];

        if (orientation === "landscape" || (orientation === "auto" && imgDims.width > imgDims.height)) {
          pageWidth = basePageSize[1];
          pageHeight = basePageSize[0];
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        const maxContentWidth = pageWidth - margin * 2;
        const maxContentHeight = pageHeight - margin * 2;

        const scaleX = maxContentWidth / imgDims.width;
        const scaleY = maxContentHeight / imgDims.height;
        const scale = Math.min(scaleX, scaleY, 1);

        const drawWidth = imgDims.width * scale;
        const drawHeight = imgDims.height * scale;
        const drawX = margin + (maxContentWidth - drawWidth) / 2;
        const drawY = margin + (maxContentHeight - drawHeight) / 2;

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      downloadBlob(blob, `images-combined.pdf`);
      showMessage(`Successfully created PDF with ${imageFiles.length} pages!`, "success");
    } catch (e) {
      console.error(e);
      showMessage(`Failed to generate PDF: ${e.message}`);
    } finally {
      convertBtn.disabled = false;
    }
  }

  browseBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => addFiles(e.target.files));
  clearAllBtn.addEventListener("click", () => {
    imageFiles = [];
    fileInput.value = "";
    renderList();
  });
  convertBtn.addEventListener("click", convertImagesToPdf);
  setupDragDrop(dropZone, addFiles, true);
}
