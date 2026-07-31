<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import Loader from "@lucide/svelte/icons/loader";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import type { MonitorRecord } from "$lib/server/types/db.js";

  interface Props {
    monitor: MonitorRecord;
    status: string;
  }

  let { monitor, status }: Props = $props();

  const monitorTag = $derived(monitor.tag);

  let deleting = $state(false);
  let deletingData = $state(false);
  let updatingStatus = $state(false);
  let deleteConfirmText = $state("");
  let deleteDataConfirmText = $state("");
  let deleteDataStart = $state("");
  let deleteDataEnd = $state("");

  async function updateStatus() {
    if (!monitor.id || !monitor.tag) return;

    updatingStatus = true;
    try {
      const normalizedStatus = status || "INACTIVE";

      const payload: Record<string, unknown> = {
        ...monitor,
        status: normalizedStatus
      };

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "storeMonitorData", data: payload })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        monitor.status = normalizedStatus;
        status = normalizedStatus;
        toast.success("监控项状态已成功更新");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "更新监控项状态失败";
      toast.error(message);
    } finally {
      updatingStatus = false;
    }
  }

  async function deleteMonitorData() {
    if (!monitorTag) return;
    if (deleteDataConfirmText !== `删除 ${monitorTag} 数据`) {
      toast.error("请输入正确的确认文本");
      return;
    }
    if (!deleteDataStart || !deleteDataEnd) {
      toast.error("开始和结束日期不能为空");
      return;
    }

    const startTimestamp = Math.floor(new Date(deleteDataStart).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(deleteDataEnd).getTime() / 1000);

    if (startTimestamp >= endTimestamp) {
      toast.error("开始日期必须早于结束日期");
      return;
    }

    deletingData = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteMonitorData",
          data: { tag: monitorTag, start: startTimestamp, end: endTimestamp }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控数据已成功删除");
        deleteDataConfirmText = "";
        deleteDataStart = "";
        deleteDataEnd = "";
      }
    } catch (e) {
      toast.error("删除监控数据失败");
    } finally {
      deletingData = false;
    }
  }

  async function deleteMonitor() {
    if (!monitorTag) return;
    if (deleteConfirmText !== `删除 ${monitorTag}`) {
      toast.error("请输入正确的确认文本");
      return;
    }

    deleting = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteMonitor",
          data: { tag: monitorTag }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控项已成功删除");
        goto(clientResolver(resolve, "/manage/app/monitors"));
      }
    } catch (e) {
      toast.error("删除监控项失败");
    } finally {
      deleting = false;
    }
  }
</script>

<Card.Root class="border-destructive">
  <Card.Header>
    <Card.Title class="text-destructive flex items-center gap-2">
      <TrashIcon class="size-5" />
      危险操作
    </Card.Title>
  </Card.Header>
  <Card.Content class="">
    <h2 class="text-lg font-semibold">更新状态</h2>
    <div class="mb-5 flex items-center justify-between border-b pb-5">
      <div>设置监控项状态</div>
      <div class="flex gap-2">
        <Select.Root
          type="single"
          value={status}
          onValueChange={(v) => {
            if (v) {
              status = v;
            }
          }}
        >
          <Select.Trigger class="w-[180px]">{status}</Select.Trigger>
          <Select.Content>
            <Select.Item value="ACTIVE">ACTIVE</Select.Item>
            <Select.Item value="INACTIVE">INACTIVE</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button onclick={updateStatus} disabled={updatingStatus || status === (monitor.status || "INACTIVE")}>
          {#if updatingStatus}
            <Loader class="size-4 animate-spin" />
            正在更新...
          {:else}
            更新状态
          {/if}
        </Button>
      </div>
    </div>
    <div class="mb-5 space-y-4 border-b pb-5">
      <h2 class="text-lg font-semibold">删除监控数据</h2>
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="deleteDataStart">开始日期和时间 <span class="text-destructive">*</span></Label>
          <Input id="deleteDataStart" type="datetime-local" bind:value={deleteDataStart} />
        </div>
        <div class="space-y-2">
          <Label for="deleteDataEnd">结束日期和时间 <span class="text-destructive">*</span></Label>
          <Input id="deleteDataEnd" type="datetime-local" bind:value={deleteDataEnd} min={deleteDataStart} />
        </div>
      </div>
      <div class="flex items-end gap-4">
        <div class="flex-1 space-y-2">
          <Label for="deleteDataConfirm">
            输入 <span class="text-destructive font-mono">删除 {monitorTag} 数据</span> 以确认
          </Label>
          <p class="text-muted-foreground">这将删除所选时间范围内的监控数据，不会删除监控项本身。</p>
          <Input id="deleteDataConfirm" bind:value={deleteDataConfirmText} placeholder="删除 {monitorTag} 数据" />
        </div>
        <Button
          variant="destructive"
          onclick={deleteMonitorData}
          disabled={deletingData || deleteDataConfirmText !== `删除 ${monitorTag} 数据`}
        >
          {#if deletingData}
            <Loader class="size-4 animate-spin" />
            正在删除...
          {:else}
            <TrashIcon class="size-4" />
            删除数据
          {/if}
        </Button>
      </div>
    </div>
    <div>
      <h2 class="text-lg font-semibold">删除监控项</h2>
      <div class="flex items-end gap-4">
        <div class="flex-1 space-y-2">
          <Label for="deleteConfirm">
            输入 <span class="text-destructive font-mono">删除 {monitorTag}</span> 以确认
          </Label>
          <p class="text-muted-foreground">删除监控项后无法恢复，请谨慎操作。</p>
          <Input id="deleteConfirm" bind:value={deleteConfirmText} placeholder="删除 {monitorTag}" />
        </div>
        <Button
          variant="destructive"
          onclick={deleteMonitor}
          disabled={deleting || deleteConfirmText !== `删除 ${monitorTag}`}
        >
          {#if deleting}
            <Loader class="size-4 animate-spin" />
            正在删除...
          {:else}
            <TrashIcon class="size-4" />
            删除监控项
          {/if}
        </Button>
      </div>
    </div>
  </Card.Content>
</Card.Root>
