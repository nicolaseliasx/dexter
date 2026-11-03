/** Stage durations only; no command, clipboard data, filename or credentials. */
export function imageUploadTimings(
  now: () => number = () => performance.now(),
) {
  let previous = now();
  const durations: Record<string, number> = {};
  return {
    durations,
    mark(stage: "settings" | "queue" | "decode" | "storage") {
      const current = now();
      durations[stage] = Math.max(0, current - previous);
      previous = current;
    },
    header: () =>
      Object.entries(durations)
        .map(([stage, duration]) => `${stage};dur=${duration.toFixed(1)}`)
        .join(", "),
  };
}
