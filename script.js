// script.js
window.onload = function () {
  console.log("✅ window.onload 発動 → JS動いてるよ！");
};
function checkPrices(text) {
  const results = [];

  const pattern = /（税抜価格\s*([\d,]+)円）\s*([\d,]+)\s*円/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const taxExcluded = parseInt(match[1].replace(/,/g, ""));
    const taxIncluded = parseInt(match[2].replace(/,/g, ""));
    const expected = Math.round(taxExcluded * 1.1);
    const diff = Math.abs(taxIncluded - expected);

    if (diff <= 1) {
      results.push(`✅ 税抜${taxExcluded}円 → 税込${taxIncluded}円（OK）`);
    } else {
      results.push(`❌ 税抜${taxExcluded}円 → 税込のはずが ${expected}円 → 実際: ${taxIncluded}円`);
    }
  }

  if (results.length === 0) {
    return "⚠ 価格形式が見つかりません";
  }

  return results.join("\n");
}



function runCheck() {
  const modeA = document.getElementById("modeA").checked;
  const modeB = document.getElementById("modeB").checked;
  const sourceText = document.getElementById("sourceText").value;
  const designText = document.getElementById("designText").value;
  const resultDiv = document.getElementById("result");
  let result = "";

  if (modeA) {
    const text = designText.replace(/\s+/g, " ");
    result += checkPrices(text) + "\n";

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
          console.log("🧠 OCRモードで処理中");
          const { data: { text } } = await Tesseract.recognize(canvas, 'jpn');
          fullText += text + "\n";
        } else {
          console.log("📄 テキスト抽出モードで処理中");

          const textContent = await page.getTextContent();
          console.log("textContent の中身：", textContent); // オブジェクト全体確認用

          // ↓ 以下を追加
          window._debugText = textContent;  // ← DevToolsで確認しやすく！
          console.log("✅ textContent を window._debugText に保存しました");

          const strings = textContent.items.map((item) => item.str);
          console.log("strings の中身：", strings); // 実際の文字列配列

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
