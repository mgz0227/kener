<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import type { MonitorRecord } from "$lib/server/types/db.js";
  import { toast } from "svelte-sonner";
  import GC from "$lib/global-constants.js";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";

  interface Props {
    monitor: MonitorRecord;
    typeData: Record<string, unknown>;
    statusHistoryDays: {
      desktop: number;
      mobile: number;
    };
  }

  let { monitor = $bindable(), typeData, statusHistoryDays = $bindable() }: Props = $props();

  let saving = $state(false);

  const isDesktopValid = $derived(
    Number.isInteger(statusHistoryDays.desktop) &&
      statusHistoryDays.desktop >= GC.STATUS_HISTORY_DAYS_MIN &&
      statusHistoryDays.desktop <= GC.STATUS_HISTORY_DAYS_MAX
  );
  const isMobileValid = $derived(
    Number.isInteger(statusHistoryDays.mobile) &&
      statusHistoryDays.mobile >= GC.STATUS_HISTORY_DAYS_MIN &&
      statusHistoryDays.mobile <= GC.STATUS_HISTORY_DAYS_MAX
  );
  const isValid = $derived(isDesktopValid && isMobileValid);

  async function save() {
    if (!isValid) {
      toast.error(`天数必须是 ${GC.STATUS_HISTORY_DAYS_MIN} 到 ${GC.STATUS_HISTORY_DAYS_MAX} 之间的整数`);
      return;
    }

    saving = true;
    try {
      // Merge with existing monitor_settings_json to avoid overwriting other settings
      let existingSettings: Record<string, unknown> = {};
      if (monitor.monitor_settings_json) {
        try {
          existingSettings = JSON.parse(monitor.monitor_settings_json);
        } catch {
          existingSettings = {};
        }
      }

      const mergedSettings = {
        ...existingSettings,
        monitor_status_history_days: {
          desktop: statusHistoryDays.desktop,
          mobile: statusHistoryDays.mobile
        }
      };

      const payload = {
        ...monitor,
        type_data: JSON.stringify(typeData),
        monitor_settings_json: JSON.stringify(mergedSettings)
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
        // Update the monitor's settings_json so subsequent saves from other cards stay in sync
        monitor.monitor_settings_json = JSON.stringify(mergedSettings);
        toast.success("状态历史设置已成功保存");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存状态历史设置失败";
      toast.error(message);
    } finally {
      saving = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>状态历史天数</Card.Title>
    <Card.Description>配置此监控项在状态页加载时默认显示多少天的状态历史</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="space-y-2">
        <Label for="monitor-history-desktop">桌面端（天）</Label>
        <Input
          id="monitor-history-desktop"
          type="number"
          step="1"
          min={GC.STATUS_HISTORY_DAYS_MIN}
          max={GC.STATUS_HISTORY_DAYS_MAX}
          bind:value={statusHistoryDays.desktop}
          class={isDesktopValid ? "" : "border-destructive"}
        />
        <p class="text-muted-foreground text-xs">桌面端显示的天数</p>
      </div>
      <div class="space-y-2">
        <Label for="monitor-history-mobile">移动端（天）</Label>
        <Input
          id="monitor-history-mobile"
          type="number"
          step="1"
          min={GC.STATUS_HISTORY_DAYS_MIN}
          max={GC.STATUS_HISTORY_DAYS_MAX}
          bind:value={statusHistoryDays.mobile}
          class={isMobileValid ? "" : "border-destructive"}
        />
        <p class="text-muted-foreground text-xs">移动端显示的天数</p>
      </div>
    </div>
    <p class="text-muted-foreground text-xs">
      此设置会覆盖该监控项的页面级默认值。数值必须是 {GC.STATUS_HISTORY_DAYS_MIN} 到 {GC.STATUS_HISTORY_DAYS_MAX}
      之间的整数。
    </p>
  </Card.Content>
  <Card.Footer class="flex justify-end">
    <Button onclick={save} disabled={saving || !isValid}>
      {#if saving}
        <Loader class="size-4 animate-spin" />
      {:else}
        <SaveIcon class="size-4" />
      {/if}
      保存状态历史设置
    </Button>
  </Card.Footer>
</Card.Root>
