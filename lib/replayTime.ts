export function getReplayNow(
  league: { isReplay: boolean; replayCurrentDate: Date | null },
  devFallback: number
): number {
  if (league.isReplay && league.replayCurrentDate) {
    return league.replayCurrentDate.getTime();
  }
  return devFallback;
}
