import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANG_STORAGE_KEY = "eglc_lang";
const SUPPORTED = ["th", "en"];
const LANG_TRANSITION_CLASS = "lang-switching";
const LANG_TRANSITION_MS = 260;

let langTransitionTimer = null;

function getInitialLang() {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;

    const nav = (navigator.language || "").toLowerCase();
    if (nav.startsWith("th")) return "th";
  } catch {
    // ignore
  }
  return "en";
}

const resources = {
  th: {
    translation: {
      // ===== Global / Header =====
      title: "Express GL Cleaner",
      subtitle: "Upload -> Clean -> Download",

      dark: "Dark",
      light: "Light",
      privacyPolicyNotice:
        "นโยบายความเป็นส่วนตัว: ข้อมูลที่อัปโหลดจะถูกใช้เพื่อประมวลผลภายในระบบนี้เท่านั้น",
      nonCommercialStrict: "ห้ามนำไปใช้เชิงพาณิชย์เด็ดขาด",

      // ===== ETL (Express GL) =====
      headline: "ทำความสะอาดไฟล์ GL จาก Express อัตโนมัติ",
      desc: "รองรับไฟล์ CSV ภาษาไทยจาก Express และแปลงวันที่เป็น m/d/yyyy (ค.ศ.) พร้อมสร้างคอลัมน์ Value",

      drop: "ลากไฟล์ CSV มาวางที่นี่",
      dropSub: "หรือคลิกเพื่อเลือกไฟล์จากเครื่อง",

      selected: "ไฟล์ที่เลือก",
      clean: "Clean & Download",
      reset: "Reset",

      tip: "Tip: ถ้าเปิดไฟล์ไทยใน Excel แนะนำให้ Export/Save เป็น UTF-8-SIG",

      featuresTitle: "Features",
      reviewsTitle: "Reviews",

      features1: "คุมรูปแบบวันที่",
      features1d: "แปลง dd/mm/พ.ศ. → m/d/yyyy (ค.ศ.)",
      features2: "คำนวณ Value",
      features2d: "1/5: Debit - Credit, 2/3/4: Credit - Debit",
      features3: "ลบแถวไม่เกี่ยวข้อง",
      features3d: "ตัดหัวรายงาน/แถวรวม/แถวว่าง",

      dropHintDragging: "ปล่อยเพื่ออัปโหลดไฟล์",
      dropHintReady: "วางไฟล์เรียบร้อย พร้อม Clean",
      dropHintIdle: "รองรับไฟล์ .csv เท่านั้น",

      previewTitle: "Preview",
      validationTitle: "Validation",
      summaryTitle: "Report Summary",
      rawPreviewTitle: "Raw Preview",
      cleanPreviewTitle: "Clean Preview",

      errors: "Errors",
      warnings: "Warnings",
      showMore: "ดูเพิ่มเติม",
      showLess: "ย่อ",
      downloadAnyway: "ดาวน์โหลดต่อแม้มี Error",
      blockedByErrors: "มี Error ต้องแก้ก่อนดาวน์โหลด",
      loadingPreview: "กำลังสร้าง Preview...",

      howTitle: "How it works",
      howSubtitle: "3 ขั้นตอนง่าย ๆ: อัปโหลด → ตรวจสอบ → ดาวน์โหลดไฟล์ที่ Clean แล้ว",
      howStep1Title: "Upload CSV",
      howStep1Desc: "ลากไฟล์จาก Express มาวาง หรือคลิกเลือกไฟล์ ระบบจะเตรียมข้อมูลสำหรับ Preview อัตโนมัติ",
      howStep2Title: "Preview & Validate",
      howStep2Desc: "ดูตัวอย่าง Raw vs Clean พร้อมสรุป Error/Warning เพื่อป้องกันข้อมูลผิดพลาดก่อนดาวน์โหลด",
      howStep3Title: "Clean & Download",
      howStep3Desc: "กด Clean & Download เพื่อดาวน์โหลดไฟล์มาตรฐาน พร้อมคอลัมน์ Value และรูปแบบวันที่ที่ถูกต้อง",

      // ===== Report Price (Transpose) =====
      rpTitle: "Report Price",
      rpSubtitle: "Transpose",
      rpSteps: "1) อัปโหลดไฟล์ → 2) ตรวจหาเหรียญ → 3) เลือกเหรียญ → Clean & Download",

      rpHowTitle: "How it works",
      rpHowSubtitle: "Step-by-step flow for report processing",
      rpHowStep1Title: "Upload .xlsx",
      rpHowStep1Desc: "Drop your xlsx here",
      rpHowStep2Title: "Review & Select",
      rpHowStep2Desc: "Select asset, BOT option, and coins to keep.",
      rpHowStep3Title: "Clean & Download",
      rpHowStep3Desc: "Check preview, then export your cleaned file.",

      asset: "Asset",
      usd: "USD",
      thb: "THB",
      botRate: "BOT rate",

      dropXlsx: "ลากไฟล์ .xlsx มาวางที่นี่",
      dropXlsxSub: "ระบบจะตรวจเหรียญในไฟล์ให้อัตโนมัติ",
      chooseFile: "เลือกไฟล์",

      coinSelectTitle: "เลือกเหรียญ",
      searchCoin: "ค้นหาเหรียญ......",
      allCoins: "ทั้งหมด",
      watchlist: "Watchlist",
      selectAll: "เลือกทั้งหมด",
      clear: "ล้าง",
      summary: "Summary",
      detected: "Detected",
      selectedCount: "Selected",
      rows: "Rows",
      missingCoins: "Missing coins",
      rpSelectBeforeDownload: "ต้องเลือกเหรียญก่อนถึงดาวน์โหลดได้",
      rpCoinSearchHint: "ค้นหาได้ทั้งพิมพ์เล็ก/ใหญ่ + มี dropdown",
      rpDropHintIdle: "xlsx only",
      rpNoWatchlistCoins: "ไม่พบเหรียญใน Watchlist ของไฟล์ล่าสุด",
      rpNoCoinMatch: "ไม่พบเหรียญที่ตรงกับคำค้นหา",
    },
  },

  en: {
    translation: {
      // ===== Global / Header =====
      title: "Express GL Cleaner",
      subtitle: "Upload -> Clean -> Download",

      dark: "Dark",
      light: "Light",
      privacyPolicyNotice:
        "Privacy policy: Uploaded data is used only for processing within this system.",
      nonCommercialStrict: "Commercial use is strictly prohibited.",

      // ===== ETL (Express GL) =====
      headline: "Clean Express GL CSV automatically",
      desc: "Supports Thai CSV export from Express: standardizes columns, normalizes dates, and adds a Value column.",

      drop: "Drop your CSV here",
      dropSub: "or click to choose a file",

      selected: "Selected file",
      clean: "Clean & Download",
      reset: "Reset",

      tip: "Tip: For Thai text in Excel, UTF-8-SIG is recommended.",

      featuresTitle: "Features",
      reviewsTitle: "Reviews",

      features1: "Standardize output format",
      features1d: "Reorder columns + remove noise/blank rows",
      features2: "Automatic Value calculation",
      features2d: "1/5: Debit - Credit, 2/3/4: Credit - Debit",
      features3: "Thai-friendly CSV support",
      features3d: "Designed for Express exports and reduced encoding issues",

      dropHintDragging: "Drop to upload",
      dropHintReady: "File added. Ready to clean",
      dropHintIdle: "CSV only",

      previewTitle: "Preview",
      validationTitle: "Validation",
      summaryTitle: "Report Summary",
      rawPreviewTitle: "Raw Preview",
      cleanPreviewTitle: "Clean Preview",

      errors: "Errors",
      warnings: "Warnings",
      showMore: "Show more",
      showLess: "Show less",
      downloadAnyway: "Download anyway (ignore errors)",
      blockedByErrors: "Errors found. Please fix before download.",
      loadingPreview: "Generating preview...",

      howTitle: "How it works",
      howSubtitle: "3 simple steps: Upload -> Validate -> Download cleaned data",
      howStep1Title: "Upload CSV",
      howStep1Desc: "Drag & drop your Express export file, or click to select. The app auto-prepares a preview.",
      howStep2Title: "Preview & Validate",
      howStep2Desc: "Compare Raw vs Clean with Errors/Warnings so you can catch issues before downloading.",
      howStep3Title: "Clean & Download",
      howStep3Desc: "Click Clean & Download to export the standardized file with Value and corrected dates.",

      // ===== Report Price (Transpose) =====
      rpTitle: "Report Price",
      rpSubtitle: "Transpose",
      rpSteps: "1) Upload -> 2) Detect coins -> 3) Select coins -> Clean & Download",

      rpHowTitle: "How it works",
      rpHowSubtitle: "Step-by-step flow for report processing",
      rpHowStep1Title: "Upload .xlsx",
      rpHowStep1Desc: "Drop your xlsx here",
      rpHowStep2Title: "Review & Select",
      rpHowStep2Desc: "Select asset, BOT option, and coins to keep.",
      rpHowStep3Title: "Clean & Download",
      rpHowStep3Desc: "Check preview, then export your cleaned file.",

      asset: "Asset",
      usd: "USD",
      thb: "THB",
      botRate: "BOT rate",

      dropXlsx: "Drop your .xlsx here",
      dropXlsxSub: "Auto-detect coins from the file",
      chooseFile: "Choose file",

      coinSelectTitle: "Select coins",
      searchCoin: "Search coins...",
      allCoins: "All",
      watchlist: "Watchlist",
      selectAll: "Select all",
      clear: "Clear",
      summary: "Summary",
      detected: "Detected",
      selectedCount: "Selected",
      rows: "Rows",
      missingCoins: "Missing coins",
      rpSelectBeforeDownload: "Select at least one coin before downloading.",
      rpCoinSearchHint: "Case-insensitive search with dropdown suggestions.",
      rpDropHintIdle: "xlsx only",
      rpNoWatchlistCoins: "No coins found in watchlist from the latest file.",
      rpNoCoinMatch: "No matching coins found.",
    },
  },
};

// ป้องกันการ init ซ้ำตอน Vite HMR
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: getInitialLang(),
    fallbackLng: "en",
    supportedLngs: SUPPORTED,
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

// helper: language toggle + persist selected language
function animateLanguageSwitch() {
  if (typeof document === "undefined") return;

  const root = document.getElementById("root");
  const targets = [document.documentElement, document.body, root].filter(
    Boolean,
  );

  for (const el of targets) {
    el.classList.add(LANG_TRANSITION_CLASS);
  }

  if (langTransitionTimer) {
    window.clearTimeout(langTransitionTimer);
  }

  langTransitionTimer = window.setTimeout(() => {
    for (const el of targets) {
      el.classList.remove(LANG_TRANSITION_CLASS);
    }
    langTransitionTimer = null;
  }, LANG_TRANSITION_MS);
}

export function setAppLanguage(lng) {
  const next = SUPPORTED.includes(lng) ? lng : "en";
  const current = String(i18n.resolvedLanguage || i18n.language || "")
    .toLowerCase()
    .trim();

  if (current.startsWith(next)) return;

  animateLanguageSwitch();
  i18n.changeLanguage(next);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

export default i18n;
