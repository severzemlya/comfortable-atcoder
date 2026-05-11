export function isEnable(storageKey: string, defaultValue = false): Promise<boolean> {
  return new Promise(resolve => {
    chrome.storage.sync.get([storageKey], result => {
      if (storageKey in result) {
        resolve(Boolean(result[storageKey]));
      } else {
        resolve(defaultValue);
      }
    });
  });
}

export async function domLoad(): Promise<void> {
  await new Promise<void>(resolve => {
    $(() => {
      resolve();
    });
  });
}

export async function runIfEnableAndLoad(storageKey: string, fn: Function, defaultValue = false): Promise<void> {
  const [enable] = await Promise.all([isEnable(storageKey, defaultValue), domLoad()]);
  if (enable) {
    fn();
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

export function createNotification(params: any): void {
  chrome.runtime.sendMessage({ type: 'create-notification', data: params });
}
