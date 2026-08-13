export interface ProgressWindowOptions {
  closeOnClick: boolean;
  closeTime: number;
}

/** Active jobs stay open until the orchestrator explicitly finishes them. */
export function activeProgressOptions(): ProgressWindowOptions {
  return { closeOnClick: false, closeTime: -1 };
}

export function completionProgressType(failed: number): "success" | "fail" {
  return failed > 0 ? "fail" : "success";
}
