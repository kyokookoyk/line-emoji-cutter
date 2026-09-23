document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("file-input");
  const tabGridMode = document.getElementById("tab-grid-mode");
  const tabFreeMode = document.getElementById("tab-free-mode");
  const gridControlsPanel = document.getElementById("grid-controls-panel");
  const freeControlsPanel = document.getElementById("free-controls-panel");

  const colsInput = document.getElementById("cols-input");
  const rowsInput = document.getElementById("rows-input");
  const colsVal = document.getElementById("cols-val");
  const rowsVal = document.getElementById("rows-val");

  const optAutoCenter = document.getElementById("opt-auto-center");
  const optAddStroke = document.getElementById("opt-add-stroke");
  const strokeOptions = document.getElementById("stroke-options");
  const strokeWidthInput = document.getElementById("stroke-width-input");
  const strokeVal = document.getElementById("stroke-val");

  const canvasContainer = document.getElementById("canvas-container");
  const previewCanvas = document.getElementById("preview-canvas");
  const canvasTips = document.getElementById("canvas-tips");
  const btnResetGrid = document.getElementById("btn-reset-grid");
  const btnToggleAll = document.getElementById("btn-toggle-all");
  const btnClearFree = document.getElementById("btn-clear-free");
  const convertBtn = document.getElementById("convert-btn");

  const resultsContainer = document.getElementById("results-container");
  const resultSummary = document.getElementById("result-summary");
  const tabPreviewContainer = document.getElementById("tab-preview-container");
  const emojiGrid = document.getElementById("emoji-grid");
  const downloadZipBtn = document.getElementById("download-zip-btn");

  const lineSimCard = document.getElementById("line-sim-card");
  const chatWindow = document.getElementById("chat-window");
  const chatMessages = document.getElementById("chat-messages");
  const chatEmojiDock = document.getElementById("chat-emoji-dock");
  const chatInput = document.getElementById("chat-input");
  const chatSendBtn = document.getElementById("chat-send-btn");
  const senderToggle = document.getElementById("sender-toggle");
  const chatClearBtn = document.getElementById("chat-clear-btn");

  // State
  let loadedImage = null;
  let mode = "grid"; // 'grid' | 'free'

  let cols = 5;
  let rows = 8;
  let colLines = [];
  let rowLines = [];
  let excludedCells = new Set();

  let freeBoxes = [];
  let isFreeDrawing = false;
  let freeDrawStart = null;
  let freeDrawCurrent = null;

  let dragTarget = null;
  const HIT_THRESHOLD = 12; // detection radius (touch-friendly)

  let generatedEmojiCanvases = []; // array of { canvas, name }
  let currentTabCanvas = null;
  let selectedTabIndex = 0;
  let currentSender = "mine";

  // ---------------- File Handling ----------------
  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
  });

  dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
  });

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    if (!file.type.match(/^image\/(png|jpeg|jpg|webp)$/)) {
      alert("PNGまたはJPEG形式の画像ファイルを指定してください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      loadedImage = new Image();
      loadedImage.onload = () => {
        canvasContainer.style.display = "block";
        convertBtn.disabled = false;
        resetGridLines();
        renderCanvas();
        updateConvertButtonText();
      };
      loadedImage.src = event.target.result;
    };
    reader.readAsDataURL(file);

    dropzone.querySelector(".dropzone-text").textContent = `選択中: ${file.name}`;
    dropzone.querySelector(".dropzone-subtext").textContent = `タップまたは別の画像をドロップして変更`;
  }

  // ---------------- Mode Switching ----------------
  tabGridMode.addEventListener("click", () => {
    mode = "grid";
    tabGridMode.classList.add("active");
    tabFreeMode.classList.remove("active");
    gridControlsPanel.style.display = "block";
    freeControlsPanel.style.display = "none";
    btnResetGrid.style.display = "inline-block";
    btnToggleAll.style.display = "inline-block";
    btnClearFree.style.display = "none";
    canvasTips.textContent = "💡 赤い線をドラッグして微調整できます / マスクリックで除外可能";
    renderCanvas();
    updateConvertButtonText();
  });

  tabFreeMode.addEventListener("click", () => {
    mode = "free";
    tabFreeMode.classList.add("active");
    tabGridMode.classList.remove("active");
    gridControlsPanel.style.display = "none";
    freeControlsPanel.style.display = "block";
    btnResetGrid.style.display = "none";
    btnToggleAll.style.display = "none";
    btnClearFree.style.display = "inline-block";
    canvasTips.textContent = "💡 画像上をドラッグして切り出したい枠を作成できます";
    renderCanvas();
    updateConvertButtonText();
  });

  // ---------------- Grid Parameter Controls ----------------
  colsInput.addEventListener("input", () => {
    cols = Math.max(1, Math.min(20, parseInt(colsInput.value, 10) || 1));
    colsVal.textContent = cols;
    resetGridLines();
    renderCanvas();
    updateConvertButtonText();
  });

  rowsInput.addEventListener("input", () => {
    rows = Math.max(1, Math.min(20, parseInt(rowsInput.value, 10) || 1));
    rowsVal.textContent = rows;
    resetGridLines();
    renderCanvas();
    updateConvertButtonText();
  });

  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      cols = parseInt(btn.dataset.cols, 10);
      rows = parseInt(btn.dataset.rows, 10);
      colsInput.value = cols;
      rowsInput.value = rows;
      colsVal.textContent = cols;
      rowsVal.textContent = rows;
      resetGridLines();
      renderCanvas();
      updateConvertButtonText();
    });
  });

  function resetGridLines() {
    if (!loadedImage) return;
    const w = loadedImage.naturalWidth;
    const h = loadedImage.naturalHeight;

    colLines = [];
    for (let c = 1; c < cols; c++) {
      colLines.push(Math.round(c * (w / cols)));
    }

    rowLines = [];
    for (let r = 1; r < rows; r++) {
      rowLines.push(Math.round(r * (h / rows)));
    }

    excludedCells.clear();
  }

  btnResetGrid.addEventListener("click", () => {
    resetGridLines();
    renderCanvas();
    updateConvertButtonText();
  });

  btnToggleAll.addEventListener("click", () => {
    const totalCells = cols * rows;
    if (excludedCells.size < totalCells) {
      for (let i = 0; i < totalCells; i++) excludedCells.add(i);
    } else {
      excludedCells.clear();
    }
    renderCanvas();
    updateConvertButtonText();
  });

  btnClearFree.addEventListener("click", () => {
    freeBoxes = [];
    renderCanvas();
    updateConvertButtonText();
  });

  optAddStroke.addEventListener("change", () => {
    strokeOptions.style.display = optAddStroke.checked ? "flex" : "none";
  });

  strokeWidthInput.addEventListener("input", () => {
    strokeVal.textContent = strokeWidthInput.value;
  });

  function updateConvertButtonText() {
    let count = 0;
    if (mode === "grid") {
      count = Math.max(0, cols * rows - excludedCells.size);
    } else {
      count = freeBoxes.length;
    }
    convertBtn.textContent = `✨ 絵文字に変換する (${count} 個)`;
    convertBtn.disabled = count === 0;
  }

  // ---------------- Canvas Coordinate Helpers (Mouse & Touch) ----------------
  function getCanvasCoords(clientX, clientY) {
    const rect = previewCanvas.getBoundingClientRect();
    const scaleX = previewCanvas.width / rect.width;
    const scaleY = previewCanvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // ---------------- Canvas Mouse & Touch Interaction ----------------
  function handleStart(clientX, clientY) {
    if (!loadedImage) return;
    const { x, y } = getCanvasCoords(clientX, clientY);

    if (mode === "grid") {
      for (let i = 0; i < colLines.length; i++) {
        if (Math.abs(x - colLines[i]) <= HIT_THRESHOLD) {
          dragTarget = { type: "col", index: i };
          return;
        }
      }
      for (let i = 0; i < rowLines.length; i++) {
        if (Math.abs(y - rowLines[i]) <= HIT_THRESHOLD) {
          dragTarget = { type: "row", index: i };
          return;
        }
      }

      const cell = getCellAtPos(x, y);
      if (cell !== null) {
        if (excludedCells.has(cell)) {
          excludedCells.delete(cell);
        } else {
          excludedCells.add(cell);
        }
        renderCanvas();
        updateConvertButtonText();
      }
    } else if (mode === "free") {
      isFreeDrawing = true;
      freeDrawStart = { x, y };
      freeDrawCurrent = { x, y };
    }
  }

  function handleMove(clientX, clientY) {
    if (!loadedImage) return;

    if (dragTarget) {
      const { x, y } = getCanvasCoords(clientX, clientY);
      const w = loadedImage.naturalWidth;
      const h = loadedImage.naturalHeight;

      if (dragTarget.type === "col") {
        const i = dragTarget.index;
        const minX = i === 0 ? 10 : colLines[i - 1] + 10;
        const maxX = i === colLines.length - 1 ? w - 10 : colLines[i + 1] - 10;
        colLines[i] = Math.max(minX, Math.min(maxX, Math.round(x)));
      } else if (dragTarget.type === "row") {
        const i = dragTarget.index;
        const minY = i === 0 ? 10 : rowLines[i - 1] + 10;
        const maxY = i === rowLines.length - 1 ? h - 10 : rowLines[i + 1] - 10;
        rowLines[i] = Math.max(minY, Math.min(maxY, Math.round(y)));
      }
      renderCanvas();
    } else if (isFreeDrawing) {
      const { x, y } = getCanvasCoords(clientX, clientY);
      const w = loadedImage.naturalWidth;
      const h = loadedImage.naturalHeight;
      freeDrawCurrent = {
        x: Math.max(0, Math.min(w, x)),
        y: Math.max(0, Math.min(h, y)),
      };
      renderCanvas();
    }
  }

  function handleEnd() {
    if (dragTarget) dragTarget = null;
    if (isFreeDrawing) {
      isFreeDrawing = false;
      if (freeDrawStart && freeDrawCurrent) {
        const left = Math.round(Math.min(freeDrawStart.x, freeDrawCurrent.x));
        const top = Math.round(Math.min(freeDrawStart.y, freeDrawCurrent.y));
        const right = Math.round(Math.max(freeDrawStart.x, freeDrawCurrent.x));
        const bottom = Math.round(Math.max(freeDrawStart.y, freeDrawCurrent.y));

        if (right - left > 15 && bottom - top > 15) {
          freeBoxes.push({ left, top, right, bottom });
        }
      }
      freeDrawStart = null;
      freeDrawCurrent = null;
      renderCanvas();
      updateConvertButtonText();
    }
  }

  // Mouse listeners
  previewCanvas.addEventListener("mousedown", (e) => handleStart(e.clientX, e.clientY));
  window.addEventListener("mousemove", (e) => handleMove(e.clientX, e.clientY));
  window.addEventListener("mouseup", handleEnd);

  // Touch listeners (mobile support)
  previewCanvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && (dragTarget || isFreeDrawing)) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    }
  }, { passive: false });

  window.addEventListener("touchend", handleEnd);

  function getCellAtPos(x, y) {
    const w = loadedImage.naturalWidth;
    const h = loadedImage.naturalHeight;
    const allX = [0, ...colLines, w];
    const allY = [0, ...rowLines, h];

    let colIdx = -1;
    for (let c = 0; c < allX.length - 1; c++) {
      if (x >= allX[c] && x < allX[c + 1]) {
        colIdx = c;
        break;
      }
    }
    let rowIdx = -1;
    for (let r = 0; r < allY.length - 1; r++) {
      if (y >= allY[r] && y < allY[r + 1]) {
        rowIdx = r;
        break;
      }
    }
    if (colIdx >= 0 && rowIdx >= 0) return rowIdx * cols + colIdx;
    return null;
  }

  // ---------------- Canvas Rendering ----------------
  function renderCanvas() {
    if (!loadedImage) return;

    const w = loadedImage.naturalWidth;
    const h = loadedImage.naturalHeight;
    previewCanvas.width = w;
    previewCanvas.height = h;

    const ctx = previewCanvas.getContext("2d");
    ctx.drawImage(loadedImage, 0, 0);

    if (mode === "grid") {
      const allX = [0, ...colLines, w];
      const allY = [0, ...rowLines, h];

      let cellIdx = 0;
      let activeOrder = 1;
      const minCellDim = Math.min(w / cols, h / rows);
      const fontSize = Math.max(12, Math.floor(minCellDim / 4.5));
      ctx.font = `bold ${fontSize}px sans-serif`;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x0 = allX[c];
          const x1 = allX[c + 1];
          const y0 = allY[r];
          const y1 = allY[r + 1];

          if (excludedCells.has(cellIdx)) {
            ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
            ctx.fillRect(x0, y0, x1 - x0, y1 - y0);

            ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x0 + 6, y0 + 6);
            ctx.lineTo(x1 - 6, y1 - 6);
            ctx.moveTo(x1 - 6, y0 + 6);
            ctx.lineTo(x0 + 6, y1 - 6);
            ctx.stroke();

            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText("除外", (x0 + x1) / 2, (y0 + y1) / 2);
          } else {
            const label = String(activeOrder).padStart(3, "0");
            const badgeW = fontSize * 2.8;
            const badgeH = fontSize * 1.4;
            ctx.fillStyle = "rgba(6, 199, 85, 0.85)";
            ctx.fillRect(x0 + 6, y0 + 6, badgeW, badgeH);

            ctx.fillStyle = "#ffffff";
            ctx.textBaseline = "middle";
            ctx.textAlign = "center";
            ctx.fillText(label, x0 + 6 + badgeW / 2, y0 + 6 + badgeH / 2);
            activeOrder++;
          }
          cellIdx++;
        }
      }

      ctx.strokeStyle = "rgba(239, 68, 68, 0.9)";
      ctx.lineWidth = Math.max(2, Math.floor(Math.min(w, h) / 500));

      for (const lx of colLines) {
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, h);
        ctx.stroke();
      }

      for (const ly of rowLines) {
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
      }
    } else if (mode === "free") {
      freeBoxes.forEach((box, i) => {
        const { left, top, right, bottom } = box;
        ctx.strokeStyle = "rgba(6, 199, 85, 0.95)";
        ctx.lineWidth = 3;
        ctx.strokeRect(left, top, right - left, bottom - top);

        ctx.fillStyle = "rgba(6, 199, 85, 0.15)";
        ctx.fillRect(left, top, right - left, bottom - top);

        const label = String(i + 1).padStart(3, "0");
        ctx.fillStyle = "#06c755";
        ctx.fillRect(left, top, 42, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 13px sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.fillText(label, left + 21, top + 11);
      });

      if (isFreeDrawing && freeDrawStart && freeDrawCurrent) {
        const left = Math.min(freeDrawStart.x, freeDrawCurrent.x);
        const top = Math.min(freeDrawStart.y, freeDrawCurrent.y);
        const bw = Math.abs(freeDrawStart.x - freeDrawCurrent.x);
        const bh = Math.abs(freeDrawStart.y - freeDrawCurrent.y);

        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.strokeRect(left, top, bw, bh);
        ctx.setLineDash([]);
      }
    }
  }

  // ---------------- Client-Side Image Processing Logic (Canvas) ----------------
  function detectContentBBox(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        hasAlpha = true;
        break;
      }
    }

    let minX = width, minY = height, maxX = -1, maxY = -1;

    if (hasAlpha) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const a = data[(y * width + x) * 4 + 3];
          if (a > 15) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    } else {
      // Solid background estimation (corners)
      const bgR = (data[0] + data[(width - 1) * 4] + data[((height - 1) * width) * 4] + data[(height * width - 1) * 4]) / 4;
      const bgG = (data[1] + data[(width - 1) * 4 + 1] + data[((height - 1) * width) * 4 + 1] + data[(height * width - 1) * 4 + 1]) / 4;
      const bgB = (data[2] + data[(width - 1) * 4 + 2] + data[((height - 1) * width) * 4 + 2] + data[(height * width - 1) * 4 + 2]) / 4;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const diff = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
          if (diff > 25) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    if (maxX >= minX && maxY >= minY) {
      return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    }
    return { x: 0, y: 0, w: width, h: height };
  }

  function processCellToCanvas(sourceImg, sx, sy, sw, sh, autoCenter, addStroke, strokeWidth) {
    // Crop cell
    const cellCanvas = document.createElement("canvas");
    cellCanvas.width = sw;
    cellCanvas.height = sh;
    const cellCtx = cellCanvas.getContext("2d");
    cellCtx.drawImage(sourceImg, sx, sy, sw, sh, 0, 0, sw, sh);

    let contentCanvas = cellCanvas;
    let cw = sw, ch = sh;

    if (autoCenter) {
      const bbox = detectContentBBox(cellCtx, sw, sh);
      if (bbox.w > 0 && bbox.h > 0) {
        contentCanvas = document.createElement("canvas");
        contentCanvas.width = bbox.w;
        contentCanvas.height = bbox.h;
        const cCtx = contentCanvas.getContext("2d");
        cCtx.drawImage(cellCanvas, bbox.x, bbox.y, bbox.w, bbox.h, 0, 0, bbox.w, bbox.h);
        cw = bbox.w;
        ch = bbox.h;
      }
    }

    // Target 180x180 transparent canvas
    const targetCanvas = document.createElement("canvas");
    targetCanvas.width = 180;
    targetCanvas.height = 180;
    const tCtx = targetCanvas.getContext("2d");

    const padding = addStroke ? Math.max(4, strokeWidth + 2) : 4;
    const maxW = 180 - padding * 2;
    const maxH = 180 - padding * 2;
    const scale = Math.min(maxW / cw, maxH / ch);
    const newW = Math.max(1, Math.round(cw * scale));
    const newH = Math.max(1, Math.round(ch * scale));
    const pasteX = Math.floor((180 - newW) / 2);
    const pasteY = Math.floor((180 - newH) / 2);

    if (addStroke && strokeWidth > 0) {
      // Create white outline stroke using radial offsets
      const strokeCanvas = document.createElement("canvas");
      strokeCanvas.width = 180;
      strokeCanvas.height = 180;
      const sCtx = strokeCanvas.getContext("2d");

      // Draw offset images in circle
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const angle = (i * 2 * Math.PI) / steps;
        const ox = Math.round(Math.cos(angle) * strokeWidth);
        const oy = Math.round(Math.sin(angle) * strokeWidth);
        sCtx.drawImage(contentCanvas, pasteX + ox, pasteY + oy, newW, newH);
      }

      // Convert stroke layer to solid white
      sCtx.globalCompositeOperation = "source-in";
      sCtx.fillStyle = "#ffffff";
      sCtx.fillRect(0, 0, 180, 180);

      // Composite original content on top
      sCtx.globalCompositeOperation = "source-over";
      sCtx.drawImage(contentCanvas, pasteX, pasteY, newW, newH);

      tCtx.drawImage(strokeCanvas, 0, 0);
    } else {
      tCtx.drawImage(contentCanvas, pasteX, pasteY, newW, newH);
    }

    return targetCanvas;
  }

  function createTabFromEmoji(emojiCanvas) {
    const tabCanvas = document.createElement("canvas");
    tabCanvas.width = 96;
    tabCanvas.height = 74;
    const ctx = tabCanvas.getContext("2d");

    // Detect non-transparent bounding box
    const eCtx = emojiCanvas.getContext("2d");
    const bbox = detectContentBBox(eCtx, emojiCanvas.width, emojiCanvas.height);

    const pad = 2;
    const maxW = 96 - pad * 2;
    const maxH = 74 - pad * 2;
    const scale = Math.min(maxW / bbox.w, maxH / bbox.h);
    const newW = Math.max(1, Math.round(bbox.w * scale));
    const newH = Math.max(1, Math.round(bbox.h * scale));
    const pasteX = Math.floor((96 - newW) / 2);
    const pasteY = Math.floor((74 - newH) / 2);

    ctx.drawImage(
      emojiCanvas,
      bbox.x, bbox.y, bbox.w, bbox.h,
      pasteX, pasteY, newW, newH
    );
    return tabCanvas;
  }

  // ---------------- Convert Button Handler ----------------
  convertBtn.addEventListener("click", async () => {
    if (!loadedImage) return;

    const boxes = [];
    if (mode === "grid") {
      const allX = [0, ...colLines, loadedImage.naturalWidth];
      const allY = [0, ...rowLines, loadedImage.naturalHeight];
      let cellIdx = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!excludedCells.has(cellIdx)) {
            boxes.push({
              left: allX[c],
              top: allY[r],
              right: allX[c + 1],
              bottom: allY[r + 1],
            });
          }
          cellIdx++;
        }
      }
    } else {
      freeBoxes.forEach((b) => boxes.push(b));
    }

    if (boxes.length === 0) {
      alert("切り出す絵文字が1つも選択されていません。");
      return;
    }

    const autoCenter = optAutoCenter.checked;
    const addStroke = optAddStroke.checked;
    const strokeWidth = parseInt(strokeWidthInput.value, 10) || 3;

    convertBtn.disabled = true;
    convertBtn.innerHTML = `<span class="spinner"></span> ブラウザ内で変換中... (${boxes.length}個)`;

    // Process asynchronously to avoid UI freezing
    setTimeout(async () => {
      generatedEmojiCanvases = [];

      for (let i = 0; i < boxes.length; i++) {
        const b = boxes[i];
        const sw = b.right - b.left;
        const sh = b.bottom - b.top;
        const canvas = processCellToCanvas(
          loadedImage,
          b.left, b.top, sw, sh,
          autoCenter, addStroke, strokeWidth
        );
        generatedEmojiCanvases.push({
          canvas,
          name: `${String(i + 1).padStart(3, "0")}.png`,
        });
      }

      selectedTabIndex = 0;
      currentTabCanvas = createTabFromEmoji(generatedEmojiCanvases[0].canvas);

      displayResults();
      convertBtn.disabled = false;
      convertBtn.textContent = `✨ 絵文字に変換する (${boxes.length} 個)`;
    }, 50);
  });

  // ---------------- Display Results & Simulator ----------------
  function displayResults() {
    resultsContainer.style.display = "block";
    lineSimCard.style.display = "block";

    resultSummary.textContent = `${generatedEmojiCanvases.length} 個の絵文字 (180×180px) と 1 個のタブ画像 (96×74px) がブラウザ内で瞬時に生成されました！`;

    downloadZipBtn.onclick = generateAndDownloadZip;

    // Initial message in chat
    if (generatedEmojiCanvases.length > 0) {
      const e1 = generatedEmojiCanvases[0].canvas.toDataURL("image/png");
      const e2 = generatedEmojiCanvases[Math.min(1, generatedEmojiCanvases.length - 1)].canvas.toDataURL("image/png");
      chatMessages.innerHTML = `
        <div class="chat-bubble bubble-other">
          新しい絵文字完成したんだね！ <img class="chat-inline-emoji" src="${e1}" alt="emoji"> すごく可愛い！ <img class="chat-inline-emoji" src="${e2}" alt="emoji">
        </div>
      `;
    }

    renderTabPreview();
    renderEmojiGrid();

    resultsContainer.scrollIntoView({ behavior: "smooth" });
  }

  function renderTabPreview() {
    const tabDataUrl = currentTabCanvas.toDataURL("image/png");
    tabPreviewContainer.innerHTML = `
      <div class="tab-preview-card">
        <div class="tab-img-box checker-bg">
          <img id="tab-preview-img" src="${tabDataUrl}" alt="tab.png" />
        </div>
        <div style="flex: 1;">
          <h4 style="font-weight: 700; color: #111827;">tab.png (タブ画像: 96 × 74 px 透過PNG)</h4>
          <p style="font-size: 0.85rem; color: #4b5563; margin-top: 2px;" id="tab-source-desc">
            ${selectedTabIndex >= 0 ? `絵文字 #${String(selectedTabIndex + 1).padStart(3, "0")} をベースに自動生成中` : "アップロードされた画像から生成中"}
          </p>
          <div style="margin-top: 8px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.8rem; color: #6b7280;">👇 下の絵文字一覧の「★ タブに設定」から変更できます</span>
            <label class="btn-small" style="background: #2563eb; border-color: #1d4ed8; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
              📁 専用画像をアップロード
              <input type="file" id="custom-tab-input" accept="image/*" style="display: none;">
            </label>
          </div>
        </div>
      </div>
    `;

    const customTabInput = document.getElementById("custom-tab-input");
    if (customTabInput) {
      customTabInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const tempCanvas = document.createElement("canvas");
              tempCanvas.width = img.naturalWidth;
              tempCanvas.height = img.naturalHeight;
              const tctx = tempCanvas.getContext("2d");
              tctx.drawImage(img, 0, 0);

              currentTabCanvas = createTabFromEmoji(tempCanvas);
              selectedTabIndex = -1;
              renderTabPreview();

              document.querySelectorAll(".emoji-card").forEach((card) => {
                card.classList.remove("is-tab-selected");
                const btn = card.querySelector(".btn-set-tab");
                if (btn) btn.textContent = "タブに設定";
              });
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }

  function renderEmojiGrid() {
    emojiGrid.innerHTML = "";
    chatEmojiDock.innerHTML = "";

    generatedEmojiCanvases.forEach((item, idx) => {
      const dataUrl = item.canvas.toDataURL("image/png");

      const card = document.createElement("div");
      card.className = "emoji-card" + (idx === selectedTabIndex ? " is-tab-selected" : "");
      card.id = `emoji-card-${idx}`;
      card.innerHTML = `
        <span class="tab-badge">★ タブ</span>
        <div class="emoji-thumb checker-bg">
          <img src="${dataUrl}" alt="${item.name}" />
        </div>
        <span class="emoji-name">${item.name}</span>
        <button type="button" class="btn-set-tab" title="この絵文字をタブ画像(tab.png)に設定">
          ${idx === selectedTabIndex ? "★ タブ画像" : "タブに設定"}
        </button>
      `;

      card.querySelector(".btn-set-tab").addEventListener("click", (e) => {
        e.stopPropagation();
        selectedTabIndex = idx;
        currentTabCanvas = createTabFromEmoji(item.canvas);
        renderTabPreview();

        document.querySelectorAll(".emoji-card").forEach((c, i) => {
          const b = c.querySelector(".btn-set-tab");
          if (i === idx) {
            c.classList.add("is-tab-selected");
            if (b) b.textContent = "★ タブ画像";
          } else {
            c.classList.remove("is-tab-selected");
            if (b) b.textContent = "タブに設定";
          }
        });
      });

      card.addEventListener("click", () => {
        insertEmojiToChatInput(dataUrl, item.name);
      });
      emojiGrid.appendChild(card);

      const dockBtn = document.createElement("div");
      dockBtn.className = "dock-item";
      dockBtn.title = `${item.name} を文中に挿入`;
      dockBtn.innerHTML = `<img src="${dataUrl}" alt="${item.name}">`;
      dockBtn.addEventListener("click", () => {
        insertEmojiToChatInput(dataUrl, item.name);
      });
      chatEmojiDock.appendChild(dockBtn);
    });
  }

  // ---------------- ZIP Generation with JSZip ----------------
  async function generateAndDownloadZip() {
    if (!window.JSZip) {
      alert("ZIP作成ライブラリを読み込み中です。インターネット接続をご確認ください。");
      return;
    }

    const zip = new window.JSZip();

    // Add emojis
    for (const item of generatedEmojiCanvases) {
      const blob = await new Promise((resolve) => item.canvas.toBlob(resolve, "image/png"));
      zip.file(item.name, blob);
    }

    // Add tab.png
    const tabBlob = await new Promise((resolve) => currentTabCanvas.toBlob(resolve, "image/png"));
    zip.file("tab.png", tabBlob);

    downloadZipBtn.innerHTML = `<span class="spinner"></span> ZIP圧縮中...`;
    downloadZipBtn.disabled = true;

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "line_emoji.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert(`ZIPの生成に失敗しました: ${err.message}`);
    } finally {
      downloadZipBtn.innerHTML = `📥 line_emoji.zip をダウンロード`;
      downloadZipBtn.disabled = false;
    }
  }

  // ---------------- LINE Chat Simulator Logic ----------------
  if (senderToggle) {
    senderToggle.addEventListener("click", () => {
      if (currentSender === "mine") {
        currentSender = "other";
        senderToggle.textContent = "相手";
        senderToggle.className = "sender-toggle is-other";
      } else {
        currentSender = "mine";
        senderToggle.textContent = "自分";
        senderToggle.className = "sender-toggle is-mine";
      }
    });
  }

  if (chatClearBtn) {
    chatClearBtn.addEventListener("click", () => {
      chatMessages.innerHTML = `
        <div class="chat-bubble bubble-other">
          絵文字できた？見せてみて！✨
        </div>
      `;
    });
  }

  function insertEmojiToChatInput(dataUrl, name) {
    chatInput.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      const img = document.createElement("img");
      img.className = "chat-inline-emoji";
      img.src = dataUrl;
      img.alt = name;
      chatInput.appendChild(img);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!chatInput.contains(range.commonAncestorContainer)) {
      const img = document.createElement("img");
      img.className = "chat-inline-emoji";
      img.src = dataUrl;
      img.alt = name;
      chatInput.appendChild(img);
    } else {
      const img = document.createElement("img");
      img.className = "chat-inline-emoji";
      img.src = dataUrl;
      img.alt = name;
      range.deleteContents();
      range.insertNode(img);

      range.setStartAfter(img);
      range.setEndAfter(img);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  function sendChatMessage() {
    const textContent = chatInput.textContent.trim();
    const images = chatInput.querySelectorAll("img.chat-inline-emoji");

    if (!textContent && images.length === 0) return;

    const bubble = document.createElement("div");
    const isMine = currentSender === "mine";
    const bubbleClass = isMine ? "bubble-mine" : "bubble-other";

    if (!textContent && images.length > 0 && images.length <= 3) {
      bubble.className = `chat-bubble ${bubbleClass} stamp-only`;
      images.forEach((img) => {
        const stampImg = document.createElement("img");
        stampImg.className = "chat-stamp";
        stampImg.src = img.src;
        stampImg.alt = img.alt;
        bubble.appendChild(stampImg);
      });
    } else {
      bubble.className = `chat-bubble ${bubbleClass}`;
      Array.from(chatInput.childNodes).forEach((node) => {
        bubble.appendChild(node.cloneNode(true));
      });
    }

    chatMessages.appendChild(bubble);
    chatInput.innerHTML = "";
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatSendBtn.addEventListener("click", sendChatMessage);

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      chatWindow.style.backgroundColor = btn.dataset.color;
    });
  });
});
