<script lang="ts">
  import { monitorStatusLabels } from "$lib/client/admin-labels.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import XIcon from "@lucide/svelte/icons/x";
  import ImageIcon from "@lucide/svelte/icons/image";
  import type { MonitorRecord } from "$lib/server/types/db.js";
  import { toast } from "svelte-sonner";
  import { goto } from "$app/navigation";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import GC from "$lib/global-constants.js";

  interface Props {
    monitor: MonitorRecord;
    typeData: Record<string, unknown>;
    isNew: boolean;
  }

  let { monitor = $bindable(), typeData, isNew }: Props = $props();

  let savingGeneral = $state(false);
  let uploadingImage = $state(false);

  async function handleImageUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("文件类型无效。允许使用：PNG、JPG、SVG、WebP");
      return;
    }

    if (file.size > GC.MAX_UPLOAD_BYTES) {
      toast.error(`文件过大。最大大小为 ${GC.MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
      return;
    }

    uploadingImage = true;

    try {
      const base64 = await fileToBase64(file);

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uploadImage",
          data: {
            base64,
            mimeType: file.type,
            fileName: file.name,
            maxWidth: 128,
            maxHeight: 128,
            prefix: "monitor_"
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        monitor.image = result.url;
        toast.success("图片已成功上传");
      }
    } catch (e) {
      toast.error("上传图片失败");
    } finally {
      uploadingImage = false;
      input.value = "";
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  function clearImage() {
    monitor.image = "";
  }

  async function saveGeneralSettings() {
    savingGeneral = true;

    try {
      const payload: Record<string, unknown> = {
        ...monitor,
        type_data: JSON.stringify(typeData)
      };

      // Include default uptime settings when creating a new monitor
      if (isNew) {
        payload.monitor_settings_json = JSON.stringify({
          uptime_formula_numerator: "up + maintenance",
          uptime_formula_denominator: "up + maintenance + down + degraded"
        });
      }

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "storeMonitorData", data: payload })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else if (isNew) {
        toast.success("监控项已成功创建");
        goto(clientResolver(resolve, `/manage/app/monitors/${monitor.tag}`));
      } else {
        toast.success("常规设置已成功保存");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "保存常规设置失败";
      toast.error(message);
    } finally {
      savingGeneral = false;
    }
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title>常规设置</Card.Title>
    <Card.Description>此监控项的基本信息</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="monitor-name">名称 <span class="text-destructive">*</span></Label>
        <Input id="monitor-name" bind:value={monitor.name} placeholder="我的 API 监控项" />
      </div>
      <div class="flex flex-col gap-2">
        <Label for="monitor-tag">标签 <span class="text-destructive">*</span></Label>
        <Input id="monitor-tag" bind:value={monitor.tag} placeholder="my-api-monitor" disabled={!isNew} />
        <p class="text-muted-foreground mt-1 text-xs">唯一标识符（创建后无法更改）</p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="monitor-description">描述</Label>
      <Textarea
        id="monitor-description"
        bind:value={monitor.description}
        placeholder="简要描述此监控项检查的内容"
        rows={3}
      />
    </div>
    <div class="flex flex-col gap-2">
      <Label for="monitor-external_url">服务 URL</Label>
      <Input id="monitor-external_url" bind:value={monitor.external_url} placeholder="https://example.com/api/health" />
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label>监控项图片</Label>
        <div class="flex items-center gap-3">
          <div class="bg-muted flex h-12 w-12 items-center justify-center rounded-md border">
            {#if monitor.image}
              <img src={clientResolver(resolve, monitor.image)} alt="监控项" class="max-h-10 max-w-10 object-contain" />
            {:else}
              <ImageIcon class="text-muted-foreground h-5 w-5" />
            {/if}
          </div>
          <div class="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={uploadingImage}
              onclick={() => document.getElementById("monitor-image-input")?.click()}
            >
              {#if uploadingImage}
                <Loader class="h-4 w-4 animate-spin" />
                正在上传...
              {:else}
                <UploadIcon class="h-4 w-4" />
                上传
              {/if}
            </Button>
            <input
              id="monitor-image-input"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/heic,image/heif"
              class="hidden"
              onchange={handleImageUpload}
              disabled={uploadingImage}
            />
            {#if monitor.image}
              <Button variant="ghost" size="icon" aria-label="移除监控项图片" onclick={clearImage}>
                <XIcon class="h-4 w-4" />
              </Button>
            {/if}
          </div>
        </div>
        <p class="text-muted-foreground text-xs">最大 128x128 像素，支持 PNG/JPG/SVG/WebP</p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="monitor-cron">Cron 计划</Label>
        <Input id="monitor-cron" bind:value={monitor.cron} placeholder="* * * * *" />
        <p class="text-muted-foreground mt-1 text-xs">检查频率（Cron 格式）</p>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="flex flex-col gap-2">
        <Label for="monitor-default-status">默认状态</Label>
        <Select.Root
          type="single"
          value={monitor.default_status}
          onValueChange={(v) => {
            if (v) monitor.default_status = v;
          }}
        >
          <Select.Trigger id="monitor-default-status" class="w-full">
            {monitorStatusLabels[monitor.default_status] ?? monitor.default_status}
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="UP">正常</Select.Item>
            <Select.Item value="DOWN">故障</Select.Item>
            <Select.Item value="DEGRADED">性能下降</Select.Item>
            <Select.Item value="MAINTENANCE">维护中</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="hidden-switch">在状态页隐藏</Label>
        <div class="flex items-center gap-2">
          <Switch
            id="hidden-switch"
            checked={monitor.is_hidden === "YES"}
            onCheckedChange={(checked) => (monitor.is_hidden = checked ? "YES" : "NO")}
          />
          <span class="text-muted-foreground text-xs">
            {monitor.is_hidden === "YES" ? "隐藏" : "可见"}
          </span>
        </div>
        <p class="text-muted-foreground text-xs">
          隐藏的监控项不会出现在任何状态页上，但监控、告警及其他功能仍会正常运行。
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <Label for="monitor-confirmation-threshold">确认阈值</Label>
        <Input
          id="monitor-confirmation-threshold"
          type="number"
          min="1"
          max="60"
          step="1"
          value={monitor.confirmation_threshold ?? 1}
          oninput={(e) => {
            const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
            monitor.confirmation_threshold = Number.isNaN(v) ? 1 : Math.min(60, Math.max(1, v));
          }}
        />
        <p class="text-muted-foreground text-xs">连续检查达到此次数后才记录状态变化。1 = 关闭（每次检查立即记录）。</p>
      </div>
    </div>
  </Card.Content>
  <Card.Footer class="flex justify-end">
    <Button onclick={saveGeneralSettings} disabled={savingGeneral}>
      {#if savingGeneral}
        <Loader class="size-4 animate-spin" />
      {:else}
        <SaveIcon class="size-4" />
      {/if}
      {isNew ? "创建监控项" : "保存常规设置"}
    </Button>
  </Card.Footer>
</Card.Root>
