<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import { toast } from "svelte-sonner";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { DOCKER_DEFAULT_SOCKET_PATH, DOCKER_DEFAULT_TIMEOUT } from "$lib/anywhere.js";
  import type { DockerMonitorTypeData } from "$lib/types/docker.js";

  let { data = $bindable({} as Record<string, unknown>) }: { data: Record<string, unknown> } = $props();

  const formData = data as unknown as DockerMonitorTypeData;

  const CONNECTION_TYPES = {
    socket: { label: "Unix 套接字", addressLabel: "套接字路径", placeholder: DOCKER_DEFAULT_SOCKET_PATH },
    tcp: { label: "TCP（未加密）", addressLabel: "守护进程地址", placeholder: "10.0.0.5:2375" },
    tls: { label: "TCP（TLS 加密）", addressLabel: "守护进程地址", placeholder: "docker.example.com:2376" }
  } as const;

  const CHECK_TYPE_LABELS: Record<string, string> = {
    container: "容器",
    daemon: "Docker 守护进程（仅探测连通性）"
  };

  // Initialize defaults if not set
  if (!(formData.connectionType in CONNECTION_TYPES)) formData.connectionType = "socket";
  if (typeof formData.daemon !== "string") {
    formData.daemon = formData.connectionType === "socket" ? DOCKER_DEFAULT_SOCKET_PATH : "";
  }
  if (formData.checkType !== "daemon") formData.checkType = "container";
  if (typeof formData.containerName !== "string") formData.containerName = "";
  if (!formData.timeout) formData.timeout = DOCKER_DEFAULT_TIMEOUT;

  interface DockerContainerOption {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
  }

  let containers = $state<DockerContainerOption[]>([]);
  let loadingContainers = $state(false);

  function selectConnectionType(value: string | undefined) {
    if (!value || !(value in CONNECTION_TYPES)) return;
    formData.connectionType = value as DockerMonitorTypeData["connectionType"];
    formData.daemon = value === "socket" ? DOCKER_DEFAULT_SOCKET_PATH : "";
    if (value !== "tls") {
      // Otherwise a now-hidden private key would ride along on the next save.
      formData.tlsCa = undefined;
      formData.tlsCert = undefined;
      formData.tlsKey = undefined;
    }
    containers = [];
  }

  // Sends the unsaved connection fields, so browsing works before the monitor is saved.
  async function loadContainers() {
    loadingContainers = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listDockerContainers", data: formData })
      });
      const result = await response.json();
      if (result?.error) throw new Error(result.error);
      containers = result;
      if (containers.length === 0) toast.info("此守护进程中未找到容器");
    } catch (e) {
      containers = [];
      toast.error(e instanceof Error ? e.message : "获取容器列表失败");
    } finally {
      loadingContainers = false;
    }
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-3 gap-4">
    <div class="flex flex-col gap-2">
      <Label for="docker-connection-type">连接方式</Label>
      <Select.Root type="single" value={formData.connectionType} onValueChange={selectConnectionType}>
        <Select.Trigger id="docker-connection-type" class="w-full">
          {CONNECTION_TYPES[formData.connectionType].label}
        </Select.Trigger>
        <Select.Content>
          {#each Object.entries(CONNECTION_TYPES) as [value, option] (value)}
            <Select.Item {value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <div class="col-span-2 flex flex-col gap-2">
      <Label for="docker-daemon">
        {CONNECTION_TYPES[formData.connectionType].addressLabel} <span class="text-destructive">*</span>
      </Label>
      <Input
        id="docker-daemon"
        bind:value={formData.daemon}
        placeholder={CONNECTION_TYPES[formData.connectionType].placeholder}
      />
    </div>
  </div>
  <p class="text-muted-foreground text-xs">
    能够访问 Docker 套接字就拥有该主机的 root 权限。建议使用只读套接字代理，而非直接挂载套接字， 请勿将未经 TLS 加密的 <code
      >tcp</code
    > 暴露到可信网络之外。
  </p>

  {#if formData.connectionType === "tls"}
    <div class="flex flex-col gap-2">
      <Label for="docker-tls-ca">CA 证书</Label>
      <Textarea
        id="docker-tls-ca"
        bind:value={formData.tlsCa}
        rows={3}
        class="font-mono text-xs"
        placeholder="-----BEGIN CERTIFICATE----- 或 $DOCKER_TLS_CA"
      />
    </div>
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="docker-tls-cert">客户端证书</Label>
        <Textarea
          id="docker-tls-cert"
          bind:value={formData.tlsCert}
          rows={4}
          class="font-mono text-xs"
          placeholder="-----BEGIN CERTIFICATE----- 或 $DOCKER_TLS_CERT"
        />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="docker-tls-key">客户端私钥</Label>
        <Textarea
          id="docker-tls-key"
          bind:value={formData.tlsKey}
          rows={4}
          class="font-mono text-xs"
          placeholder="-----BEGIN PRIVATE KEY----- 或 $DOCKER_TLS_KEY"
        />
      </div>
    </div>
    <p class="text-muted-foreground text-xs">
      粘贴 PEM 内容，或引用 <code>$DOCKER_TLS_KEY</code> 等环境变量，避免将私钥存入数据库。 如果守护进程位于不要求客户端证书的
      TLS 代理之后，可将这三个字段全部留空。客户端证书和私钥必须成对填写。
    </p>
  {/if}

  <div class="flex flex-col gap-2">
    <Label for="docker-check-type">检查对象</Label>
    <Select.Root
      type="single"
      value={formData.checkType}
      onValueChange={(v) => {
        if (v) formData.checkType = v as DockerMonitorTypeData["checkType"];
      }}
    >
      <Select.Trigger id="docker-check-type" class="w-full">
        {CHECK_TYPE_LABELS[formData.checkType]}
      </Select.Trigger>
      <Select.Content>
        {#each Object.entries(CHECK_TYPE_LABELS) as [value, label] (value)}
          <Select.Item {value}>{label}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <p class="text-muted-foreground text-xs">
      守护进程检查仅验证 Docker Engine API 是否响应，可将其用作主机的父监控项。
    </p>
  </div>

  {#if formData.checkType === "container"}
    <div class="flex flex-col gap-2">
      <Label for="docker-container">容器名称或 ID <span class="text-destructive">*</span></Label>
      <div class="flex gap-2">
        <Input id="docker-container" bind:value={formData.containerName} placeholder="my-app" />
        <Button variant="secondary" disabled={!formData.daemon?.trim() || loadingContainers} onclick={loadContainers}>
          {#if loadingContainers}
            <Spinner class="size-4" />
          {:else}
            <RefreshCwIcon class="size-4" />
          {/if}
          浏览
        </Button>
      </div>
      {#if containers.length > 0}
        <div class="flex flex-wrap gap-2 pt-1">
          {#each containers as container (container.id)}
            <button type="button" onclick={() => (formData.containerName = container.name)}>
              <Badge variant={container.state === "running" ? "default" : "secondary"} class="cursor-pointer">
                {container.name}
              </Badge>
            </button>
          {/each}
        </div>
      {/if}
      <p class="text-muted-foreground text-xs">
        每次检查都会重新查找容器，只要名称不变，重建容器后仍可继续监控。运行中的容器为正常（UP）， 除非 <code
          >HEALTHCHECK</code
        > 返回异常；重启或启动中为性能下降（DEGRADED）；暂停、停止、不健康或不存在为故障（DOWN）。
      </p>
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <Label for="docker-timeout">超时时间（毫秒）</Label>
    <Input
      id="docker-timeout"
      type="number"
      bind:value={formData.timeout}
      placeholder={String(DOCKER_DEFAULT_TIMEOUT)}
    />
  </div>
</div>
