function defaultPayload() {
  return `\"><img src=x onerror=alert(1)>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const payloadEl = document.querySelector("#payload");
  const { payload } = await chrome.storage.sync.get({ payload: defaultPayload() });
  payloadEl.value = payload || defaultPayload();

  document.querySelector("#save").addEventListener("click", async () => {
    await chrome.storage.sync.set({ payload: payloadEl.value });
  });

  document.querySelector("#reset").addEventListener("click", async () => {
    payloadEl.value = defaultPayload();
    await chrome.storage.sync.set({ payload: payloadEl.value });
  });
});