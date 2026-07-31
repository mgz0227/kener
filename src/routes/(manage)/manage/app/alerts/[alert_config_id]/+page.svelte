<script lang="ts">
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import * as Command from "$lib/components/ui/command/index.js";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
  import CheckIcon from "@lucide/svelte/icons/check";
  import XIcon from "@lucide/svelte/icons/x";
  import GC from "$lib/global-constants";
  import type {
    TriggerRecord,
    MonitorAlertConfigWithTriggers,
    AlertForType,
    AlertSeverityType,
    YesNoType
  } from "$lib/server/types/db";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { getAlertText } from "$lib/alerts/alert-text";

  let { data } = $props();
  const alertConfigId = $derived(data.alert_config_id);
  const isNew = $derived(alertConfigId === "new");

  // State
  let loading = $state(true);
  let saving = $state(false);
  let triggers = $state<TriggerRecord[]>([]);
  let monitors = $state<{ tag: string; name: string }[]>([]);
  let deleteDialogOpen = $state(false);
  let monitorPopoverOpen = $state(false);

  // Form state
  const defaultForm = {
    monitor_tags: [] as string[],
    alert_for: "STATUS" as AlertForType,
    alert_value: "DOWN",
    failure_threshold: 3,
    success_threshold: 1,
    alert_description: "",
    create_incident: "NO" as YesNoType,
    is_active: "YES" as YesNoType,
    severity: "WARNING" as AlertSeverityType,
    trigger_ids: [] as number[]
  };

  let form = $state({ ...defaultForm });

  // Options
  const alertForOptions: { value: AlertForType; label: string }[] = [
    { value: GC.STATUS, label: "状态" },
    { value: GC.LATENCY, label: "延迟" },
    { value: GC.UPTIME, label: "可用率" }
  ];

  const statusValueOptions = [
    { value: GC.DOWN, label: "中断" },
    { value: GC.DEGRADED, label: "性能下降" }
  ];

  const severityOptions: { value: AlertSeverityType; label: string }[] = [
    { value: GC.CRITICAL, label: "严重" },
    { value: GC.WARNING, label: "警告" }
  ];

  const yesNoOptions: { value: YesNoType; label: string }[] = [
    { value: GC.YES, label: "是" },
    { value: GC.NO, label: "否" }
  ];

  // Computed labels
  const alertValueLabel = $derived(getAlertText({ kind: "label", alert_for: form.alert_for }));
  const alertValueHelp = $derived(getAlertText({ kind: "help", alert_for: form.alert_for }));
  const alertDescriptionText = $derived(
    getAlertText({
      kind: "description",
      alert_for: form.alert_for,
      alert_value: form.alert_value,
      failure_threshold: Number(form.failure_threshold),
      success_threshold: Number(form.success_threshold)
    })
  );

  // Handlers
  function handleAlertForChange(newValue: AlertForType) {
    form.alert_for = newValue;
    if (newValue === GC.STATUS) {
      form.alert_value = GC.DOWN;
    } else if (newValue === GC.LATENCY) {
      form.alert_value = "1000";
    } else if (newValue === GC.UPTIME) {
      form.alert_value = "99";
    }
  }

  function toggleMonitor(monitorTag: string) {
    if (form.monitor_tags.includes(monitorTag)) {
      form.monitor_tags = form.monitor_tags.filter((tag) => tag !== monitorTag);
    } else {
      form.monitor_tags = [...form.monitor_tags, monitorTag];
    }
  }

  function toggleTrigger(triggerId: number) {
    if (form.trigger_ids.includes(triggerId)) {
      form.trigger_ids = form.trigger_ids.filter((id) => id !== triggerId);
    } else {
      form.trigger_ids = [...form.trigger_ids, triggerId];
    }
  }

  // API calls
  async function loadTriggers() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTriggers",
          data: { status: GC.ACTIVE }
        })
      });
      triggers = await response.json();
    } catch (error) {
      console.error("Failed to load triggers", error);
    }
  }

  async function loadMonitors() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getMonitors",
          data: {}
        })
      });
      const result = await response.json();
      if (!result.error && Array.isArray(result)) {
        monitors = result.map((m: { tag: string; name: string }) => ({ tag: m.tag, name: m.name }));
      }
    } catch (error) {
      console.error("Failed to load monitors", error);
    }
  }

  async function loadAlertConfig() {
    if (isNew) return;

    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getMonitorAlertConfigById",
          data: { id: parseInt(alertConfigId) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
        goto(clientResolver(resolve, "/manage/app/alerts"));
      } else {
        const config = result as MonitorAlertConfigWithTriggers;
        form = {
          monitor_tags: config.monitor_tags || [],
          alert_for: config.alert_for,
          alert_value: config.alert_value,
          failure_threshold: config.failure_threshold,
          success_threshold: config.success_threshold,
          alert_description: config.alert_description || "",
          create_incident: config.create_incident,
          is_active: config.is_active,
          severity: config.severity,
          trigger_ids: config.triggers.map((t) => t.id)
        };
      }
    } catch (error) {
      console.error("Failed to load alert config", error);
      toast.error("加载告警配置失败");
      goto(clientResolver(resolve, "/manage/app/alerts"));
    }
  }

  async function saveAlertConfig() {
    if (form.monitor_tags.length === 0) {
      toast.error("请至少选择一个监控器");
      return;
    }

    saving = true;
    try {
      const action = isNew ? "createMonitorAlertConfig" : "updateMonitorAlertConfig";
      const data: Record<string, unknown> = {
        monitor_tags: form.monitor_tags,
        alert_for: form.alert_for,
        alert_value: form.alert_value,
        failure_threshold: form.failure_threshold,
        success_threshold: form.success_threshold,
        alert_description: form.alert_description || null,
        create_incident: form.create_incident,
        severity: form.severity,
        trigger_ids: form.trigger_ids
      };

      if (!isNew) {
        data.id = parseInt(alertConfigId);
        data.is_active = form.is_active;
      }

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isNew ? "告警创建成功" : "告警更新成功");
        if (isNew) {
          goto(clientResolver(resolve, `/manage/app/alerts/${result.id}`));
        }
      }
    } catch (error) {
      toast.error("保存告警失败");
    } finally {
      saving = false;
    }
  }

  async function deleteAlertConfig() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteMonitorAlertConfig",
          data: { id: parseInt(alertConfigId) }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("告警删除成功");
        goto(clientResolver(resolve, "/manage/app/alerts"));
      }
    } catch (error) {
      toast.error("删除告警失败");
    } finally {
      deleteDialogOpen = false;
    }
  }

  onMount(async () => {
    loading = true;
    await Promise.all([loadTriggers(), loadMonitors(), loadAlertConfig()]);
    loading = false;
  });
</script>

<div class="container mx-auto space-y-6 py-6">
  <!-- Breadcrumb -->
  <Breadcrumb.Root>
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link href={clientResolver(resolve, "/manage/app/alerts")}>告警</Breadcrumb.Link>
      </Breadcrumb.Item>
      <Breadcrumb.Separator />
      <Breadcrumb.Item>
        <Breadcrumb.Page>{isNew ? "新建告警" : `编辑告警 #${alertConfigId}`}</Breadcrumb.Page>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>

  {#if loading}
    <div class="flex flex-col items-center gap-4 py-16">
      <Spinner class="size-8" />
      <p class="text-muted-foreground">加载中...</p>
    </div>
  {:else}
    <Card.Root>
      <Card.Content class="space-y-6 pt-6">
        <!-- Monitor Selection (Searchable Multi-select) -->
        <div class="flex flex-col gap-2">
          <Label>监控器</Label>
          <p class="text-muted-foreground text-xs">选择此告警适用的监控器</p>
          <Popover.Root bind:open={monitorPopoverOpen}>
            <Popover.Trigger>
              <Button variant="outline" role="combobox" class="w-full justify-between font-normal">
                {#if form.monitor_tags.length === 0}
                  选择监控器...
                {:else if form.monitor_tags.length === 1}
                  {monitors.find((m) => m.tag === form.monitor_tags[0])?.name || form.monitor_tags[0]}
                {:else}
                  已选择 {form.monitor_tags.length} 个监控器
                {/if}
                <ChevronsUpDownIcon class="text-muted-foreground size-4 shrink-0" />
              </Button>
            </Popover.Trigger>
            <Popover.Content class="w-[var(--bits-popover-trigger-width)] p-0" align="start">
              <Command.Root>
                <Command.Input placeholder="搜索监控器..." />
                <Command.List>
                  <Command.Empty>未找到监控器。</Command.Empty>
                  <Command.Group>
                    {#each monitors as monitor (monitor.tag)}
                      <Command.Item value={monitor.name} onSelect={() => toggleMonitor(monitor.tag)}>
                        <CheckIcon
                          class="size-4 {form.monitor_tags.includes(monitor.tag) ? 'opacity-100' : 'opacity-0'}"
                        />
                        {monitor.name}
                      </Command.Item>
                    {/each}
                  </Command.Group>
                </Command.List>
              </Command.Root>
            </Popover.Content>
          </Popover.Root>
          {#if form.monitor_tags.length > 0}
            <div class="flex flex-wrap gap-1.5">
              {#each form.monitor_tags as tag (tag)}
                <Badge variant="secondary" class="gap-1 pr-1">
                  {monitors.find((m) => m.tag === tag)?.name || tag}
                  <button type="button" class="hover:bg-muted rounded-sm p-0.5" onclick={() => toggleMonitor(tag)}>
                    <XIcon class="size-3" />
                  </button>
                </Badge>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Alert For -->
        <div class="flex flex-col gap-2">
          <Label for="alert-for">告警类型</Label>
          <Select.Root
            type="single"
            value={form.alert_for}
            onValueChange={(v) => v && handleAlertForChange(v as AlertForType)}
          >
            <Select.Trigger id="alert-for" class="w-full">
              {alertForOptions.find((o) => o.value === form.alert_for)?.label || "选择类型"}
            </Select.Trigger>
            <Select.Content>
              {#each alertForOptions as option}
                <Select.Item value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Alert Value -->
        <div class="flex flex-col gap-2">
          <Label for="alert-value">{alertValueLabel}</Label>
          {#if form.alert_for === "STATUS"}
            <Select.Root type="single" value={form.alert_value} onValueChange={(v) => v && (form.alert_value = v)}>
              <Select.Trigger id="alert-value" class="w-full">
                {statusValueOptions.find((o) => o.value === form.alert_value)?.label || form.alert_value}
              </Select.Trigger>
              <Select.Content>
                {#each statusValueOptions as option}
                  <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {:else}
            <Input
              id="alert-value"
              type="number"
              min={form.alert_for === GC.UPTIME ? "0" : "1"}
              max={form.alert_for === GC.UPTIME ? "100" : undefined}
              bind:value={form.alert_value}
            />
          {/if}
          <p class="text-muted-foreground text-xs">{alertValueHelp}</p>
        </div>

        <!-- Thresholds -->
        <div class="grid grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <Label for="failure-threshold">失败阈值</Label>
            <Input id="failure-threshold" type="number" min="1" bind:value={form.failure_threshold} />
            <p class="text-muted-foreground text-xs">触发告警前允许的连续失败次数</p>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="success-threshold">恢复阈值</Label>
            <Input id="success-threshold" type="number" min="1" bind:value={form.success_threshold} />
            <p class="text-muted-foreground text-xs">解除告警所需的连续成功次数</p>
          </div>
        </div>

        <!-- Generated Alert Text -->
        <div class="flex flex-col gap-2">
          <Label>详细信息</Label>
          <p class="text-muted-foreground bg-muted/40 rounded-md border p-3 text-sm">{alertDescriptionText}</p>
        </div>

        <!-- Severity -->
        <div class="flex flex-col gap-2">
          <Label for="severity">严重程度</Label>
          <Select.Root
            type="single"
            value={form.severity}
            onValueChange={(v) => v && (form.severity = v as AlertSeverityType)}
          >
            <Select.Trigger id="severity" class="w-full">
              {severityOptions.find((o) => o.value === form.severity)?.label || "选择严重程度"}
            </Select.Trigger>
            <Select.Content>
              {#each severityOptions as option}
                <Select.Item value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Create Incident -->
        <div class="flex flex-col gap-2">
          <Label for="create-incident">创建事件</Label>
          <Select.Root
            type="single"
            value={form.create_incident}
            onValueChange={(v) => v && (form.create_incident = v as YesNoType)}
          >
            <Select.Trigger id="create-incident" class="w-full">
              {yesNoOptions.find((o) => o.value === form.create_incident)?.label || form.create_incident}
            </Select.Trigger>
            <Select.Content>
              {#each yesNoOptions as option}
                <Select.Item value={option.value}>{option.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
          <p class="text-muted-foreground text-xs">此告警触发时自动创建事件</p>
        </div>

        <!-- Is Active (only when editing) -->
        {#if !isNew}
          <div class="flex items-center justify-between">
            <div>
              <Label>启用</Label>
              <p class="text-muted-foreground text-xs">启用或停用此告警</p>
            </div>
            <Switch
              checked={form.is_active === GC.YES}
              onCheckedChange={(checked) => (form.is_active = checked ? GC.YES : GC.NO)}
            />
          </div>
        {/if}

        <!-- Description -->
        <div class="flex flex-col gap-2">
          <Label for="alert-description">描述（可选）</Label>
          <Textarea
            id="alert-description"
            placeholder="添加此告警的描述..."
            bind:value={form.alert_description}
            rows={2}
          />
        </div>

        <!-- Triggers -->
        {#if triggers.length > 0}
          <div class="flex flex-col gap-2">
            <Label>通知触发器</Label>
            <p class="text-muted-foreground text-xs">选择此告警触发时要通知的触发器</p>
            <div class="mt-2 grid gap-2">
              {#each triggers as trigger (trigger.id)}
                <label
                  class="bg-muted/30 hover:bg-muted/50 flex cursor-pointer items-center gap-3 rounded-md border p-3"
                >
                  <Checkbox
                    checked={form.trigger_ids.includes(trigger.id)}
                    onCheckedChange={() => toggleTrigger(trigger.id)}
                  />
                  <div class="flex-1">
                    <p class="text-sm font-medium">{trigger.name}</p>
                    {#if trigger.trigger_desc}
                      <p class="text-muted-foreground text-xs">{trigger.trigger_desc}</p>
                    {/if}
                  </div>
                  <Badge variant="outline" class="text-xs capitalize">{trigger.trigger_type}</Badge>
                </label>
              {/each}
            </div>
          </div>
        {:else}
          <p class="text-muted-foreground text-sm">
            暂无可用的通知触发器。<a
              href={clientResolver(resolve, "/manage/app/triggers")}
              class="text-primary underline">创建触发器</a
            > 以接收通知。
          </p>
        {/if}
      </Card.Content>

      <Card.Footer class="flex justify-between">
        <Button variant="outline" onclick={() => goto(clientResolver(resolve, "/manage/app/alerts"))}>取消</Button>
        <Button onclick={saveAlertConfig} disabled={saving}>
          {#if saving}
            <Spinner class="size-4" />
          {/if}
          {isNew ? "创建告警" : "保存更改"}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Danger Zone (only when editing) -->
    {#if !isNew}
      <Card.Root class="border-destructive">
        <Card.Header>
          <Card.Title class="text-destructive">危险操作</Card.Title>
          <Card.Description>此告警配置的不可逆操作。</Card.Description>
        </Card.Header>
        <Card.Content>
          <Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
            <TrashIcon class="size-4" />
            删除告警
          </Button>
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>删除告警</AlertDialog.Title>
      <AlertDialog.Description>确定要删除此告警吗？此操作无法撤销。</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>取消</AlertDialog.Cancel>
      <AlertDialog.Action onclick={deleteAlertConfig}>删除</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
