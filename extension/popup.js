document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("trigger_autofill_btn");
  const statusEl = document.getElementById("extension_status");

  btn.addEventListener("click", async () => {
    statusEl.innerText = "Triggering Auto-Fill...";
    statusEl.style.color = "#60a5fa";

    if (typeof chrome !== "undefined" && chrome.tabs) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "AUTO_FILL_GMP_PORTAL" }, (res) => {
          if (res && res.status === "SUCCESS") {
            statusEl.innerText = "100% Auto-Filled!";
            statusEl.style.color = "#10b981";
          }
        });
      }
    } else {
      // Fallback postMessage for window context testing
      window.postMessage({ action: "AUTO_FILL_GMP_PORTAL" }, "*");
      statusEl.innerText = "Action Dispatched (PostMessage)";
      statusEl.style.color = "#10b981";
    }
  });
});
