<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import DatabaseIcon from "@lucide/svelte/icons/database";
  import { toast } from "svelte-sonner";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";

  interface Props {
    monitorTag: string;
  }

  let { monitorTag }: Props = $props();

  let modifyingData = $state(false);
  let modifyDataError = $state<string | null>(null);
  let modifyDataForm = $state({
    start: "",
    end: "",
    newStatus: "UP" as "UP" | "DEGRADED" | "DOWN",
    latency: 0,
    deviation: 0
  });

  async function modifyMonitoringData() {
    modifyDataError = null;

    if (!modifyDataForm.start) {
      modifyDataError = "开始日期不能为空";
      return;
    }
    if (!modifyDataForm.end) {
      modifyDataError = "结束日期不能为空";
      return;
    }

    const startTimestamp = Math.floor(new Date(modifyDataForm.start).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(modifyDataForm.end).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
      modifyDataError = "开始日期必须早于结束日期";
      return;
    }

    if (modifyDataForm.latency < 0) {
      modifyDataError = "延迟不能为负数";
      return;
    }
    if (modifyDataForm.deviation < 0) {
      modifyDataError = "偏差不能为负数";
      return;
    }

    modifyingData = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateMonitoringData",
          data: {
            monitor_tag: monitorTag,
            start: startTimestamp,
            end: endTimestamp,
            newStatus: modifyDataForm.newStatus,
            latency: modifyDataForm.latency,
            deviation: modifyDataForm.deviation
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        modifyDataError = result.error;
      } else {
        toast.success("监控数据已成功更新");
        modifyDataForm = { start: "", end: "", newStatus: "UP", latency: 0, deviation: 0 };
      }
    } catch (e) {
      modifyDataError = "更新监控数据失败";
    } finally {
      modifyingData = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <DatabaseIcon class="size-5" />
      修改监控数据
    </Card.Title>
    <Card.Description>更改指定时间范围内监控数据的状态</Card.Description>
  </Card.Header>
  <Card.Content>
    <div class="grid gap-4">
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="start_date">开始日期和时间 <span class="text-destructive">*</span></Label>
          <Input id="start_date" type="datetime-local" bind:value={modifyDataForm.start} />
        </div>
        <div class="space-y-2">
          <Label for="end_date">结束日期和时间 <span class="text-destructive">*</span></Label>
          <Input id="end_date" type="datetime-local" bind:value={modifyDataForm.end} min={modifyDataForm.start} />
        </div>
      </div>
      <div class="grid grid-cols-3 gap-4">
        <div class="space-y-2">
          <Label for="new_status">新状态</Label>
          <Select.Root
            type="single"
            value={modifyDataForm.newStatus}
            onValueChange={(value) => {
              if (value) modifyDataForm.newStatus = value as "UP" | "DEGRADED" | "DOWN";
            }}
          >
            <Select.Trigger id="new_status" class="w-full">
              {modifyDataForm.newStatus}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="UP">UP</Select.Item>
              <Select.Item value="DEGRADED">DEGRADED</Select.Item>
              <Select.Item value="DOWN">DOWN</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-2">
          <Label for="latency">延迟（毫秒）</Label>
          <Input id="latency" type="number" min="0" bind:value={modifyDataForm.latency} placeholder="100" />
        </div>
        <div class="space-y-2">
          <Label for="deviation">偏差（毫秒）</Label>
          <Input id="deviation" type="number" min="0" bind:value={modifyDataForm.deviation} placeholder="0" />
        </div>
      </div>
      <p class="text-muted-foreground text-xs">
        每个数据点的延迟将在“延迟 ± 偏差”范围内随机生成。将偏差设为 0 可使用固定延迟值。
      </p>
      {#if modifyDataError}
        <p class="text-destructive text-sm">{modifyDataError}</p>
      {/if}
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-end">
    <Button onclick={modifyMonitoringData} disabled={modifyingData}>
      {#if modifyingData}
        <Loader class="size-4 animate-spin" />
        正在保存...
      {:else}
        <SaveIcon class="size-4" />
        保存更改
      {/if}
    </Button>
  </Card.Footer>
</Card.Root>
