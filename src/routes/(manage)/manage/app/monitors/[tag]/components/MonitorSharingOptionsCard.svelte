<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import type { MonitorRecord, MonitorSharingOptions } from "$lib/server/types/db.js";
  import { toast } from "svelte-sonner";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import type { SiteSubMenuOptions } from "$lib/types/site";

  interface Props {
    monitor: MonitorRecord;
    typeData: Record<string, unknown>;
    subMenuOptions: SiteSubMenuOptions | null;
  }

  let { monitor = $bindable(), typeData, subMenuOptions }: Props = $props();

  const DEFAULT_SHARING_OPTIONS: MonitorSharingOptions = {
    showShareBadgeMonitor: true,
    showShareEmbedMonitor: true
  };

  function parseSharingOptions(monitorSettingsJson: string | null): MonitorSharingOptions {
    if (!monitorSettingsJson) {
      return { ...DEFAULT_SHARING_OPTIONS };
    }

    try {
      const settings = JSON.parse(monitorSettingsJson) as {
        sharing_options?: Partial<MonitorSharingOptions>;
      };
      const parsed = settings.sharing_options ?? {};

      return {
        showShareBadgeMonitor: parsed.showShareBadgeMonitor ?? true,
        showShareEmbedMonitor: parsed.showShareEmbedMonitor ?? true
      };
    } catch {
      return { ...DEFAULT_SHARING_OPTIONS };
    }
  }

  let sharingOptions = $state<MonitorSharingOptions>(parseSharingOptions(monitor.monitor_settings_json));
  let saving = $state(false);

  async function save() {
    saving = true;

    try {
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
        sharing_options: {
          showShareBadgeMonitor: sharingOptions.showShareBadgeMonitor,
          showShareEmbedMonitor: sharingOptions.showShareEmbedMonitor
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
        monitor.monitor_settings_json = JSON.stringify(mergedSettings);
        toast.success("共享选项已成功保存");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存共享选项失败";
      toast.error(message);
    } finally {
      saving = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>共享选项</Card.Title>
    <Card.Description>控制此监控项可用的共享操作</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-6">
    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>共享徽章</Label>
        <p class="text-muted-foreground text-xs">
          显示获取可嵌入状态和可用率徽章的选项
          <span class="text-red-500" class:hidden={subMenuOptions?.showShareBadgeMonitor}> 已被站点设置禁用 </span>
        </p>
      </div>
      <Switch bind:checked={sharingOptions.showShareBadgeMonitor} disabled={!subMenuOptions?.showShareBadgeMonitor} />
    </div>

    <div class="flex items-center justify-between">
      <div class="space-y-0.5">
        <Label>共享嵌入代码</Label>
        <p class="text-muted-foreground text-xs">
          显示获取此监控项 iframe 或脚本嵌入代码的选项
          <span class="text-red-500" class:hidden={subMenuOptions?.showShareEmbedMonitor}> 已被站点设置禁用 </span>
        </p>
      </div>
      <Switch bind:checked={sharingOptions.showShareEmbedMonitor} disabled={!subMenuOptions?.showShareEmbedMonitor} />
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-end">
    <Button onclick={save} disabled={saving}>
      {#if saving}
        <Loader class="size-4 animate-spin" />
      {:else}
        <SaveIcon class="size-4" />
      {/if}
      保存共享选项
    </Button>
  </Card.Footer>
</Card.Root>
