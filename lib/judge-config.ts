/** Running code needs a judge worker somewhere (judge/src/worker.ts). Until
 * one is deployed, Run/Submit are off so submissions don't queue forever.
 * Read at build time on static pages, so changing it means a redeploy. */
export function isJudgeEnabled(): boolean {
  return process.env.JUDGE_ENABLED === "true";
}
