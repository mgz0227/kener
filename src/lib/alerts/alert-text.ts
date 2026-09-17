import GC from "$lib/global-constants";
import { monitorStatusLabels } from "$lib/client/admin-labels";

type AlertTextKind = "label" | "help" | "description";

interface AlertTextInput {
  kind: AlertTextKind;
  alert_for: string;
  alert_value?: string | number;
  failure_threshold?: number;
  success_threshold?: number;
}

export function getAlertText({
  kind,
  alert_for,
  alert_value,
  failure_threshold,
  success_threshold,
}: AlertTextInput): string {
  if (kind === "label") {
    switch (alert_for) {
      case GC.STATUS:
        return "状态值";
      case GC.LATENCY:
        return "延迟阈值（毫秒）";
      case GC.UPTIME:
        return "可用率阈值（%）";
      default:
        return "数值";
    }
  }

  if (kind === "help") {
    switch (alert_for) {
      case GC.STATUS:
        return "监控状态等于此值时触发告警";
      case GC.LATENCY:
        return "延迟超过此值（毫秒）时触发告警";
      case GC.UPTIME:
        return "可用率低于此百分比时触发告警";
      default:
        return "";
    }
  }

  const thresholdValue = failure_threshold ?? 0;
  const resolveThreshold = success_threshold ?? 0;
  const value = alert_value ?? "";

  if (alert_for === GC.STATUS) {
    return `连续 ${thresholdValue} 次检查结果为 ${monitorStatusLabels[value] ?? value} 时触发告警。连续 ${resolveThreshold} 次检查成功后恢复。`;
  }

  if (alert_for === GC.LATENCY) {
    return `连续 ${thresholdValue} 次检查的延迟超过 ${value} 毫秒时触发告警。连续 ${resolveThreshold} 次检查低于阈值后恢复。`;
  }

  if (alert_for === GC.UPTIME) {
    return `连续 ${thresholdValue} 次检查的可用率低于 ${value}% 时触发告警。连续 ${resolveThreshold} 次检查高于阈值后恢复。`;
  }

  return "";
}
