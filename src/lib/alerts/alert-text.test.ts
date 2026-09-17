import { expect, it } from "vitest";
import { getAlertText } from "./alert-text";

it("uses Chinese status labels without changing thresholds or unknown values", () => {
  const input = { kind: "description", alert_for: "STATUS", failure_threshold: 3, success_threshold: 2 } as const;
  expect(getAlertText({ ...input, alert_value: "DOWN" })).toBe(
    "连续 3 次检查结果为 故障 时触发告警。连续 2 次检查成功后恢复。"
  );
  expect(getAlertText({ ...input, alert_value: "custom-status" })).toContain("custom-status");
  expect(getAlertText({ ...input, alert_for: "LATENCY", alert_value: 250 })).toContain("250 毫秒");
});
