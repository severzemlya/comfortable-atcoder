import { runIfEnableAndLoad } from './all';
import * as Betalib from './betalib';

type ProblemResult = 'accepted' | 'tried';

function resultClass(result: ProblemResult): string {
  return result === 'accepted' ? 'success' : 'warning';
}

function getProblemResult(submissions: Betalib.Submission[]): ProblemResult | null {
  if (submissions.length === 0) {
    return null;
  }
  return submissions.some(submission => submission.judgeStatus.text === 'AC') ? 'accepted' : 'tried';
}

function getProblemId($row: JQuery<HTMLElement>, problemColumnIndex: number, contest: Betalib.Contest): string | null {
  const href = $row
    .children('td')
    .eq(problemColumnIndex)
    .find('a')
    .attr('href');
  if (href === undefined) {
    return null;
  }
  const match = href.match(new RegExp(`${contest.url.replace(/\//g, '\\/')}\\/tasks\\/([^/?#]+)`));
  return match === null ? null : match[1];
}

runIfEnableAndLoad('tasks-result-color', async () => {
  if (!location.pathname.match(/^\/contests\/[^/]+\/tasks\/?$/)) {
    return;
  }
  const contest = Betalib.getCurrentContest();
  const submissionsByProblem: { [key: string]: Betalib.Submission[] } = {};
  for (const submission of await Betalib.getAllMySubmissions()) {
    if (!(submission.problemId in submissionsByProblem)) {
      submissionsByProblem[submission.problemId] = [];
    }
    submissionsByProblem[submission.problemId].push(submission);
  }

  const $table = $('table').eq(0);
  const indexes = Betalib.getIndexes($('thead > tr > th', $table), { prob: ['Task Name', '問題'] });
  if (indexes.prob === undefined) {
    throw new Error("tasks-result-color: Can't get problem column");
  }

  $('tbody > tr', $table).each((_, row) => {
    const $row = $(row);
    const problemId = getProblemId($row, indexes.prob, contest);
    if (problemId === null) {
      return;
    }
    const result = getProblemResult(submissionsByProblem[problemId] || []);
    if (result === null) {
      return;
    }
    $row.addClass(resultClass(result));
  });
}, true);
