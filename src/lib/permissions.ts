import { useQuery } from "@tanstack/react-query";
import { useApp } from "@/context/AppContext";
import { api, type Permission } from "@/lib/api";

/**
 * What the signed-in admin may do in the back office. The backend enforces every permission;
 * this only hides what would be refused. Everything reads as allowed for the system admin and
 * as refused while loading or for non-admins.
 */
export const usePermissions = () => {
  const { currentUser } = useApp();
  const isAdmin = currentUser?.role === "admin";
  const { data, isLoading } = useQuery({
    queryKey: ["admin-permissions-me", currentUser?.id],
    queryFn: api.admin.permissions.mine,
    enabled: isAdmin,
    staleTime: 30_000,
  });
  const isSystemUser = data?.isSystemUser ?? currentUser?.isSystemUser === true;
  return {
    isLoading: isAdmin && isLoading,
    isSystemUser,
    can: (permission: Permission) => isSystemUser || data?.permissions[permission] === true,
  };
};

// Which side of the app an admin is using this tab, so shared pages (Profile) pick the right frame.
const AREA_KEY = "op_area";
export type Area = "backoffice" | "app";

export const getArea = (): Area => {
  try {
    return sessionStorage.getItem(AREA_KEY) === "app" ? "app" : "backoffice";
  } catch {
    return "backoffice";
  }
};

export const setArea = (area: Area) => {
  try {
    sessionStorage.setItem(AREA_KEY, area);
  } catch {
    // Storage unavailable (private mode): Profile just defaults to the back office frame.
  }
};
