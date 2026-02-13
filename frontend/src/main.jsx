import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";          // ✅ เพิ่มบรรทัดนี้
import Root from "./Root";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
