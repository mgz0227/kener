<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import Plus from "@lucide/svelte/icons/plus";
  import X from "@lucide/svelte/icons/x";
  import { AllRecordTypes } from "$lib/clientTools";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data = $bindable() }: { data: any } = $props();

  // Initialize defaults if not set
  if (!data.host) data.host = "";
  if (!data.nameServer) data.nameServer = "";
  if (!data.lookupRecord) data.lookupRecord = "A";
  if (!data.matchType) data.matchType = "ANY";
  if (!data.transport) data.transport = "UDP";
  if (!data.tlsPort) data.tlsPort = 853;
  if (!data.tlsServername) data.tlsServername = "";
  if (data.allowSelfSignedCert === undefined) data.allowSelfSignedCert = false;
  if (!data.values) data.values = [""];

  const recordTypes = Object.keys(AllRecordTypes);
  const usesTls = $derived(data.transport === "TLS");

  function addValue() {
    data.values = [...data.values, ""];
  }

  function removeValue(index: number) {
    data.values = data.values.filter((_: unknown, i: number) => i !== index);
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <Label for="dns-transport">传输协议</Label>
      <Select.Root
        type="single"
        value={data.transport}
        onValueChange={(v) => {
          if (v) data.transport = v;
        }}
      >
        <Select.Trigger id="dns-transport" class="w-full">
          {data.transport === "TLS" ? "DNS-over-TLS" : "UDP"}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="UDP">UDP - 标准 DNS（端口 53）</Select.Item>
          <Select.Item value="TLS">TLS - DNS-over-TLS（端口 853）</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
    <div class="flex flex-col gap-2">
      <Label for="dns-host">主机 <span class="text-destructive">*</span></Label>
      <Input id="dns-host" bind:value={data.host} placeholder="example.com" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <Label for="dns-nameserver">
        名称服务器
        {#if usesTls}
          <span class="text-destructive">*</span>
        {:else}
          （可选）
        {/if}
      </Label>
      <Input
        id="dns-nameserver"
        bind:value={data.nameServer}
        placeholder={usesTls ? "1.1.1.1 或 dns.example.com" : "留空以使用权威查询"}
      />
      {#if usesTls}
        <p class="text-muted-foreground text-xs">
          DoT 解析器地址。使用 IP 解析器时，请按需设置 TLS 服务器名称（例如 8.8.8.8 → dns.google）。
        </p>
      {:else}
        <p class="text-muted-foreground text-xs">留空将自动使用权威 DNS 名称服务器。</p>
      {/if}
    </div>
    {#if usesTls}
      <div class="flex flex-col gap-2">
        <Label for="dns-tls-port">TLS 端口</Label>
        <Input id="dns-tls-port" type="number" min="1" max="65535" bind:value={data.tlsPort} placeholder="853" />
      </div>
    {/if}
  </div>

  {#if usesTls}
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="dns-tls-servername">TLS 服务器名称（可选）</Label>
        <Input id="dns-tls-servername" bind:value={data.tlsServername} placeholder="dns.google" />
        <p class="text-muted-foreground text-xs">TLS 使用的 SNI 主机名。通过 IP 地址连接许多公共解析器时必须填写。</p>
      </div>
      <div class="flex items-center gap-3 pt-6">
        <Switch id="dns-self-signed" bind:checked={data.allowSelfSignedCert} />
        <Label for="dns-self-signed">允许自签名 TLS 证书</Label>
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <Label for="dns-record">查询记录</Label>
      <Select.Root
        type="single"
        value={data.lookupRecord}
        onValueChange={(v) => {
          if (v) data.lookupRecord = v;
        }}
      >
        <Select.Trigger id="dns-record" class="w-full">
          {data.lookupRecord}
        </Select.Trigger>
        <Select.Content>
          {#each recordTypes as recordType}
            <Select.Item value={recordType}>{recordType}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <div class="flex flex-col gap-2">
      <Label for="dns-matchtype">匹配方式</Label>
      <Select.Root
        type="single"
        value={data.matchType}
        onValueChange={(v) => {
          if (v) data.matchType = v as "ALL" | "ANY";
        }}
      >
        <Select.Trigger id="dns-matchtype" class="w-full">
          {data.matchType}
        </Select.Trigger>
        <Select.Content>
          <Select.Item value="ANY">ANY - 至少一个值匹配</Select.Item>
          <Select.Item value="ALL">ALL - 所有值都必须匹配</Select.Item>
        </Select.Content>
      </Select.Root>
    </div>
  </div>

  <div>
    <div class="mb-2 flex items-center justify-between">
      <Label>预期值 <span class="text-destructive">*</span></Label>
      <Button variant="outline" size="sm" onclick={addValue}>
        <Plus class="mr-1 size-4" />
        {data.values.length > 0 ? "添加更多值" : "添加值"}
      </Button>
    </div>
    {#if data.values.length > 0}
      <div class="space-y-2">
        {#each data.values as value, index}
          <InputGroup.Root>
            <InputGroup.Addon class="">
              <InputGroup.Text class="border-r-2 pr-2">值 {index + 1}</InputGroup.Text>
            </InputGroup.Addon>
            <InputGroup.Input bind:value={data.values[index]} placeholder="预期的 DNS 值" />
            <InputGroup.Addon align="inline-end">
              <InputGroup.Button variant="ghost" size="icon-xs" onclick={() => removeValue(index)}>
                <X class="size-4" />
              </InputGroup.Button>
            </InputGroup.Addon>
          </InputGroup.Root>
        {/each}
      </div>
    {:else}
      <p class="text-muted-foreground text-sm">尚未添加值。点击“添加值”以添加预期的 DNS 响应值。</p>
    {/if}
  </div>
</div>
