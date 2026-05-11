import { Lock } from '../lib/lock';
import { Contest, JudgeStatus, parseJudgeStatus, Submission } from '../lib/atcoder';
import { createNotification } from './notification';
import { WatchingListManager } from './watching-list-manager';
import { notifyLock } from './notify-lock';

interface MessageResultError {
  error: string;
}

interface SubmissionMessage {
  contest: Contest;
  id: string;
  probTitle: string;
  score: string;
  judgeStatus: JudgeStatus;
  execTime?: string;
  memoryUsage?: string;
  detailAbsoluteUrl: string;
}

interface JudgeResultImageStyle {
  foreColor?: string;
  backColor?: string;
}

interface WatchingSubmission {
  contestId: string;
  id: string;
  probTitle: string;
  score: string;
  detailAbsoluteUrl: string;
  startedAt: number;
  prevTime: number;
  prevStatusText: string;
  prevStatusNow?: number;
  maxSleepMilliseconds: number;
}

declare class OffscreenCanvas {
  width: number;
  height: number;
  constructor(width: number, height: number);
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
  convertToBlob(options?: { type?: string }): Promise<Blob>;
}

const judgeResultImageStyle: { [key: string]: JudgeResultImageStyle } = {
  AC: { backColor: '#5cb85c' },
  WA: { backColor: 'hsl(0, 84%, 62%)' },
};

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function makeJudgeStatusImageUrl(judgeResult: string): Promise<string> {
  let foreColor = 'white';
  let backColor = '#f0ad4e';
  if (judgeResult in judgeResultImageStyle) {
    const newStyle = judgeResultImageStyle[judgeResult];
    if (newStyle.foreColor !== undefined) {
      foreColor = newStyle.foreColor;
    }
    if (newStyle.backColor !== undefined) {
      backColor = newStyle.backColor;
    }
  }
  const canvas = new OffscreenCanvas(192, 192);
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error("canvas.getContext('2d') was failed");
  ctx.fillStyle = backColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "80px 'Lato','Helvetica Neue',arial,sans-serif";
  ctx.fillStyle = foreColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(judgeResult, canvas.width / 2, canvas.height / 2);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl: string = await new Promise(resolve => {
    const reader = new FileReader();
    reader.addEventListener('loadend', () => {
      resolve(reader.result as string);
    });
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}

const watchingSubmissionManager = new WatchingListManager<WatchingSubmission>(
  'submission',
  24 * 60 * 60 * 1000,
  null as unknown as WatchingSubmission,
);
const alarmNamePrefix = 'watch-submission:';

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, '')).trim();
}

function findDetail(details: { [key: string]: string }, patterns: string[]): string | undefined {
  for (const [key, value] of Object.entries(details)) {
    for (const pattern of patterns) {
      if (key.search(pattern) >= 0) {
        return value;
      }
    }
  }
  return undefined;
}

function parseSubmissionFromDetailHtml(html: string, submission: Submission): Submission {
  const rows = html.match(/<tr[\s\S]*?<\/tr>/g) || [];
  const details: { [key: string]: string } = {};
  for (const row of rows) {
    const th = row.match(/<th[\s\S]*?>([\s\S]*?)<\/th>/);
    const td = row.match(/<td[\s\S]*?>([\s\S]*?)<\/td>/);
    if (th === null || td === null) {
      continue;
    }
    details[stripTags(th[1])] = stripTags(td[1]);
  }
  const statusText = findDetail(details, ['結果', 'Status']);
  const score = findDetail(details, ['点', 'Score']);
  if (statusText === undefined || score === undefined) {
    throw new Error("getCurrentSubmission: Can't get status or score");
  }
  return new Submission({
    contest: submission.contest,
    id: submission.id,
    probTitle: submission.probTitle,
    score,
    judgeStatus: parseJudgeStatus(statusText),
    execTime: findDetail(details, ['実行時間', 'Exec Time']),
    memoryUsage: findDetail(details, ['メモリ', 'Memory']),
  });
}

class SubmissionWatcher {
  constructor(private watchingSubmission: WatchingSubmission, private notifyLock: Lock) { }

  get submission(): Submission {
    return new Submission({
      contest: new Contest(this.watchingSubmission.contestId),
      id: this.watchingSubmission.id,
      probTitle: this.watchingSubmission.probTitle,
      score: this.watchingSubmission.score,
      judgeStatus: parseJudgeStatus(this.watchingSubmission.prevStatusText),
    });
  }

  async step(timeout = 30 * 60 * 1000): Promise<void> {
    console.log('SubmissionWatcher: start:', this.submission);
    const submission = await this.getCurrentSubmission();
    console.log('SubmissionWatcher: in progress:', this.submission, submission);
    if (!submission.judgeStatus.isWaiting) {
      let message = '';
      // ジャッジ中か
      if (submission.judgeStatus.now !== undefined) {
        message += 'Judging...';
      } else {
        message += `Score: ${submission.score} points`;
      }
      // 結果が取得できたなら表示
      if (submission.execTime) {
        message += `\n${submission.execTime}`;
      }
      if (submission.memoryUsage) {
        message += `\n${submission.memoryUsage}`;
      }
      console.log('SubmissionWatcher: notification:', this.submission, submission);
      createNotification({
        data: {
          type: 'basic',
          iconUrl: await makeJudgeStatusImageUrl(submission.judgeStatus.text),
          title: submission.probTitle,
          message,
        },
        href: submission.detailAbsoluteUrl,
      }, this.notifyLock);
      await watchingSubmissionManager.remove(submission.id);
      await chrome.alarms.clear(alarmNamePrefix + submission.id);
      return;
    }
    const curTime = Date.now();
    if (curTime - this.watchingSubmission.startedAt >= timeout) {
      await watchingSubmissionManager.remove(submission.id);
      await chrome.alarms.clear(alarmNamePrefix + submission.id);
      return;
    }
    const prevStatusNow = this.watchingSubmission.prevStatusNow;
    const dt = curTime - this.watchingSubmission.prevTime;
    let sleepMilliseconds = this.watchingSubmission.maxSleepMilliseconds;
    if (prevStatusNow !== undefined) {
      const diff = (submission.judgeStatus.now as number) - prevStatusNow;
      const estimated = dt === 0 ? 0 : Math.floor(((submission.judgeStatus.rest as number) * dt) / (diff + 1));
      sleepMilliseconds = Math.min(sleepMilliseconds, Math.max(estimated, 1 * 1000));
      // ジャッジが進まないなら頻度を下げる
      if (diff === 0) {
        this.watchingSubmission.maxSleepMilliseconds = Math.floor(this.watchingSubmission.maxSleepMilliseconds * 1.2);
      }
    }
    this.watchingSubmission.prevTime = curTime;
    this.watchingSubmission.prevStatusText = submission.judgeStatus.text;
    this.watchingSubmission.prevStatusNow = submission.judgeStatus.now;
    await watchingSubmissionManager.set(submission.id, this.watchingSubmission);
    chrome.alarms.create(alarmNamePrefix + submission.id, {
      when: Date.now() + sleepMilliseconds,
    });
  }

  async getCurrentSubmission() {
    // submission画面を開いているものがあればそこから取得
    const tabs: chrome.tabs.Tab[] = await new Promise(resolve => {
      chrome.tabs.query({ url: `*://atcoder.jp/contests/${this.submission.contest.id}/submissions/me` }, resolve);
    });
    for (const tab of tabs) {
      if (tab.id === undefined) {
        continue;
      }
      const result: SubmissionMessage | MessageResultError | null = await Promise.race([
        new Promise<SubmissionMessage | MessageResultError>(resolve => {
          const message = { type: "get-submission", id: this.submission.id };
          console.log(`send message to tab ${tab.id!}:`, this.submission);
          chrome.tabs.sendMessage(tab.id!, message, resolve);
        }),
        (async () => {
          await sleep(1 * 1000);
          return null;
        })(),
      ]);
      if (result) {
        if ('error' in result) {
          console.error(result.error);
        }
        else {
          console.log('submission was found in tabs:', result);
          return new Submission(result);
        }
      }
    }
    // 取得できなかった場合、detail画面をfetchする
    const response = await fetch(this.watchingSubmission.detailAbsoluteUrl, { cache: 'no-cache' });
    const html = await response.text();
    const result = parseSubmissionFromDetailHtml(html, this.submission);
    console.log('submission was fetched:', result);
    return result;
  }
}

const lock = new Lock();

export async function watchSubmissionRegister(submission: SubmissionMessage): Promise<void> {
  let has = false;
  const now = Date.now();
  await lock.acquire(async () => {
    if (await watchingSubmissionManager.isWatching(submission.id)) {
      has = true;
      return;
    }
    await watchingSubmissionManager.set(submission.id, {
      contestId: submission.contest.id,
      id: submission.id,
      probTitle: submission.probTitle,
      score: submission.score,
      detailAbsoluteUrl: submission.detailAbsoluteUrl,
      startedAt: now,
      prevTime: now,
      prevStatusText: submission.judgeStatus.text,
      prevStatusNow: submission.judgeStatus.now,
      maxSleepMilliseconds: 5 * 1000,
    });
  });
  if (has) return;
  chrome.alarms.create(alarmNamePrefix + submission.id, {
    when: Date.now() + 100,
  });
}

export async function resumeWatchingSubmissions(): Promise<void> {
  const entries = await watchingSubmissionManager.entries();
  for (const [submissionId] of entries) {
    chrome.alarms.create(alarmNamePrefix + submissionId, {
      when: Date.now() + 100,
    });
  }
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (!alarm.name.startsWith(alarmNamePrefix)) {
    return;
  }
  const submissionId = alarm.name.slice(alarmNamePrefix.length);
  (async () => {
    const watchingSubmission = await watchingSubmissionManager.get(submissionId);
    if (watchingSubmission === null) return;
    await new SubmissionWatcher(watchingSubmission, notifyLock).step();
  })().catch(error => {
    console.error('SubmissionWatcher alarm error:', error);
  });
});
