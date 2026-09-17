<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import RefreshCwIcon from "@lucide/svelte/icons/refresh-cw";
  import type { MonitorRecord } from "$lib/server/types/db.js";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { mode } from "mode-watcher";

  // Monitors state
  let monitors = $state<MonitorRecord[]>([]);
  let loading = $state(true);
  let domain = $state("");
  let protocol = $state("");

  // Embed configuration
  let embedConfig = $state({
    tag: "",
    embedType: "status" as "status" | "latency" | "events",
    theme: mode.current === "dark" ? "dark" : "light",
    format: "iframe" as "iframe" | "script",
    days: 90,
    height: 200,
    metric: "average" as "average" | "maximum" | "minimum",
    // Events-specific config
    showIncidents: true,
    showMaintenance: true,
    selectedTags: [] as string[]
  });

  // Preview key for refreshing
  let previewKey = $state(0);

  // Days presets
  const daysPresets = [
    { label: "7 天", value: 7 },
    { label: "30 天", value: 30 },
    { label: "60 天", value: 60 },
    { label: "90 天", value: 90 }
  ];

  // Height presets
  const heightPresets = [
    { label: "100px", value: 100 },
    { label: "150px", value: 150 },
    { label: "200px", value: 200 },
    { label: "250px", value: 250 },
    { label: "300px", value: 300 }
  ];

  // Build the embed URL
  const embedUrl = $derived.by(() => {
    if (!protocol || !domain) return "";

    if (embedConfig.embedType === "events") {
      const embedPath = `/embed/events/live`;
      return `${protocol}//${domain}` + clientResolver(resolve, embedPath);
    }

    if (!embedConfig.tag) return "";

    const embedPath =
      embedConfig.embedType === "status" ? `/embed/monitor-${embedConfig.tag}` : `/embed/latency-${embedConfig.tag}`;

    return `${protocol}//${domain}` + clientResolver(resolve, embedPath);
  });

  // Build the preview URL with parameters
  const previewUrl = $derived.by(() => {
    if (!embedUrl) return "";

    const params = new URLSearchParams();
    params.set("theme", embedConfig.theme);

    if (embedConfig.embedType === "events") {
      params.set("incidents", embedConfig.showIncidents ? "1" : "0");
      params.set("maintenance", embedConfig.showMaintenance ? "1" : "0");
      if (embedConfig.selectedTags.length > 0) {
        params.set("tags", embedConfig.selectedTags.join(","));
      }
    } else {
      params.set("days", embedConfig.days.toString());

      if (embedConfig.embedType === "latency") {
        params.set("height", embedConfig.height.toString());
        if (embedConfig.metric !== "average") {
          params.set("metric", embedConfig.metric);
        }
      }
    }

    return `${embedUrl}?${params.toString()}`;
  });

  // Build the embed code
  const embedCode = $derived.by(() => {
    if (!embedUrl) return "";

    const params = new URLSearchParams();
    params.set("theme", embedConfig.theme);

    if (embedConfig.embedType === "events") {
      params.set("incidents", embedConfig.showIncidents ? "1" : "0");
      params.set("maintenance", embedConfig.showMaintenance ? "1" : "0");
      if (embedConfig.selectedTags.length > 0) {
        params.set("tags", embedConfig.selectedTags.join(","));
      }
      const fullUrl = `${embedUrl}?${params.toString()}`;
      const iframeHeight = 300;

      if (embedConfig.format === "iframe") {
        return `<iframe src="${fullUrl}" width="100%" height="${iframeHeight}" frameborder="0" allowfullscreen="allowfullscreen"></iframe>`;
      }
      return `<script src="${embedUrl}/js?${params.toString()}"><` + "/script>";
    }

    params.set("days", embedConfig.days.toString());

    if (embedConfig.embedType === "latency") {
      params.set("height", embedConfig.height.toString());
      if (embedConfig.metric !== "average") {
        params.set("metric", embedConfig.metric);
      }
    }

    const fullUrl = `${embedUrl}?${params.toString()}`;
    const iframeHeight = embedConfig.embedType === "status" ? 70 : embedConfig.height + 50;

    if (embedConfig.format === "iframe") {
      return `<iframe src="${fullUrl}" width="100%" height="${iframeHeight}" frameborder="0" allowfullscreen="allowfullscreen"></iframe>`;
    }
    return (
      `<script src="${embedUrl}/js?theme=${embedConfig.theme}&days=${embedConfig.days}${embedConfig.embedType === "latency" ? `&height=${embedConfig.height}${embedConfig.metric !== "average" ? `&metric=${embedConfig.metric}` : ""}` : ""}"><` +
      "/script>"
    );
  });

  // HTML snippet
  const htmlSnippet = $derived.by(() => {
    return embedCode;
  });

  async function fetchMonitors() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMonitors", data: { status: "ACTIVE" } })
      });
      const result = await response.json();
      if (!result.error) {
        monitors = result;
        // Set default tag to first monitor
        if (monitors.length > 0) {
          embedConfig.tag = monitors[0].tag;
        }
      }
    } catch {
      // Ignore errors
    }
  }

  function refreshPreview() {
    previewKey++;
  }

  onMount(async () => {
    protocol = window.location.protocol;
    domain = window.location.host;
    loading = true;
    await fetchMonitors();
    loading = false;
  });
</script>

<div class="flex w-full flex-col gap-4 p-4">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="size-8" />
    </div>
  {:else}
    <div class="flex flex-col gap-6">
      <Card.Root>
        <Card.Header>
          <Card.Title>嵌入代码生成器</Card.Title>
          <Card.Description>创建可自定义的嵌入组件，在外部网站显示监控状态、延迟或实时事件</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="grid grid-cols-2 gap-4">
            <!-- Configuration Panel -->
            <div class="flex flex-col gap-4 border-r pr-4">
              <!-- Embed Type -->
              <div class="flex flex-col gap-2">
                <Label for="embed-type">嵌入类型</Label>
                <Select.Root
                  type="single"
                  value={embedConfig.embedType}
                  onValueChange={(v) => {
                    if (v) embedConfig.embedType = v as "status" | "latency" | "events";
                  }}
                >
                  <Select.Trigger id="embed-type" class="w-full capitalize">
                    {embedConfig.embedType === "status"
                      ? "状态栏"
                      : embedConfig.embedType === "latency"
                        ? "延迟图表"
                        : "实时事件"}
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="status">状态栏</Select.Item>
                    <Select.Item value="latency">延迟图表</Select.Item>
                    <Select.Item value="events">实时事件</Select.Item>
                  </Select.Content>
                </Select.Root>
                <p class="text-muted-foreground text-xs">
                  {#if embedConfig.embedType === "status"}
                    显示包含可用率百分比和每日状态的状态栏
                  {:else if embedConfig.embedType === "latency"}
                    显示一段时间内的延迟趋势图
                  {:else}
                    实时显示正在进行的故障和维护事件
                  {/if}
                </p>
              </div>

              <!-- Monitor Selection (status & latency only) -->
              {#if embedConfig.embedType !== "events"}
                <div class="flex flex-col gap-2">
                  <Label for="monitor-select">监控项</Label>
                  <Select.Root
                    type="single"
                    value={embedConfig.tag}
                    onValueChange={(v) => {
                      if (v) embedConfig.tag = v;
                    }}
                  >
                    <Select.Trigger id="monitor-select" class="w-full">
                      {monitors.find((m) => m.tag === embedConfig.tag)?.name || "选择监控项"}
                    </Select.Trigger>
                    <Select.Content>
                      {#each monitors as monitor (monitor.tag)}
                        <Select.Item value={monitor.tag}>{monitor.name}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              {/if}

              <!-- Theme -->
              <div class="flex flex-col gap-2">
                <Label>主题</Label>
                <div class="flex gap-2">
                  <Button
                    variant={embedConfig.theme === "light" ? "default" : "outline"}
                    size="sm"
                    onclick={() => (embedConfig.theme = "light")}
                  >
                    浅色
                  </Button>
                  <Button
                    variant={embedConfig.theme === "dark" ? "default" : "outline"}
                    size="sm"
                    onclick={() => (embedConfig.theme = "dark")}
                  >
                    深色
                  </Button>
                </div>
              </div>

              <!-- Events-specific options -->
              {#if embedConfig.embedType === "events"}
                <div class="flex flex-col gap-2">
                  <Label>显示内容</Label>
                  <div class="flex flex-col gap-2">
                    <label class="flex items-center gap-2">
                      <Checkbox
                        checked={embedConfig.showIncidents}
                        onCheckedChange={(v) => {
                          embedConfig.showIncidents = !!v;
                        }}
                      />
                      <span class="text-sm">故障事件</span>
                    </label>
                    <label class="flex items-center gap-2">
                      <Checkbox
                        checked={embedConfig.showMaintenance}
                        onCheckedChange={(v) => {
                          embedConfig.showMaintenance = !!v;
                        }}
                      />
                      <span class="text-sm">维护事件</span>
                    </label>
                  </div>
                </div>

                <!-- Monitor Tags Filter (optional) -->
                <div class="flex flex-col gap-2">
                  <Label>按监控项筛选</Label>
                  <p class="text-muted-foreground text-xs">选择用于筛选事件的监控项，留空则显示所有全局事件。</p>
                  <div class="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-md border p-2">
                    {#each monitors as monitor (monitor.tag)}
                      <label class="flex items-center gap-2">
                        <Checkbox
                          checked={embedConfig.selectedTags.includes(monitor.tag)}
                          onCheckedChange={(v) => {
                            if (v) {
                              embedConfig.selectedTags = [...embedConfig.selectedTags, monitor.tag];
                            } else {
                              embedConfig.selectedTags = embedConfig.selectedTags.filter((t) => t !== monitor.tag);
                            }
                          }}
                        />
                        <span class="text-sm">{monitor.name}</span>
                      </label>
                    {/each}
                  </div>
                  {#if embedConfig.selectedTags.length > 0}
                    <button
                      class="text-muted-foreground self-start text-xs underline hover:no-underline"
                      onclick={() => (embedConfig.selectedTags = [])}
                    >
                      清除选择
                    </button>
                  {/if}
                </div>
              {/if}

              <!-- Days (status & latency only) -->
              {#if embedConfig.embedType !== "events"}
                <div class="flex flex-col gap-2">
                  <Label for="days-select">时间范围</Label>
                  <Select.Root
                    type="single"
                    value={embedConfig.days.toString()}
                    onValueChange={(v) => {
                      if (v) embedConfig.days = parseInt(v);
                    }}
                  >
                    <Select.Trigger id="days-select" class="w-full">
                      {daysPresets.find((d) => d.value === embedConfig.days)?.label || `${embedConfig.days} 天`}
                    </Select.Trigger>
                    <Select.Content>
                      {#each daysPresets as preset (preset.value)}
                        <Select.Item value={preset.value.toString()}>{preset.label}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
              {/if}

              <!-- Height (only for latency) -->
              {#if embedConfig.embedType === "latency"}
                <div class="flex flex-col gap-2">
                  <Label for="height-select">图表高度</Label>
                  <Select.Root
                    type="single"
                    value={embedConfig.height.toString()}
                    onValueChange={(v) => {
                      if (v) embedConfig.height = parseInt(v);
                    }}
                  >
                    <Select.Trigger id="height-select" class="w-full">
                      {heightPresets.find((h) => h.value === embedConfig.height)?.label || `${embedConfig.height}px`}
                    </Select.Trigger>
                    <Select.Content>
                      {#each heightPresets as preset (preset.value)}
                        <Select.Item value={preset.value.toString()}>{preset.label}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>

                <!-- Latency Metric -->
                <div class="flex flex-col gap-2">
                  <Label for="metric-select">延迟指标</Label>
                  <Select.Root
                    type="single"
                    value={embedConfig.metric}
                    onValueChange={(v) => {
                      if (v) embedConfig.metric = v as "average" | "maximum" | "minimum";
                    }}
                  >
                    <Select.Trigger id="metric-select" class="w-full capitalize">
                      {embedConfig.metric === "average"
                        ? "平均值"
                        : embedConfig.metric === "maximum"
                          ? "最大值"
                          : "最小值"}
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="average">平均值</Select.Item>
                      <Select.Item value="maximum">最大值</Select.Item>
                      <Select.Item value="minimum">最小值</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <p class="text-muted-foreground text-xs">选择图表中显示的延迟指标</p>
                </div>
              {/if}

              <!-- Format -->
              <div class="flex flex-col gap-2">
                <Label>嵌入格式</Label>
                <div class="flex gap-2">
                  <Button
                    variant={embedConfig.format === "iframe" ? "default" : "outline"}
                    size="sm"
                    onclick={() => (embedConfig.format = "iframe")}
                  >
                    iFrame
                  </Button>
                  <Button
                    variant={embedConfig.format === "script" ? "default" : "outline"}
                    size="sm"
                    onclick={() => (embedConfig.format = "script")}
                  >
                    脚本
                  </Button>
                </div>
                <p class="text-muted-foreground text-xs">
                  {#if embedConfig.format === "iframe"}
                    使用 iframe 嵌入组件，适用于大多数网站。
                  {:else}
                    使用 script 标签动态嵌入，可能需要配置 CSP。
                  {/if}
                </p>
              </div>
            </div>

            <!-- Preview Panel -->
            <div class="flex flex-col gap-4">
              {#if embedConfig.tag || embedConfig.embedType === "events"}
                <div>
                  <p class="flex items-center justify-between">
                    <span class="text-sm font-semibold">预览</span>
                    <Button variant="ghost" size="icon-sm" onclick={refreshPreview}>
                      <RefreshCwIcon class="h-4 w-4" />
                    </Button>
                  </p>
                  <p class="text-muted-foreground text-sm">查看嵌入组件的显示效果</p>
                </div>

                <!-- Embed Preview -->
                <div
                  class="bg-muted/50 flex items-center justify-center rounded-lg border p-4"
                  class:bg-zinc-900={embedConfig.theme === "dark"}
                >
                  {#key previewKey}
                    {#key embedConfig}
                      <iframe
                        title="嵌入预览"
                        src={previewUrl}
                        width="100%"
                        height={embedConfig.embedType === "status"
                          ? 70
                          : embedConfig.embedType === "events"
                            ? 300
                            : embedConfig.height + 50}
                        frameborder="0"
                        class="rounded"
                      ></iframe>
                    {/key}
                  {/key}
                </div>

                <!-- Embed URL -->
                <div class="space-y-2">
                  <Label>嵌入 URL</Label>
                  <div class="flex gap-2">
                    <Input readonly value={previewUrl} class="font-mono text-xs" />
                    <CopyButton variant="outline" size="icon" text={previewUrl} copiedLabel="已复制">
                      <CopyIcon class="h-4 w-4" />
                    </CopyButton>
                  </div>
                </div>

                <!-- Embed Code -->
                <div class="space-y-2">
                  <Label>嵌入代码</Label>
                  <div class="flex gap-2">
                    <Input readonly value={htmlSnippet} class="font-mono text-xs" />
                    <CopyButton variant="outline" size="icon" text={htmlSnippet} copiedLabel="已复制">
                      <CopyIcon class="h-4 w-4" />
                    </CopyButton>
                  </div>
                </div>
              {:else}
                <div class="text-muted-foreground flex items-center justify-center py-12 text-center">
                  选择监控项以预览嵌入组件
                </div>
              {/if}
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </div>
  {/if}
</div>
