<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data = $bindable() }: { data: any } = $props();

  // Initialize defaults if not set
  if (!data.host) data.host = "";
  if (!data.port) data.port = "443";
  if (!data.degradedRemainingHours) data.degradedRemainingHours = 168; // 7 days
  if (!data.downRemainingHours) data.downRemainingHours = 24; // 1 day
</script>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <Label for="ssl-host">主机 <span class="text-destructive">*</span></Label>
      <Input id="ssl-host" bind:value={data.host} placeholder="example.com" />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="ssl-port">端口</Label>
      <Input id="ssl-port" bind:value={data.port} placeholder="443" />
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div class="flex flex-col gap-2">
      <div>
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>剩余有效期少于</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input
            id="ssl-degraded"
            type="number"
            class="text-right"
            bind:value={data.degradedRemainingHours}
            placeholder="168"
          />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Text>小时则为 DEGRADED</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
        <p class="text-muted-foreground mt-1 text-xs">证书将在指定小时数内过期时标记为 DEGRADED</p>
      </div>
    </div>
    <div class="flex flex-col gap-2">
      <div>
        <InputGroup.Root>
          <InputGroup.Addon>
            <InputGroup.Text>剩余有效期少于</InputGroup.Text>
          </InputGroup.Addon>
          <InputGroup.Input
            id="ssl-down"
            class="text-right"
            type="number"
            bind:value={data.downRemainingHours}
            placeholder="24"
          />
          <InputGroup.Addon align="inline-end">
            <InputGroup.Text>小时则为 DOWN</InputGroup.Text>
          </InputGroup.Addon>
        </InputGroup.Root>
        <p class="text-muted-foreground mt-1 text-xs">证书将在指定小时数内过期时标记为 DOWN</p>
      </div>
    </div>
  </div>
</div>
