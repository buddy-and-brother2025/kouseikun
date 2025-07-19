// script.js

function runCheck() {
  const modeA = document.getElementById("modeA").checked;
  const modeB = document.getElementById("modeB").checked;
  const sourceText = document.getElementById("sourceText").value;
  const designText = document.getElementById("designText").value;
  const resultDiv = document.getElementById("result");
  let result = "";

  if (modeA) {
    result += "🧾【価格チェック】\n";
    const text = designText.replace(/\s+/g, " ");
    const pattern = /([\d,]{2,5})円\s*[（(]?(税込価格|税抜価格|本体価格)?[：:\s]?([\d,]{2,5})円[）)]?/g;
    const matches = [...text.matchAll(pattern)];

    if (matches.length === 0) {
      result += "⚠ 価格形式が見つかりません\n";
    } else {
      for (const match of matches) {
        const val1 = parseInt(match[1].replace(/,/g, ""));
        const label = match[2];
        const val2 = parseInt(match[3].replace(/,/g, ""));

        if (!label) {
          const big = Math.max(val1, val2);
          const small = Math.min(val1, val2);
          const expected = Math.round(small * 1.1);
          const rel = Math.abs(big - expected) <= 1 ? "OK" : `❌ 誤差あり：${big}円 ≠ ${expected}円`;
          result += `⚠ ラベルなし：${val1}円 ⇄ ${val2}円 → ${rel}\n`;
        } else if (label.includes("税抜")) {
          const expected = Math.round(val2 * 1.1);
          if (Math.abs(val1 - expected) > 1) {
            result += `❌ 税抜${val2}円 → 税込は ${expected}円のはず → 実際: ${val1}円\n`;
          } else {
            result += `✅ 税抜${val2}円 → 税込${val1}円（OK）\n`;
          }
        } else if (label.includes("税込")) {
          const expected = Math.round(val1 * 1.1);
          if (Math.abs(val2 - expected) > 1) {
            result += `❌ 税抜${val1}円 → 税込は ${expected}円のはず → 実際: ${val2}円\n`;
          } else {
            result += `✅ 税抜${val1}円 → 税込${val2}円（OK）\n`;
          }
        } else {
          result += `⚠ ${label}：${val1}円 ⇄ ${val2}円 → ラベル判定できず\n`;
        }
      }
    }

    result += "\n📦【数量・単位チェック】\n";
    const unitRegex = /\d+(個|コ|ヶ|ケ|個入|枚|本|本入)/g;
    const unitMatches = [...text.matchAll(unitRegex)].map(m => m[1]);
    const uniqueUnits = [...new Set(unitMatches)];
    if (uniqueUnits.length <= 1) {
      result += `✅ 表記ゆれなし（${uniqueUnits[0] || "単位未検出"}）\n`;
    } else {
      result += `⚠ 表記ゆれあり：「${uniqueUnits.join("」「")}」が混在しています\n`;
    }
    result += "\n";
  }

  if (modeB) {
    const srcLines = sourceText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
    const desText = designText.replace(/\s+/g, " ");
    result += "📄【差分チェック】\n";
    srcLines.forEach((line, i) => {
      if (!desText.includes(line)) {
        result += `⚠ 原稿の文「${line}」がデザインに見つかりません\n`;
      }
    });
  }

  resultDiv.innerText = result || "✅ 問題なし！";
}

document.getElementById("sourceFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const mode = document.querySelector("input[name='sourceMode']:checked").value;
  const useOCR = document.getElementById("useOCR").checked;
  if (!file) return;

  if (mode === "excel") {
    const reader = new FileReader();
    reader.onload = function (e) {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const text = XLSX.utils.sheet_to_csv(sheet);
      document.getElementById("sourceText").value = text;
    };
    reader.readAsArrayBuffer(file);
  } else if (mode === "pdf") {
    const reader = new FileReader();
    reader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      const loadingTask = pdfjsLib.getDocument({
        data: typedarray,
        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
        cMapPacked: true,
        useWorkerFetch: true
      });

      const pdf = await loadingTask.promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const canvas = document.getElementById("hiddenCanvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const viewport = page.getViewport({ scale: 2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;

        if (useOCR) {
          console.log("🧠 OCRモードで処理中"); // ← ★ここに追加！
          const { data: { text } } = await Tesseract.recognize(canvas, 'jpn');
          fullText += text + "\n";
        } else {
          const textContent = await page.getTextContent();
          console.log("textContent の中身：", textContent); // ← ★追加
          const strings = textContent.items.map((item) => item.str);
          console.log("strings の中身：", strings); // ← ★追加
          fullText += strings.join(" ") + "\n";
        }
      }
      document.getElementById("sourceText").value = fullText;
    };
    reader.readAsArrayBuffer(file);
  }
});

document.getElementById("designPDF").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const loadingTask = pdfjsLib.getDocument({
      data: typedarray,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
      cMapPacked: true,
      useWorkerFetch: true
    });
    const pdf = await loadingTask.promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const strings = textContent.items.map((item) => item.str);
      fullText += strings.join(" ") + "\n";
    }
    document.getElementById("designText").value = fullText;
  };
  reader.readAsArrayBuffer(file);
});
