# 🚀 All-in-One Client-Side PDF Suite

A fast, completely private, zero-backend PDF and document processing web suite built with modern JavaScript (ES modules), HTML5, and CSS3. 

Everything runs **100% in the user's browser memory** with zero server uploads, making it ultra-fast and directly deployable as static assets on **Cloudflare Workers** or **Cloudflare Pages**.

---

## 🛠️ Included Tools

1. **📄 PDF to Word Converter**
   - Extracts text layers with smart heading (`H1`, `H2`), bold/italic, and bullet list preservation into `.docx`.
   - Export to Word (`.docx`), Markdown (`.md`), or plain text (`.txt`) + Copy to clipboard.
   - Live Page 1 thumbnail preview and custom page range selection.
2. **🖼️ PDF to Image (JPG / PNG)**
   - Renders all pages into high-resolution images (150 / 200 / 300 DPI).
   - Download individual page images or package all pages into a `.zip` archive.
3. **📸 Images to PDF**
   - Drag & drop multiple JPG, PNG, or WebP images, reorder them, adjust margins/orientation (A4 / US Letter), and compile into a single PDF.
4. **🗂️ Merge PDF**
   - Select multiple PDF files, arrange their order, and merge them into a consolidated document in milliseconds using `pdf-lib`.
5. **🔄 Organize & Split PDF**
   - Visual grid of all page thumbnails.
   - Rotate individual or all pages (90° increments).
   - Delete unwanted pages.
   - Export modified PDF or split all pages into individual PDFs packed in a `.zip`.
6. **✍️ Watermark PDF**
   - Stamp customizable text watermarks across all pages with custom font size, opacity, rotation angle, and color.
7. **📝 Word to PDF**
   - Convert Microsoft Word (`.docx`) documents into vector PDF files directly in the browser.

---

## ☁️ Zero-Error Cloudflare Deployment

This project contains zero build steps and is ready for static deployment on **Cloudflare Workers** or **Cloudflare Pages**.

### Deploy with Cloudflare Workers (Static Assets)

```bash
# Deploy instantly
npx wrangler deploy
```

### Deploy with Cloudflare Pages

1. Push to your GitHub/GitLab repository.
2. Create a new **Cloudflare Pages** project.
3. Set **Build command** to blank (empty) and **Build output directory** to `.`.
4. Deploy!

---

## 💻 Run Locally

Run any local HTTP server (required for ES modules):

### Python:
```bash
python -m http.server 5500
```
Visit `http://localhost:5500`.

### Node:
```bash
npx serve .
```

---

## 🔒 Privacy Guarantee

- **No Remote Storage**: Files are processed in the browser's JavaScript memory and garbage collected immediately after use.
- **Offline Capable**: Works without transmitting document data over the wire.
