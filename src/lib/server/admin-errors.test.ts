import { describe, expect, it } from "vitest";
import { localizeAdminError } from "./admin-errors.js";

describe("admin error localization", () => {
  it("translates known validation messages and preserves parameter values", () => {
    const cases = [
      ["Name is required", "名称不能为空"],
      ["Owner must retain the admin role", "所有者必须保留管理员角色"],
      ["Proxy URL must be a valid http:// or https:// URL", "代理 URL 必须是有效的 http:// 或 https:// 地址"],
      ["Title and startDateTime are required", "标题和开始时间不能为空"],
      ["Method not found", "未找到订阅方式"],
      ['Role "Release Admin $&" not found', "未找到角色“Release Admin $&”"],
      ["Incident with id '123' not found", "未找到故障事件，ID：'123'"],
      ['Page with path "ops/status" already exists', "页面路径“ops/status”已存在"],
      [
        "Invalid severity value: custom. Must be one of: CRITICAL, WARNING",
        "严重程度（severity）无效：custom。允许的值：CRITICAL, WARNING",
      ],
      [
        "Invalid failure_threshold: 0. Must be a positive integer >= 1",
        "阈值 failure_threshold 无效：0。必须是大于或等于 1 的正整数",
      ],
      ["Cannot transition event from COMPLETED to CANCELLED", "不能将事件状态从 COMPLETED 更改为 CANCELLED"],
      ["Docker API request timed out after 10000ms", "Docker API 请求超时，已等待 10000 毫秒"],
    ];
    for (const [original, translated] of cases) expect(localizeAdminError(original)).toBe(translated);
  });

  it("retains technical diagnostics including multiline OIDC discovery errors", () => {
    const diagnostic = "fetch failed: ECONNREFUSED 127.0.0.1:443\n    at discover (oidc.ts:12)";
    expect(localizeAdminError(`OIDC Discovery failed: ${diagnostic}`)).toBe(`OIDC 自动发现失败：${diagnostic}`);
    expect(localizeAdminError(`Error sending webhook: ${diagnostic}`)).toBe(`发送 Webhook 失败：${diagnostic}`);
  });

  it("leaves unknown, already translated, inherited-property and partial messages untouched", () => {
    for (const message of [
      "",
      "constructor",
      "__proto__",
      "用户未登录",
      "SQLITE_CONSTRAINT: users.email",
      "Unexpected: Name is required",
      'Unexpected: Role "admin" not found',
      'Role "admin" not found (upstream detail)',
      "Invalid custom_threshold: 0. Must be a positive integer >= 1",
    ]) {
      expect(localizeAdminError(message)).toBe(message);
    }
  });
});
