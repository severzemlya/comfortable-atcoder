const betaHost = 'atcoder.jp';

export class Contest {
  public readonly url: string;

  constructor(public readonly id: string) {
    this.url = `/contests/${this.id}`;
  }
}

export interface SubmissionOption {
  contest: Contest;
  id: string;
  probTitle: string;
  score: string;
  judgeStatus: JudgeStatus;
  execTime?: string;
  memoryUsage?: string;
}

export class Submission {
  public readonly contest: Contest;

  public readonly id: string;

  public readonly score: string;

  public readonly judgeStatus: JudgeStatus;

  public readonly execTime: string | undefined;

  public readonly memoryUsage: string | undefined;

  public readonly probTitle: string;

  public readonly detailUrl: string;

  public readonly detailAbsoluteUrl: string;

  constructor({ contest, id, probTitle, score, judgeStatus, execTime, memoryUsage }: SubmissionOption) {
    this.contest = contest;
    this.id = id;
    this.score = score;
    this.judgeStatus = judgeStatus;
    this.execTime = execTime;
    this.memoryUsage = memoryUsage;
    this.probTitle = probTitle;
    this.detailUrl = `${contest.url}/submissions/${id}`;
    this.detailAbsoluteUrl = `https://${betaHost}${this.detailUrl}`;
  }
}

export interface JudgeStatusOption {
  text: string;
  now?: number;
  total?: number;
}

export class JudgeStatus {
  public readonly text: string;

  public readonly now: number | undefined;

  public readonly total: number | undefined;

  public readonly isWaiting: boolean;

  public readonly rest: number | undefined;

  constructor({ text, now, total }: JudgeStatusOption) {
    this.text = text;
    this.now = now;
    this.total = total;
    this.isWaiting = text === 'WJ' || text === 'WR';
    this.rest = total !== undefined && now !== undefined ? total - now : undefined;
  }
}

export function parseJudgeStatus(text: string): JudgeStatus {
  const reg = /[　\s]/g;
  // WJ
  if (text.search('/') >= 0) {
    const [progress, status] = text.search(' ') >= 0 ? text.split(' ') : [text, ''];
    const [now, total] = progress.split('/');
    return new JudgeStatus({
      text: status.replace(reg, '') || 'WJ',
      now: Number(now.replace(reg, '')),
      total: Number(total.replace(reg, '')),
    });
  }
  return new JudgeStatus({ text: text.replace(reg, '') });
}
