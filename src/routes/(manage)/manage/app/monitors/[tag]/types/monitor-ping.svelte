<script lang="ts">
  import { hostTypeLabels } from "$lib/client/admin-labels.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { ValidateIpAddress } from "$lib/clientTools";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { DefaultPingEval } from "$lib/anywhere.js";
  import CodeMirror from "svelte-codemirror-editor";
  import { adminEditorExtensions } from "$lib/client/admin-editor.js";
  import { javascript } from "@codemirror/lang-javascript";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import { mode } from "mode-watcher";
  import type { PingHost, PingHostType, PingMonitorTypeData } from "$lib/types/ping.js";
  import { PING_HOST_TYPES } from "$lib/types/ping.js";

  let { data = $bindable({ hosts: [], pingEval: DefaultPingEval }) }: { data: PingMonitorTypeData } = $props();

  function normalizeHostType(value: unknown): PingHostType {
    return typeof value === "string" && PING_HOST_TYPES.includes(value as PingHostType)
      ? (value as PingHostType)
      : "IP4";
  }

  function inferHostType(host: string): PingHostType | null {
    const inferred = ValidateIpAddress((host || "").trim());
    return inferred === "Invalid" ? null : inferred;
  }

  // Initialize defaults if not set
  if (!Array.isArray(data.hosts) || data.hosts.length === 0)
    data.hosts = [
      {
        type: "IP4",
        host: "",
        timeout: 1000,
        count: 3
      }
    ];
  else {
    data.hosts = data.hosts.map((host) => ({
      ...host,
      type: normalizeHostType(host?.type)
    }));
  }

  if (!data.pingEval) data.pingEval = DefaultPingEval;

  function addHost() {
    data.hosts = [...data.hosts, { type: "IP4", host: "", timeout: 1000, count: 3 }];
  }

  function removeHost(index: number) {
    data.hosts = data.hosts.filter((_: unknown, i: number) => i !== index);
  }

  function onHostChange(host: PingHost) {
    const inferredType = inferHostType(host.host);
    if (inferredType) {
      host.type = inferredType;
    }
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-2">
    <div class="mb-2 flex items-center justify-between">
      <Label>主机 <span class="text-destructive">*</span></Label>
      <Button variant="outline" size="sm" onclick={addHost}>
        <Plus class="mr-1 size-4" />
        添加主机
      </Button>
    </div>
    {#if data.hosts.length > 0}
      <div class="space-y-3">
        {#each data.hosts as host, index (index)}
          <div class="bg-muted/50 rounded-lg border p-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-medium">主机 {index + 1}</span>
              <Button variant="ghost" size="icon" aria-label="移除主机 {index + 1}" onclick={() => removeHost(index)}>
                <X class="size-4" />
              </Button>
            </div>
            <div class="grid grid-cols-5 gap-2">
              <div class="flex flex-col gap-2">
                <Label for="ping-type-{index}">类型</Label>
                <Select.Root
                  type="single"
                  value={normalizeHostType(host.type)}
                  onValueChange={(v) => (host.type = normalizeHostType(v))}
                >
                  <Select.Trigger id="ping-type-{index}" class="w-full">
                    {hostTypeLabels[normalizeHostType(host.type)] ?? normalizeHostType(host.type)}
                  </Select.Trigger>
                  <Select.Content>
                    {#each PING_HOST_TYPES as typeOption (typeOption)}
                      <Select.Item value={typeOption}>{hostTypeLabels[typeOption] ?? typeOption}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div class="col-span-2 flex flex-col gap-2">
                <Label for="ping-host-{index}">主机</Label>
                <Input
                  id="ping-host-{index}"
                  bind:value={host.host}
                  oninput={() => onHostChange(host)}
                  placeholder="8.8.8.8、2001:db8::1 或 example.com"
                />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="ping-timeout-{index}">超时时间（毫秒）</Label>
                <Input id="ping-timeout-{index}" type="number" bind:value={host.timeout} placeholder="1000" />
              </div>
              <div class="flex flex-col gap-2">
                <Label for="ping-count-{index}">次数</Label>
                <Input id="ping-count-{index}" type="number" bind:value={host.count} placeholder="3" />
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-muted-foreground text-sm">尚未添加主机。点击“添加主机”以添加 Ping 目标。</p>
    {/if}
  </div>

  <div class="flex flex-col gap-2">
    <Label for="ping-eval">自定义评估函数</Label>
    <div class="rounded-md border">
      <CodeMirror
        extensions={adminEditorExtensions}
        bind:value={data.pingEval}
        lang={javascript()}
        theme={mode.current === "dark" ? githubDark : githubLight}
        styles={{
          "&": {
            fontSize: "14px",
            height: "300px"
          }
        }}
      />
    </div>
    <p class="text-muted-foreground mt-1 text-xs">
      函数接收 (arrayOfPings)，并应返回 {`{ status, latency }`}
    </p>
  </div>
</div>
