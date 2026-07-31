<script lang="ts">
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import type { NoneMonitorTypeData } from "$lib/server/types/monitor.js";

  let { data = $bindable() }: { data: NoneMonitorTypeData } = $props();

  if (data.overrideWithLastKnownStatus === undefined) {
    data.overrideWithLastKnownStatus = false;
  }
</script>

<div class="space-y-4">
  <div class="bg-muted/50 rounded-lg p-6 text-center">
    <p class="text-muted-foreground text-sm">此监控类型不会执行任何自动检查。状态必须通过 API 或事件手动更新。</p>
  </div>

  <div class="flex items-start gap-3 rounded-lg border p-4">
    <Checkbox id="none-override-last-known-status" bind:checked={data.overrideWithLastKnownStatus} />
    <div class="grid gap-1.5 leading-none">
      <Label for="none-override-last-known-status" class="cursor-pointer">使用最后已知状态覆盖</Label>
      <p class="text-muted-foreground text-sm">
        每次计划运行时复用最后一次通过 API
        创建的手动状态，使此监控项在状态历史、可用率和告警评估中保持该状态，直到您再次更改。
      </p>
    </div>
  </div>
</div>
