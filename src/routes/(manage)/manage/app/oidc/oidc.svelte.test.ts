import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import OidcPage from "./+page.svelte";

vi.mock("svelte-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("OIDC settings localization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("localizes controls and built-in roles without changing protocol values, custom names, or secret handling", async () => {
    const settings = {
      enabled: true,
      provider_name: "Example SSO",
      issuer_url: "https://id.example.com",
      client_id: "kener-client",
      client_secret: "********",
      scopes: "openid profile email",
      groups_claim: "groups",
      allow_local_login: true,
      auto_create_users: false,
      default_role_id: "member",
    };
    const requests: { action: string; data: Record<string, unknown> }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const request = JSON.parse(init.body as string);
        requests.push(request);
        const results: Record<string, unknown> = {
          getOidcSettingsMasked: settings,
          getOidcGroupRoleMappings: [],
          getRoles: [
            { id: "admin", role_name: "Administrator", readonly: 1, status: "ACTIVE" },
            { id: "member", role_name: "Member", readonly: 1, status: "ACTIVE" },
            { id: "custom_admin", role_name: "Administrator", readonly: 0, status: "ACTIVE" },
          ],
          storeSiteData: { success: true },
          upsertOidcGroupRoleMapping: { success: true },
        };
        return { ok: true, json: async () => results[request.action] } as Response;
      }),
    );

    const screen = await render(OidcPage);
    await expect.element(screen.getByText("OpenID Connect 设置", { exact: true })).toBeVisible();
    await expect.element(screen.getByLabelText("身份提供方名称")).toHaveValue("Example SSO");
    await expect.element(screen.getByLabelText("授权范围")).toHaveValue("openid profile email");
    await expect.element(screen.getByLabelText("用户组声明名称")).toHaveValue("groups");
    await expect.element(screen.getByLabelText("默认角色")).toHaveTextContent("成员");
    await expect.element(screen.getByText("尚未配置用户组映射。")).toBeVisible();
    await expect.element(screen.getByRole("button", { name: "测试连接" })).toBeVisible();

    await screen.getByLabelText("默认角色").click();
    await expect.element(page.getByRole("option", { name: "管理员", exact: true })).toBeVisible();
    await page.getByRole("option", { name: "Administrator", exact: true }).click();
    await screen.getByRole("button", { name: "保存设置", exact: true }).click();

    const saves = () => requests.filter((request) => request.action === "storeSiteData");
    await vi.waitFor(() => expect(saves()).toHaveLength(1));
    const { client_secret: _maskedSecret, ...unchangedSettings } = settings;
    expect(JSON.parse(saves()[0].data.oidcSettings as string)).toEqual({
      ...unchangedSettings,
      default_role_id: "custom_admin",
    });

    await screen.getByRole("button", { name: "显示客户端密钥" }).click();
    await expect.element(screen.getByRole("button", { name: "隐藏客户端密钥" })).toBeVisible();
    await screen.getByLabelText("客户端密钥", { exact: true }).fill("replacement-test-secret");
    await screen.getByRole("button", { name: "保存设置", exact: true }).click();
    await vi.waitFor(() => expect(saves()).toHaveLength(2));
    expect(JSON.parse(saves()[1].data.oidcSettings as string)).toEqual({
      ...settings,
      default_role_id: "custom_admin",
      client_secret: "replacement-test-secret",
    });

    await screen.getByLabelText("OIDC 用户组", { exact: true }).fill(" Platform-Team ");
    await screen.getByLabelText("Kener 角色", { exact: true }).click();
    await page.getByRole("option", { name: "成员", exact: true }).click();
    await screen.getByRole("button", { name: "添加映射", exact: true }).click();
    await vi.waitFor(() =>
      expect(requests).toContainEqual({
        action: "upsertOidcGroupRoleMapping",
        data: { oidc_group: "Platform-Team", role_id: "member" },
      }),
    );
  });
});
