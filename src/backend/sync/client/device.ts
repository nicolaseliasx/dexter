import os from "os";

export function defaultDeviceName(): string {
  return os.hostname() || "D.EX.T.E.R. Desktop";
}
