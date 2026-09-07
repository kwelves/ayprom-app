import type { DesktopAPI } from "../shared/contracts";
declare global {
  interface Window {
    ayprom: DesktopAPI;
  }
}
