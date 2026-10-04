/**
 * Shared utility functions across all tools
 */

export function $(id) {
  return document.getElementById(id);
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, index)).toFixed(index ? 2 : 0)} ${units[index]}`;
}

export function safeFileName(name, extension = "") {
  if (!name) return `document${extension}`;
  const base = name
    .replace(/\.[^/.]+$/, "") // Remove original extension
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .trim() || "document";
  return extension ? `${base}${extension}` : base;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function setupDragDrop(zoneElement, onFileDropped, multiple = false) {
  ["dragenter", "dragover"].forEach((eventName) => {
    zoneElement.addEventListener(eventName, (e) => {
      e.preventDefault();
      zoneElement.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zoneElement.addEventListener(eventName, (e) => {
      e.preventDefault();
      zoneElement.classList.remove("dragover");
    });
  });

  zoneElement.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (multiple) {
        onFileDropped(Array.from(e.dataTransfer.files));
      } else {
        onFileDropped(e.dataTransfer.files[0]);
      }
    }
  });
}
