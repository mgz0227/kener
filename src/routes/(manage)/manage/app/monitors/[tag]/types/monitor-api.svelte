<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { DefaultAPIEval } from "$lib/anywhere.js";
  import CodeMirror from "svelte-codemirror-editor";
  import { javascript } from "@codemirror/lang-javascript";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import { mode } from "mode-watcher";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data = $bindable() }: { data: any } = $props();

  // Initialize defaults if not set
  if (!data.url) data.url = "";
  if (!data.method) data.method = "GET";
  if (!data.headers) data.headers = [];
  if (!data.body) data.body = "";
  if (!data.timeout) data.timeout = 10000;
  if (!data.eval) data.eval = DefaultAPIEval;
  if (data.allowSelfSignedCert === undefined) data.allowSelfSignedCert = false;

  if (data.follow_redirects === undefined) data.follow_redirects = true;
  if (data.max_redirects === undefined) data.max_redirects = 5;

  const methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

  function addHeader() {
    data.headers = [...(data.headers || []), { key: "", value: "" }];
  }

  function removeHeader(index: number) {
    data.headers = data.headers?.filter((_: unknown, i: number) => i !== index);
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-4 gap-4">
    <div class="col-span-3 flex flex-col gap-2">
      <Label for="api-url">URL <span class="text-destructive">*</span></Label>
      <Input id="api-url" bind:value={data.url} placeholder="https://api.example.com/health" />
    </div>
    <div class="col-span-1 flex flex-col gap-2">
      <Label for="api-method">请求方法</Label>
      <Select.Root
        type="single"
        value={data.method}
        onValueChange={(v) => {
          if (v) data.method = v;
        }}
      >
        <Select.Trigger id="api-method" class="w-full">
          {data.method}
        </Select.Trigger>
        <Select.Content>
          {#each methods as method}
            <Select.Item value={method}>{method}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <Label for="api-timeout">超时时间（毫秒）</Label>
    <Input id="api-timeout" type="number" bind:value={data.timeout} placeholder="10000" />
  </div>

  <div class="flex flex-col gap-2">
    <Label for="api-proxy">代理 URL</Label>
    <Input id="api-proxy" bind:value={data.proxy} placeholder="http://user:$PROXY_PASS@proxy.internal:3128" />
    <p class="text-muted-foreground text-xs">留空时使用环境变量 HTTP_PROXY / HTTPS_PROXY。</p>
  </div>

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

  {#if data.method !== "GET" && data.method !== "HEAD"}
    <div class="flex flex-col gap-2">
      <Label for="api-body">请求体</Label>
      <Textarea id="api-body" bind:value={data.body} placeholder={'{"key": "value"}'} rows={4} />
    </div>
  {/if}

  <div class="flex items-center space-x-2">
    <Switch id="api-self-signed" bind:checked={data.allowSelfSignedCert} />
    <Label for="api-self-signed">允许自签名证书</Label>
  </div>

  <div class="flex items-center space-x-2">
    <Switch id="api-follow-redirects" bind:checked={data.follow_redirects} />
    <Label for="api-follow-redirects">跟随重定向</Label>
  </div>

  <div class="flex flex-col gap-2">
    <Label for="api-max-redirects">最大重定向次数</Label>
    <Input
      id="api-max-redirects"
      type="number"
      min="0"
      max="20"
      step="1"
      bind:value={data.max_redirects}
      disabled={!data.follow_redirects}
    />
  </div>

  <div class="flex flex-col gap-2">
    <Label for="api-eval">自定义评估函数</Label>
    <div class="rounded-md border">
      <CodeMirror
        bind:value={data.eval}
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
      函数接收 (statusCode, responseTime, responseRaw, modules)，并应返回 {`{ status, latency }`}
    </p>
  </div>
</div>
