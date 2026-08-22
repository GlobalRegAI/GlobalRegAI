// GlobalRegAI Browser Agent Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_PAGE_METRICS") {
    const pageData = {
      title: document.title,
      url: window.location.href,
      inputs: Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
        id: el.id,
        name: el.name,
        type: el.type,
        value: el.value
      }))
    };
    sendResponse({ status: "SUCCESS", data: pageData });
  }

  if (request.action === "AUTO_FILL_GMP_PORTAL") {
    const payload = request.data;
    let count = 0;
    const mappings = [
      { selector: 'input[name*="productName"], input#productName, input#item_name', value: payload.product_name },
      { selector: 'input[name*="batchSize"], input#batchSize, input#lot_size', value: payload.batch_size },
      { selector: 'textarea[name*="valSummary"], textarea#valSummary, textarea#summary', value: payload.validation_summary },
      { selector: 'input[name*="valDate"], input#valDate, input#effective_date', value: payload.effective_date }
    ];

    mappings.forEach(m => {
      if (m.value) {
        const elem = document.querySelector(m.selector);
        if (elem) {
          elem.value = m.value;
          elem.dispatchEvent(new Event('input', { bubbles: true }));
          elem.dispatchEvent(new Event('change', { bubbles: true }));
          count++;
        }
      }
    });
    sendResponse({ status: "COMPLETED", filledCount: count });
  }
});
