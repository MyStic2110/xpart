import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { api, Branch } from "./api";

interface BranchCtx {
  branchId: string; // "all" or a branch id
  setBranchId: (id: string) => void;
  branches: Branch[];
  branchName: string;
  /** undefined when "all" selected, else the id — convenient for API params */
  branchParam: string | undefined;
  loadBranches: () => void;
}

const Ctx = createContext<BranchCtx>({
  branchId: "all",
  setBranchId: () => {},
  branches: [],
  branchName: "All branches",
  branchParam: undefined,
  loadBranches: () => {},
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchIdState] = useState<string>(() => localStorage.getItem("branchId") || "all");

  const loadBranches = useCallback(() => {
    if (!localStorage.getItem("token")) {
      setBranches([]);
      return;
    }
    api.listBranches().then(setBranches).catch(() => {});
  }, []);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  function setBranchId(id: string) {
    setBranchIdState(id);
    localStorage.setItem("branchId", id);
  }

  const branchName = branchId === "all" ? "All branches" : branches.find((b) => b.id === branchId)?.name ?? "Branch";

  return (
    <Ctx.Provider value={{ branchId, setBranchId, branches, branchName, branchParam: branchId === "all" ? undefined : branchId, loadBranches }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBranch() {
  return useContext(Ctx);
}
