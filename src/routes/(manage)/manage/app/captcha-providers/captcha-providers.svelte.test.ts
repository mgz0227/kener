import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import CaptchaProvidersPage from "./+page.svelte";

vi.mock("svelte-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe("CAPTCHA settings localization", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows Chinese guidance and labels while preserving provider and credential keys", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const screen = await render(CaptchaProvidersPage);

    await expect
      .element(screen.getByText("在此填写验证码服务的站点密钥和私密密钥，同一时间只能启用一个服务。"))
      .toBeVisible();
    await screen.getByLabelText("站点密钥").fill("public-test-key");
    await screen.getByLabelText("私密密钥").fill("private-test-key");
    await screen.getByRole("button", { name: "保存 hCaptcha 设置" }).click();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const request = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(request.action).toBe("storeSiteData");
    expect(JSON.parse(request.data["captcha.hcaptcha"])).toEqual({
      requirements: { "Site Key": "public-test-key", "Secret Key": "private-test-key" },
      isEnabled: false,
    });
  });
});
