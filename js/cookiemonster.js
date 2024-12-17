async function getCookie(key) {
  const value = await getStorageValue(key);
  return value;
}

async function setCookie(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

async function deleteCookie(key) {
  await chrome.storage.local.set({ [key]: null });
}

async function getStorageValue(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(result[key]);
    });
  });
}

export default {
  set: setCookie,
  get: getCookie,
  delete: deleteCookie
};