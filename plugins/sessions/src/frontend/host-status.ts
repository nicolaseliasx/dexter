export type HostStatus = "online" | "reachable" | "offline" | "unknown";

export interface HostStatusView {
  label: string;
  /** Text and dot colour. Fixed colours: the theme accent can be red. */
  className: string;
  dotClassName: string;
}

/** How a host's status reads in the list, or null when it was not checked yet. */
export function hostStatusView(status: HostStatus): HostStatusView | null {
  if (status === "unknown") return null;
  const online = status === "online" || status === "reachable";
  return {
    label: status,
    className: online ? "text-emerald-500" : "text-red-500",
    dotClassName: online ? "bg-emerald-500" : "bg-red-500",
  };
}
