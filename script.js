// script.js

function runCheck() {
  const modeA = document.getElementById("modeA").checked;
  const modeB = document.getElementById("modeB").checked;
  const sourceText = document.getElementById("sourceText").value;
  const designText = document.getElementById("designText").value;
  const resultDiv = document.getElementById("result");
  let result = "";

  // Aモード：価格チェック
  if (modeA) {
    const priceRegex = /([1-9]\d{2,4})円（税抜価格([1-9]\d{2,4})円）/g;
    const matches = [...designText.matchAll(priceRegex)];

    result += "🧾【価格チェック】\n";
    if (matches.length === 0) {
      result += "⚠ 価格形式が見つかりません\n";
    } else {
      for (const [_, taxInStr, taxExStr] of matches) {
        const taxIn = parseInt(taxInStr);
        const taxEx = parseInt(taxExStr);
        const calcIn = Math.round(taxEx * 1.08);
        if (calcIn !== taxIn) {
          result += `❌ ${taxEx}円 → 税込 ${calcIn}円のはず → 実際: ${taxIn}円\n`;
        } else {
          result += `✅ ${taxEx}円 → ${taxIn}円（OK）\n`;
        }
      }
    }
    result += "\n";
  }

  // Bモード：テキスト差分
  if (modeB) {
    const srcLines = sourceText.split(/\r?\n/);
    const desLines = designText.split(/\r?\n/);
    result += "📄【差分チェック】\n";
    srcLines.forEach((line, i) => {
      if (line !== desLines[i]) {
        result += `⚠ ${i + 1}行目：原稿「${line}」 ≠ デザイン「${desLines[i] || "（なし）"}」\n`;
      }
    });
  }

  resultDiv.innerText = result || "✅ 問題なし！";
}

// 原稿ファイル読み込み（PDFまたはExcel）
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
      const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
      const page = await pdf.getPage(1);

      const canvas = document.getElementById("hiddenCanvas");
      const ctx = canvas.getContext("2d");
      const viewport = page.getViewport({ scale: 2 });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      if (useOCR) {
        const { data: { text } } = await Tesseract.recognize(canvas, 'jpn');
        document.getElementById("sourceText").value = text;
      } else {
        const textContent = await page.getTextContent();
        const strings = textContent.items.map((item) => item.str);
        document.getElementById("sourceText").value = strings.join("\n");
      }
    };
    reader.readAsArrayBuffer(file);
  }
});

// 完成デザインPDF読み込み
document.getElementById("designPDF").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function () {
    const typedarray = new Uint8Array(this.result);
    const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();
    const strings = textContent.items.map((item) => item.str);
    document.getElementById("designText").value = strings.join("\n");
  };
  reader.readAsArrayBuffer(file);
});
