function defaultPayload() {
  return ``;
}

document.addEventListener("DOMContentLoaded", async () => {
  const payloadEl = document.querySelector("#payload");


  let countDisplay = document.createElement("div");
  countDisplay.style.marginTop = "6px";
  countDisplay.style.fontSize = "12px";
  countDisplay.style.color = "#5d5d5dff";
  payloadEl.parentNode.appendChild(countDisplay);

  const { payload } = await chrome.storage.sync.get({
    payload: defaultPayload(),
  });
  payloadEl.value = payload || defaultPayload();

  document.querySelector("#save").addEventListener("click", async () => {
    await chrome.storage.sync.set({ payload: payloadEl.value });
    window.close();
  });

  document.querySelector("#fill").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;

    // block chrome://, edge://, about:, extensions pages
    const url = tab.url || "";
    if (/^(chrome|edge|about|chrome-extension):/.test(url)) {
      console.warn("Cannot inject into privileged pages:", url);
      countDisplay.textContent = "Cannot inject into this page";
      return;
    }

    await chrome.storage.sync.set({ payload: payloadEl.value });

    const result = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (p) => {
        let count = 0;

        const ev = () => new Event("input", { bubbles: true });
        const ch = () => new Event("change", { bubbles: true });

        const isFillable = (el) => {
          if (!el || el.disabled || el.readOnly) return false;
          const tag = el.tagName?.toLowerCase?.();
          if (tag === "textarea") return true;
          if (tag === "input") {
            const t = (el.type || "text").toLowerCase();
            const bad = new Set([
              "file","date","datetime-local","month","week",
              "time","color","range","hidden"
            ]);
            if (t === "password") return true; // Toggle accordingly, just like that previous one
            return !bad.has(t);
          }
          return false;
        };

        const setVal = (el, val) => {
          try { el.focus(); } catch(_) {}
          const tag = el.tagName?.toLowerCase?.();
          if (tag === "textarea" || tag === "input") {
            el.value = val;
            el.dispatchEvent(ev());
            el.dispatchEvent(ch());
            count++;
          }
        };

        const fillContentEditable = (root) => {
          const nodes = root.querySelectorAll('[contenteditable=true],[contenteditable=""]');
          for (const n of nodes) {
            if (n.isContentEditable) {
              try { n.focus(); } catch(_) {}
              try { n.innerHTML = p; } catch(_) { n.textContent = p; }
              count++;
            }
          }
        };

        const inputs = Array.from(document.querySelectorAll("input,textarea")).filter(isFillable);
        inputs.forEach(el => setVal(el,p));
        fillContentEditable(document);

        for (const f of document.querySelectorAll("iframe")) {
          try {
            const d = f.contentDocument; if (!d) continue;
            const innerInputs = Array.from(d.querySelectorAll("input,textarea")).filter(isFillable);
            innerInputs.forEach(el => setVal(el,p));
            fillContentEditable(d);
          } catch(_) {}
        }

        for (const form of document.forms) {
          try {
            form.dispatchEvent(new Event("input",{bubbles:true}));
            form.dispatchEvent(new Event("change",{bubbles:true}));
            form.submit();
          } catch(_) {}
        }

        return count;
      },
      args: [payloadEl.value],
    });

    const total = result[0].result || 0;
    countDisplay.textContent = `Payload sent through ${total} inputs.`;
  });
});
