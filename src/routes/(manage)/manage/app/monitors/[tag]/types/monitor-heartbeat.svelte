<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import Copy from "@lucide/svelte/icons/copy";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import clientResolve from "$lib/client/resolver.js";
  import { resolve } from "$app/paths";
  import type { HeartbeatMonitorTypeData } from "$lib/server/types/monitor";
  import randomName from "@scaleway/random-name";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import { Badge } from "$lib/components/ui/badge";

  let { data = $bindable(), tag = "" }: { data: HeartbeatMonitorTypeData; tag?: string } = $props();

  // Initialize defaults if not set
  if (!data.degradedRemainingMinutes) data.degradedRemainingMinutes = 5;
  if (!data.downRemainingMinutes) data.downRemainingMinutes = 10;

  $effect(() => {
    if (!data.secretString) data.secretString = randomName() + "-" + randomName();
  });

  // Generate heartbeat URL
  let heartbeatUrl = $derived(
    tag
      ? window.location.origin + clientResolve(resolve, `/ext/heartbeat/${tag}/${data.secretString}`)
      : "请先保存监控项以获取心跳 URL"
  );

  //refresh secret string and thus heartbeat URL
  function refreshSecret() {
    data.secretString = randomName() + "-" + randomName();
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col">
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text><span class="text-degraded">性能下降</span> 阈值</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input
          class="text-right"
          id="hb-degraded"
          bind:value={data.degradedRemainingMinutes}
          placeholder="5"
        />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Text>分钟</InputGroup.Text>
        </InputGroup.Addon>
      </InputGroup.Root>
      <p class="text-muted-foreground mt-1 text-xs">若在指定分钟数内未收到心跳，则标记为性能下降</p>
    </div>
    <div class="flex flex-col">
      <InputGroup.Root>
        <InputGroup.Addon>
          <InputGroup.Text><span class="text-down">故障</span> 阈值</InputGroup.Text>
        </InputGroup.Addon>
        <InputGroup.Input class="text-right" id="hb-down" bind:value={data.downRemainingMinutes} placeholder="10" />
        <InputGroup.Addon align="inline-end">
          <InputGroup.Text>分钟</InputGroup.Text>
        </InputGroup.Addon>
      </InputGroup.Root>
      <p class="text-muted-foreground mt-1 text-xs">若在指定分钟数内未收到心跳，则标记为故障</p>
    </div>
  </div>

  <div class="flex flex-col gap-2">
    <Label>心跳 URL</Label>
    <div>
      <div class="flex items-center gap-2">
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>
              <Badge>GET | POST</Badge>
            </InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input class="text-muted-foreground" id="hb-secret" bind:value={heartbeatUrl} readonly />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Button variant="secondary" onclick={refreshSecret}>生成新 URL</InputGroup.Button>

            <CopyButton variant="ghost" size="icon-sm" text={heartbeatUrl} title="复制心跳 URL" copiedLabel="已复制">
              <Copy class="size-4" />
            </CopyButton>
          </InputGroup.Addon>
        </InputGroup.Root>
      </div>
      <p class="text-muted-foreground mt-1 text-xs">向此 URL 发送 GET 或 POST 请求以记录心跳</p>
    </div>
  </div>
</div>
