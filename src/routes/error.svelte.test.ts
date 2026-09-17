import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import ErrorPage from "./+error.svelte";

const { page } = vi.hoisted(() => ({
  page: { route: { id: "" }, status: 500, error: null },
}));

vi.mock("$app/state", () => ({ page }));

it.each([
  {
    route: "/(manage)/manage/app/users",
    title: "500 — 管理后台暂时不可用",
    heading: "管理后台暂时不可用",
    retry: "页面将在 30 秒后自动重试。",
    lang: "zh-CN",
  },
  {
    route: "/(kener)",
    title: "500 — Status page temporarily unavailable",
    heading: "This status page is temporarily unavailable",
    retry: "This page will retry automatically in 30 seconds.",
    lang: null,
  },
])("keeps the error language scoped to $route", async ({ route, title, heading, retry, lang }) => {
  page.route.id = route;
  const screen = await render(ErrorPage);
  await expect.element(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  await expect.element(screen.getByText(retry)).toBeInTheDocument();
  expect(document.title).toBe(title);
  expect(document.querySelector(".error-wrap")?.getAttribute("lang")).toBe(lang);
  expect(document.querySelector('meta[http-equiv="refresh"]')?.getAttribute("content")).toBe("30");
});
