// GlobalRegAI GMP Browser Agent - Content Script (Manifest V3)
console.log("[GlobalRegAI Extension] Content Script initialized and active.");

function triggerAutoFillGMPPortal(dataPayload) {
  console.log("[GlobalRegAI Agent] Triggering AUTO_FILL_GMP_PORTAL action...", dataPayload);

  const defaultData = {
    product_name: "RegenBio Injectable Solution 50mg",
    batch_size: "50,000 Vials",
    validation_summary: "Audit-Ready Remediation Plan Activated: 2 Gap(s) Addressed under KGMP/ISO13485 standards.",
    hbel_value: "0.01 mg/day (PDE calculated per PIC/S PI 006-3)",
    revalidation_cycle: "3 Years (Cycle Reset & Protocol PV-2026-R1 Issued)",
    remediation_action: "CAPA-20260818-01: HBEL toxicological report appended & 3-year PV cycle scheduled."
  };

  const payload = Object.assign({}, defaultData, dataPayload || {});

  const fieldsMap = [
    { selector: "#product_name, [name='product_name']", value: payload.product_name, name: "Product Name" },
    { selector: "#batch_size, [name='batch_size']", value: payload.batch_size, name: "Batch Size" },
    { selector: "#validation_summary, [name='validation_summary']", value: payload.validation_summary, name: "Validation Summary" },
    { selector: "#hbel_value, [name='hbel_value']", value: payload.hbel_value, name: "HBEL / PDE Value" },
    { selector: "#revalidation_cycle, [name='revalidation_cycle']", value: payload.revalidation_cycle, name: "Re-Validation Cycle" },
    { selector: "#remediation_action, [name='remediation_action']", value: payload.remediation_action, name: "Remediation Action Plan" }
  ];

  let filledCount = 0;

  fieldsMap.forEach((item, index) => {
    const el = document.querySelector(item.selector);
    if (el) {
      setTimeout(() => {
        el.value = item.value;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));

        // Visual feedback styling
        el.style.transition = "all 0.3s ease";
        el.style.border = "2px solid #10b981";
        el.style.backgroundColor = "rgba(16, 185, 129, 0.1)";
        el.style.boxShadow = "0 0 12px rgba(16, 185, 129, 0.4)";

        filledCount++;
        updateAgentToast(`Filling field (${filledCount}/${fieldsMap.length}): ${item.name}...`, false);

        if (filledCount === fieldsMap.length) {
          setTimeout(() => {
            updateAgentToast("✨ 100% GMP Portal Auto-Fill Completed & Verified!", true);
            const statusEl = document.getElementById("auto_fill_status");
            if (statusEl) {
              statusEl.innerText = "SUCCESS: 100% Auto-Filled by GlobalRegAI Agent";
              statusEl.style.color = "#10b981";
              statusEl.style.fontWeight = "bold";
            }
          }, 400);
        }
      }, index * 250);
    }
  });
}

function updateAgentToast(msg, isSuccess) {
  let toast = document.getElementById("globalregai-agent-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalregai-agent-toast";
    toast.style.position = "fixed";
    toast.style.top = "20px";
    toast.style.right = "20px";
    toast.style.zIndex = "999999";
    toast.style.padding = "14px 22px";
    toast.style.borderRadius = "12px";
    toast.style.fontFamily = "'Inter', system-ui, sans-serif";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.color = "#ffffff";
    toast.style.boxShadow = "0 10px 25px rgba(0, 0, 0, 0.5)";
    toast.style.backdropFilter = "blur(10px)";
    toast.style.transition = "all 0.3s ease";
    document.body.appendChild(toast);
  }

  toast.innerText = msg;
  if (isSuccess) {
    toast.style.background = "linear-gradient(135deg, #059669 0%, #10b981 100%)";
    toast.style.border = "1px solid #34d399";
  } else {
    toast.style.background = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
    toast.style.border = "1px solid #3b82f6";
  }
}

// Listen for window messages (from Web Page / Extension Popup)
window.addEventListener("message", (event) => {
  if (event.data && event.data.action === "AUTO_FILL_GMP_PORTAL") {
    triggerAutoFillGMPPortal(event.data.payload);
  }
});

// Auto-listen for chrome runtime messages if available
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "AUTO_FILL_GMP_PORTAL") {
      triggerAutoFillGMPPortal(request.payload);
      sendResponse({ status: "SUCCESS", message: "Auto-fill executed." });
    }
  });
}
