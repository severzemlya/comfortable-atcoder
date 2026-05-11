import { createNotification } from './notification'
import { resumeWatchingSubmissions, watchSubmissionRegister } from './submission-watcher';
import { checkClarification } from './clar-watcher';
import { Lock } from '../lib/lock';
import './oninstall';

const notifyLock = new Lock();

resumeWatchingSubmissions();

chrome.runtime.onMessage.addListener(({ type, data }, _, sendResponse) => {
  (async () => {
    switch (type) {
      case 'create-notification':
        await createNotification(data, notifyLock);
        break;
      case 'watch-submission-register':
        await watchSubmissionRegister(data);
        break;
      case 'check-clarification':
        await checkClarification(data, notifyLock);
        break;
      default:
        console.error(`unknown message: ${type}`);
    }
    sendResponse({ ok: true });
  })().catch(error => {
    console.error(error);
    sendResponse({ error: error instanceof Error ? error.message : String(error) });
  });
  return true;
});
