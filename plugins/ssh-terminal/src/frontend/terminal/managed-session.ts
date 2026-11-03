/** Resolve a managed identity on every connection; never fall back to a cached name. */
export async function resolveManagedSession(
  id: string,
  hostId: number,
  invoke: (action: string, ...args: unknown[]) => Promise<unknown>,
): Promise<{ name: string; target: string }> {
  const value = (await invoke("sessions.resolveAttachment", id, hostId)) as
    { name?: unknown; target?: unknown } | undefined;
  if (
    typeof value?.name !== "string" ||
    !value.name.trim() ||
    typeof value.target !== "string" ||
    !/^\$\d+$/.test(value.target)
  )
    throw new Error(
      "Persistent session is unavailable. Reopen it from Sessions.",
    );
  return { name: value.name, target: value.target };
}

/** Check the marker again inside tmux and attach by its immutable target. exec prevents an ordinary-shell fallback. */
export function managedTmuxAttachCommand(
  target: string,
  sessionId: string,
): string {
  if (!/^\$\d+$/.test(target) || !/^[A-Za-z0-9_-]{1,64}$/.test(sessionId))
    throw new Error("Invalid managed session identity");
  return `exec tmux if-shell -F -t '${target}' '#{==:#{@termix_session_id},${sessionId}}' 'attach-session -t ${target}' 'display-message -p "Persistent session is no longer available"'`;
}
