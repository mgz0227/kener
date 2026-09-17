<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data = $bindable() }: { data: any } = $props();

  const OPERATORS = [">", ">=", "<", "<=", "==", "!="] as const;
  const STATUS_OPTIONS = ["DOWN", "DEGRADED", "UP"] as const;

  // Initialize defaults if not set. `down` / `degraded` intentionally stay
  // undefined until the user enables them.
  if (!data.url) data.url = "";
  if (!data.query) data.query = "";
  if (!data.noDataStatus) data.noDataStatus = "DOWN";
  if (!data.errorStatus) data.errorStatus = "DOWN";
  if (!data.headers) data.headers = [];
  if (!data.timeout) data.timeout = 10000;
  if (data.allowSelfSignedCert === undefined) data.allowSelfSignedCert = false;

  function toggleDown(on: boolean) {
    data.down = on ? { operator: ">", value: 0 } : undefined;
  }
  function toggleDegraded(on: boolean) {
    data.degraded = on ? { operator: ">", value: 0 } : undefined;
  }

  function addHeader() {
    data.headers = [...(data.headers || []), { key: "", value: "" }];
  }
  function removeHeader(index: number) {
    data.headers = data.headers?.filter((_: unknown, i: number) => i !== index);
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-2">
    <Label for="prom-url">URL <span class="text-destructive">*</span></Label>
    <Input id="prom-url" bind:value={data.url} placeholder="https://prometheus.example.com" />
  </div>

  <div class="flex flex-col gap-2">
    <Label for="prom-query">PromQL 查询 <span class="text-destructive">*</span></Label>
    <Textarea id="prom-query" bind:value={data.query} placeholder="up" rows={3} />
    <p class="text-muted-foreground mt-1 text-xs">
      执行即时查询。请在 PromQL 中聚合多序列结果（例如 <code>max(...)</code>），否则仅使用第一个序列。
    </p>
  </div>

  <!-- Down condition -->
  <div class="flex items-center space-x-2">
    <Switch id="prom-down-enabled" checked={!!data.down} onCheckedChange={toggleDown} />
    <Label for="prom-down-enabled">中断条件</Label>
  </div>
  {#if data.down}
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="prom-down-op">比较运算符</Label>
        <Select.Root
          type="single"
          value={data.down.operator}
          onValueChange={(v) => {
            if (v) data.down.operator = v;
          }}
        >
          <Select.Trigger id="prom-down-op" class="w-full">{data.down.operator}</Select.Trigger>
          <Select.Content>
            {#each OPERATORS as op}
              <Select.Item value={op}>{op}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="prom-down-val">数值</Label>
        <Input id="prom-down-val" type="number" bind:value={data.down.value} />
      </div>
    </div>
    <p class="text-muted-foreground -mt-2 text-xs">
      指标值满足 {data.down.operator}
      {data.down.value} 时，状态为中断（DOWN）。
    </p>
  {/if}

  <!-- Degraded condition -->
  <div class="flex items-center space-x-2">
    <Switch id="prom-degraded-enabled" checked={!!data.degraded} onCheckedChange={toggleDegraded} />
    <Label for="prom-degraded-enabled">性能下降条件</Label>
  </div>
  {#if data.degraded}
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="prom-degraded-op">比较运算符</Label>
        <Select.Root
          type="single"
          value={data.degraded.operator}
          onValueChange={(v) => {
            if (v) data.degraded.operator = v;
          }}
        >
          <Select.Trigger id="prom-degraded-op" class="w-full">{data.degraded.operator}</Select.Trigger>
          <Select.Content>
            {#each OPERATORS as op}
              <Select.Item value={op}>{op}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="prom-degraded-val">数值</Label>
        <Input id="prom-degraded-val" type="number" bind:value={data.degraded.value} />
      </div>
    </div>
    <p class="text-muted-foreground -mt-2 text-xs">
      指标值满足 {data.degraded.operator}
      {data.degraded.value} 时，状态为性能下降（DEGRADED），在中断条件之后检查。
    </p>
  {/if}

  <!-- No-data status -->
  <div class="flex flex-col gap-2">
    <Label for="prom-nodata">无数据时的状态</Label>
    <Select.Root
      type="single"
      value={data.noDataStatus}
      onValueChange={(v) => {
        if (v) data.noDataStatus = v;
      }}
    >
      <Select.Trigger id="prom-nodata" class="w-full">{data.noDataStatus}</Select.Trigger>
      <Select.Content>
        {#each STATUS_OPTIONS as opt}
          <Select.Item value={opt}>{opt}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <p class="text-muted-foreground mt-1 text-xs">查询未返回数据时记录的状态。</p>
  </div>

  <div class="flex flex-col gap-2">
    <Label for="prom-error">无法访问时的状态</Label>
    <Select.Root
      type="single"
      value={data.errorStatus}
      onValueChange={(v) => {
        if (v) data.errorStatus = v;
      }}
    >
      <Select.Trigger id="prom-error" class="w-full">{data.errorStatus}</Select.Trigger>
      <Select.Content>
        {#each STATUS_OPTIONS as opt}
          <Select.Item value={opt}>{opt}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <p class="text-muted-foreground mt-1 text-xs">
      无法连接 Prometheus 或返回无效响应（超时、HTTP 错误、响应格式错误）时记录的状态。
      这与查询成功但未匹配任何结果的“无数据”状态不同。
    </p>
  </div>

  <!-- Headers -->
  <div>
    <div class="mb-2 flex items-center justify-between">
      <Label>请求头</Label>
      <Button variant="outline" size="sm" onclick={addHeader}>
        <Plus class="mr-1 size-4" />
        添加请求头
      </Button>
    </div>
    {#if data.headers && data.headers.length > 0}
      <div class="space-y-2">
        {#each data.headers as header, index}
          <div class="flex items-center gap-2">
            <Input bind:value={header.key} placeholder="请求头名称" class="flex-1" />
            <Input bind:value={header.value} placeholder="请求头值" class="flex-1" />
            <Button variant="ghost" size="icon" onclick={() => removeHeader(index)}>
              <X class="size-4" />
            </Button>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Timeout -->
  <div class="flex flex-col gap-2">
    <Label for="prom-timeout">超时时间（毫秒）</Label>
    <Input id="prom-timeout" type="number" bind:value={data.timeout} placeholder="10000" />
  </div>

  <!-- Proxy -->
  <div class="flex flex-col gap-2">
    <Label for="prom-proxy">代理 URL</Label>
    <Input id="prom-proxy" bind:value={data.proxy} placeholder="http://user:$PROXY_PASS@proxy.internal:3128" />
    <p class="text-muted-foreground text-xs">留空时使用环境变量 HTTP_PROXY / HTTPS_PROXY。</p>
  </div>

  <!-- Self-signed -->
  <div class="flex items-center space-x-2">
    <Switch id="prom-self-signed" bind:checked={data.allowSelfSignedCert} />
    <Label for="prom-self-signed">允许自签名证书</Label>
  </div>
</div>
