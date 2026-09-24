import { authApi } from "@/lib/api";
import { setSessionToken } from "@/lib/session";
import { useStore } from "@/lib/store";
import { toastError, toastSuccess } from "@/lib/feedback";

/**
 * "Log in as" — enter another user's account from an admin or agent panel.
 * Keeps the operator's own session token in sessionStorage so the floating
 * ImpersonationPill can restore it afterwards (POST /api/auth/restore).
 */
export async function impersonateUser(
  userId: string,
  targetName: string,
  options?: { onDone?: () => void }
): Promise<boolean> {
  try {
    window.sessionStorage.setItem("ishim_admin_token", "");
    const res = await authApi.impersonate(userId);
    const restoreToken = (res as { restoreToken?: string }).restoreToken ?? "";
    window.sessionStorage.setItem("ishim_admin_token", restoreToken);
    // Act as the target user on the header channel too (cookie-blocked contexts).
    setSessionToken(res.token);
    useStore.getState().setImpersonation({ token: restoreToken, adminName: targetName });
    if (res.user) useStore.getState().setUser(res.user);
    useStore.getState().setView("home");
    toastSuccess(`Now viewing as ${targetName}`, "Use the pill at the bottom to exit.");
    options?.onDone?.();
    return true;
  } catch (e) {
    toastError(e, "Could not enter that account");
    return false;
  }
}
