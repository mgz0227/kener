import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-svelte";
import { page } from "vitest/browser";
import MonitorDocker from "./monitor-docker.svelte";

describe("monitor-docker form", () => {
  it("fills socket defaults into empty type_data", async () => {
    const data = $state<Record<string, unknown>>({});
    const screen = await render(MonitorDocker, { data });

    await expect.element(screen.getByLabelText(/套接字路径/)).toHaveValue("/var/run/docker.sock");
    await expect.element(screen.getByLabelText(/容器名称或 ID/)).toBeVisible();
    expect(data).toMatchObject({
      connectionType: "socket",
      daemon: "/var/run/docker.sock",
      checkType: "container",
      containerName: "",
      timeout: 10000,
    });
  });

  it("shows the PEM fields for a tls connection", async () => {
    const data = $state<Record<string, unknown>>({ connectionType: "tls", daemon: "docker.example.com:2376" });
    const screen = await render(MonitorDocker, { data });

    await expect.element(screen.getByLabelText("CA 证书")).toBeVisible();
    await expect.element(screen.getByLabelText("客户端证书")).toBeVisible();
    await expect.element(screen.getByLabelText("客户端私钥")).toBeVisible();
    await expect.element(screen.getByLabelText(/守护进程地址/)).toHaveValue("docker.example.com:2376");
  });

  it("hides the container field in daemon mode", async () => {
    const data = $state<Record<string, unknown>>({ connectionType: "socket", checkType: "daemon" });
    const screen = await render(MonitorDocker, { data });

    await expect.element(screen.getByLabelText(/套接字路径/)).toBeVisible();
    expect(screen.container.querySelector("#docker-container")).toBeNull();
  });

  it("clears TLS material and resets the address when leaving tls", async () => {
    const data = $state<Record<string, unknown>>({
      connectionType: "tls",
      daemon: "docker.example.com:2376",
      tlsCa: "ca",
      tlsCert: "cert",
      tlsKey: "key",
    });
    const screen = await render(MonitorDocker, { data });

    await screen.getByText("TCP（TLS 加密）").click();
    await page.getByRole("option", { name: "Unix 套接字" }).click();

    await expect.element(screen.getByLabelText(/套接字路径/)).toHaveValue("/var/run/docker.sock");
    expect(screen.container.querySelector("#docker-tls-key")).toBeNull();
    expect(data).toMatchObject({ connectionType: "socket", daemon: "/var/run/docker.sock" });
    expect(data.tlsCa).toBeUndefined();
    expect(data.tlsCert).toBeUndefined();
    expect(data.tlsKey).toBeUndefined();
  });
});
