<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
  import CalendarIcon from "@lucide/svelte/icons/calendar";
  import RepeatIcon from "@lucide/svelte/icons/repeat";
  import InfoIcon from "@lucide/svelte/icons/info";
  import ClockIcon from "@lucide/svelte/icons/clock";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import PlayCircleIcon from "@lucide/svelte/icons/play-circle";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import type { PageProps } from "./$types";
  import type { MonitorRecord } from "$lib/server/types/db.js";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import { format, formatDistanceToNow, isPast, isFuture, isWithinInterval, addDays } from "date-fns";
  import { zhCN } from "date-fns/locale";
  import { rrulestr } from "rrule";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";

  let { params }: PageProps = $props();
  const isNew = $derived(params.id === "new");

  // Types
  interface MaintenanceEvent {
    id: number;
    maintenance_id: number;
    start_date_time: number;
    end_date_time: number;
    status: string;
  }

  // Form state
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Schedule type for UI switching
  type ScheduleType = "ONE_TIME" | "RECURRING";
  let scheduleType = $state<ScheduleType>("ONE_TIME");

  // Maintenance data
  let maintenance = $state<{
    id: number;
    title: string;
    description: string;
    start_date_time: number;
    rrule: string;
    duration_seconds: number;
    status: "ACTIVE" | "INACTIVE";
    is_global: string;
  }>({
    id: 0,
    title: "",
    description: "",
    start_date_time: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    rrule: "FREQ=MINUTELY;COUNT=1",
    duration_seconds: 3600, // 1 hour default
    status: "ACTIVE",
    is_global: "YES"
  });

  // For datetime input
  let startDateTimeLocal = $state("");

  // Duration inputs (for easier UI)
  let durationHours = $state(1);
  let durationMinutes = $state(0);

  // Custom RRULE input for recurring
  let customRrule = $state("FREQ=WEEKLY;BYDAY=SU");

  // Sample RRULE patterns
  const sampleRrules = [
    { label: "每周日", value: "FREQ=WEEKLY;BYDAY=SU" },
    { label: "每天", value: "FREQ=DAILY" },
    { label: "工作日", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
    { label: "每周一", value: "FREQ=WEEKLY;BYDAY=MO" },
    { label: "每两周的周一", value: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" },
    { label: "每月第一天", value: "FREQ=MONTHLY;BYMONTHDAY=1" }
  ];

  // Monitor selection
  type MonitorStatus = "UP" | "DOWN" | "DEGRADED" | "MAINTENANCE";
  interface SelectedMonitor {
    tag: string;
    status: MonitorStatus;
  }
  let availableMonitors = $state<MonitorRecord[]>([]);
  let selectedMonitors = $state<SelectedMonitor[]>([]);
  const monitorStatusLabels: Record<MonitorStatus, string> = {
    UP: "正常",
    DOWN: "中断",
    DEGRADED: "性能下降",
    MAINTENANCE: "维护中"
  };

  // Derived for backward compatibility
  const selectedMonitorTags = $derived(selectedMonitors.map((m) => m.tag));

  // Events for existing maintenance
  let events = $state<MaintenanceEvent[]>([]);
  let loadingEvents = $state(false);

  // Event status confirmation dialog
  type EventActionStatus = "COMPLETED" | "CANCELLED";
  let eventStatusDialogOpen = $state(false);
  let updatingEventStatus = $state(false);
  let pendingEventStatusUpdate = $state<{ eventId: number; status: EventActionStatus } | null>(null);

  function openEventStatusDialog(eventId: number, status: EventActionStatus) {
    pendingEventStatusUpdate = { eventId, status };
    eventStatusDialogOpen = true;
  }

  function closeEventStatusDialog() {
    eventStatusDialogOpen = false;
    pendingEventStatusUpdate = null;
  }

  const eventStatusDialogCopy = $derived.by(() => {
    if (pendingEventStatusUpdate?.status === "COMPLETED") {
      return {
        title: "完成维护事件",
        description: "这会将事件标记为已完成，并将结束时间设为当前时间。",
        confirmLabel: "完成事件",
        cancelLabel: "保持进行中",
        confirmVariant: "default" as const
      };
    }

    return {
      title: "取消维护事件",
      description: "这会将事件标记为已取消，并从有效计划中移除。",
      confirmLabel: "取消事件",
      cancelLabel: "保留计划",
      confirmVariant: "destructive" as const
    };
  });

  // Convert timestamp to local datetime string for input
  function timestampToLocalDatetime(ts: number): string {
    const date = new Date(ts * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Convert local datetime string to timestamp
  function localDatetimeToTimestamp(datetime: string): number {
    if (!datetime) return Math.floor(Date.now() / 1000);
    const date = new Date(datetime);
    return Math.floor(date.getTime() / 1000);
  }

  // Get the RRULE to use
  function getRrule(): string {
    if (scheduleType === "ONE_TIME") {
      return "FREQ=MINUTELY;COUNT=1";
    }
    return customRrule;
  }

  // Parse RRULE string for UI
  function parseRrule(rrule: string) {
    if (rrule.includes("COUNT=1")) {
      scheduleType = "ONE_TIME";
    } else {
      scheduleType = "RECURRING";
      customRrule = rrule;
    }
  }

  // Generate preview dates based on RRULE and start time
  function getPreviewDates(): string[] {
    if (scheduleType === "ONE_TIME" || !startDateTimeLocal || !customRrule.trim()) {
      return [];
    }

    try {
      const dtstart = new Date(startDateTimeLocal);
      const fullRrule = `DTSTART:${dtstart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${customRrule}`;
      const rule = rrulestr(fullRrule);
      const now = new Date();
      const windowEnd = addDays(now, 30);
      const occurrences = rule.between(now, windowEnd, true).slice(0, 5);
      return occurrences.map((d) => format(d, "yyyy-MM-dd HH:mm"));
    } catch (e) {
      return [];
    }
  }

  // Validate RRULE format
  function validateRrule(): string | null {
    if (scheduleType === "ONE_TIME" || !customRrule.trim()) {
      return null;
    }

    try {
      const dtstart = new Date();
      const fullRrule = `DTSTART:${dtstart.toISOString().replace(/[-:]/g, "").split(".")[0]}Z\nRRULE:${customRrule}`;
      rrulestr(fullRrule);
      return null;
    } catch (e) {
      return "RRULE 格式无效";
    }
  }

  // Reactive preview dates
  const previewDates = $derived.by(() => getPreviewDates());

  // Reactive RRULE error
  const rruleError = $derived.by(() => validateRrule());

  // Calculate duration_seconds from hours and minutes
  const calculatedDurationSeconds = $derived(durationHours * 3600 + durationMinutes * 60);

  // Update duration inputs when duration_seconds changes
  function updateDurationInputs(seconds: number) {
    durationHours = Math.floor(seconds / 3600);
    durationMinutes = Math.floor((seconds % 3600) / 60);
  }

  // Validation
  const isValid = $derived.by(() => {
    if (!maintenance.title.trim()) return false;
    if (!startDateTimeLocal) return false;
    if (calculatedDurationSeconds <= 0) return false;
    if (scheduleType === "RECURRING" && (!customRrule.trim() || rruleError)) return false;
    return true;
  });

  // Fetch maintenance data
  async function fetchMaintenance() {
    if (isNew) {
      // Set default start time (1 hour from now)
      startDateTimeLocal = timestampToLocalDatetime(Math.floor(Date.now() / 1000) + 3600);
      loading = false;
      return;
    }

    loading = true;
    error = null;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMaintenance", data: { id: parseInt(params.id) } })
      });
      const result = await response.json();
      if (result.error) {
        error = result.error;
      } else if (result) {
        maintenance = {
          id: result.id,
          title: result.title,
          description: result.description || "",
          start_date_time: result.start_date_time,
          rrule: result.rrule,
          duration_seconds: result.duration_seconds,
          status: result.status,
          is_global: result.is_global || "YES"
        };

        // Parse RRULE for UI
        parseRrule(result.rrule);

        // Set UI values
        startDateTimeLocal = timestampToLocalDatetime(result.start_date_time);
        updateDurationInputs(result.duration_seconds);

        // Set monitors with their statuses
        if (result.monitors) {
          selectedMonitors = result.monitors.map((m: { monitor_tag: string; monitor_impact: MonitorStatus }) => ({
            tag: m.monitor_tag,
            status: m.monitor_impact || "MAINTENANCE"
          }));
        }

        events = result.events || [];
      } else {
        error = "未找到维护计划";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "获取维护计划失败";
    } finally {
      loading = false;
    }
  }

  // Fetch events
  async function fetchEvents() {
    loadingEvents = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMaintenanceEvents", data: { maintenance_id: parseInt(params.id) } })
      });
      const result = await response.json();
      if (!result.error) {
        events = result;
      }
    } catch {
      // Ignore errors
    } finally {
      loadingEvents = false;
    }
  }

  // Fetch available monitors
  async function fetchAvailableMonitors() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMonitors", data: { status: "ACTIVE" } })
      });
      const result = await response.json();
      if (!result.error) {
        availableMonitors = result;
      }
    } catch {
      // Ignore errors
    }
  }

  // Save maintenance
  async function saveMaintenance() {
    if (!isValid) return;
    saving = true;
    error = null;

    try {
      const rrule = getRrule();
      const startTime = localDatetimeToTimestamp(startDateTimeLocal);

      if (isNew) {
        const createData = {
          title: maintenance.title,
          description: maintenance.description || null,
          start_date_time: startTime,
          rrule,
          duration_seconds: calculatedDurationSeconds,
          monitors: selectedMonitors.map((m) => ({ monitor_tag: m.tag, monitor_impact: m.status })),
          is_global: maintenance.is_global
        };

        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "createMaintenance", data: createData })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("维护计划创建成功");
          goto(clientResolver(resolve, `/manage/app/maintenances/${result.maintenance_id}`));
        }
      } else {
        const updateData = {
          id: maintenance.id,
          title: maintenance.title,
          description: maintenance.description || null,
          start_date_time: startTime,
          rrule,
          duration_seconds: calculatedDurationSeconds,
          status: maintenance.status,
          monitors: selectedMonitors.map((m) => ({ monitor_tag: m.tag, monitor_impact: m.status })),
          is_global: maintenance.is_global
        };

        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "updateMaintenance", data: updateData })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("维护计划更新成功");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      saving = false;
    }
  }

  // Delete maintenance
  async function deleteMaintenance() {
    if (!confirm("确定要删除此维护计划吗？所有事件也将被删除。")) return;

    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteMaintenance", data: { id: maintenance.id } })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("维护计划已删除");
        goto(clientResolver(resolve, "/manage/app/maintenances"));
      }
    } catch {
      toast.error("删除维护计划失败");
    }
  }

  // Delete event
  async function deleteEvent(eventId: number) {
    if (!confirm("确定要删除此事件吗？")) return;

    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteMaintenanceEvent", data: { id: eventId } })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("事件已删除");
        await fetchEvents();
      }
    } catch {
      toast.error("删除事件失败");
    }
  }

  // Manually transition an event to COMPLETED or CANCELLED
  async function updateEventStatus(eventId: number, status: "COMPLETED" | "CANCELLED") {
    updatingEventStatus = true;

    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "updateMaintenanceEventStatus", data: { id: eventId, status } })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(status === "COMPLETED" ? "事件已完成" : "事件已取消");
        await fetchEvents();
        closeEventStatusDialog();
      }
    } catch {
      toast.error("更新事件状态失败");
    } finally {
      updatingEventStatus = false;
    }
  }

  async function confirmEventStatusUpdate() {
    if (!pendingEventStatusUpdate) return;
    await updateEventStatus(pendingEventStatusUpdate.eventId, pendingEventStatusUpdate.status);
  }

  // Compute event display status based on current time
  interface EventDisplayStatus {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: "clock" | "play" | "check" | "x";
  }

  function getEventDisplayStatus(event: MaintenanceEvent): EventDisplayStatus {
    // Terminal statuses no longer follow time — the stored status wins
    if (event.status === "CANCELLED") {
      return {
        label: "已取消",
        variant: "destructive",
        icon: "x"
      };
    }
    if (event.status === "COMPLETED") {
      return {
        label: "已完成",
        variant: "secondary",
        icon: "check"
      };
    }

    const now = new Date();
    const startDate = new Date(event.start_date_time * 1000);
    const endDate = new Date(event.end_date_time * 1000);

    // Check if currently ongoing
    if (isWithinInterval(now, { start: startDate, end: endDate })) {
      return {
        label: "进行中",
        variant: "default",
        icon: "play"
      };
    }

    // Check if in the future (upcoming)
    if (isFuture(startDate)) {
      const distance = formatDistanceToNow(startDate, { addSuffix: false, locale: zhCN });
      return {
        label: `即将开始：${distance}后`,
        variant: "outline",
        icon: "clock"
      };
    }

    // If in the past (completed)
    if (isPast(endDate)) {
      return {
        label: "已完成",
        variant: "secondary",
        icon: "check"
      };
    }

    // Fallback
    return {
      label: "已计划",
      variant: "outline",
      icon: "clock"
    };
  }

  // Toggle monitor selection
  function toggleMonitor(tag: string) {
    const existing = selectedMonitors.find((m) => m.tag === tag);
    if (existing) {
      selectedMonitors = selectedMonitors.filter((m) => m.tag !== tag);
    } else {
      selectedMonitors = [...selectedMonitors, { tag, status: "MAINTENANCE" }];
    }
  }

  // Update monitor status locally
  function updateMonitorStatus(tag: string, status: MonitorStatus) {
    selectedMonitors = selectedMonitors.map((m) => (m.tag === tag ? { ...m, status } : m));
  }

  // Get monitor name by tag
  function getMonitorName(tag: string): string {
    const monitor = availableMonitors.find((m) => m.tag === tag);
    return monitor?.name || tag;
  }

  onMount(() => {
    fetchMaintenance();
    fetchAvailableMonitors();
  });
</script>

<div class="container space-y-6 py-6">
  <div class="flex justify-between gap-2">
    <!-- Breadcrumb -->
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href={clientResolver(resolve, "/manage/app/maintenances")}>维护计划</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>{isNew ? "新建维护" : `编辑 #${params.id}`}</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
    <div>
      {#if !isNew}
        <Button
          variant="outline"
          target="_blank"
          size="sm"
          class="mr-2"
          href={clientResolver(resolve, `/maintenances/${maintenance.id}?type=maintenance`)}
        >
          查看
        </Button>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="size-8" />
    </div>
  {:else if error}
    <Card.Root class="border-destructive">
      <Card.Content class="pt-6">
        <div class="flex items-center gap-2">
          <AlertTriangleIcon class="text-destructive size-5" />
          <p class="text-destructive">{error}</p>
        </div>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- Main Details Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>{isNew ? "创建新维护" : "维护详情"}</Card.Title>
        <Card.Description>
          {#if isNew}
            使用 iCalendar RRULE 格式安排新的维护时段
          {:else}
            编辑维护详情
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Schedule Type Selection -->
        <div class="flex flex-col gap-3">
          <Label>计划类型 <span class="text-destructive">*</span></Label>
          <RadioGroup.Root bind:value={scheduleType} class="flex gap-6">
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="ONE_TIME" id="type-onetime" />
              <Label for="type-onetime" class="flex cursor-pointer items-center gap-2 font-normal">
                <CalendarIcon class="size-4" />
                单次
              </Label>
            </div>
            <div class="flex items-center gap-2">
              <RadioGroup.Item value="RECURRING" id="type-recurring" />
              <Label for="type-recurring" class="flex cursor-pointer items-center gap-2 font-normal">
                <RepeatIcon class="size-4" />
                重复
              </Label>
            </div>
          </RadioGroup.Root>
        </div>

        <!-- Title -->
        <div class="flex flex-col gap-2">
          <Label for="title">标题 <span class="text-destructive">*</span></Label>
          <Input id="title" bind:value={maintenance.title} placeholder="计划维护时段" />
        </div>

        <!-- Description -->
        <div class="flex flex-col gap-2">
          <Label for="description">描述</Label>
          <Textarea id="description" bind:value={maintenance.description} placeholder="维护详情..." rows={3} />
        </div>

        <!-- Global Visibility -->
        <div class="flex items-center justify-between rounded-md border p-3">
          <div class="flex flex-col gap-1">
            <Label for="is-global">全局维护</Label>
            <p class="text-muted-foreground text-xs">启用后，此维护计划将在所有状态页上显示</p>
          </div>
          <Switch
            id="is-global"
            checked={maintenance.is_global === "YES"}
            onCheckedChange={(checked) => {
              maintenance.is_global = checked ? "YES" : "NO";
            }}
          />
        </div>

        <!-- Start Date/Time -->
        <div class="flex flex-col gap-2">
          <Label for="start-time">
            {scheduleType === "ONE_TIME" ? "开始日期/时间" : "首次发生日期/时间"}
            <span class="text-destructive">*</span>
          </Label>
          <Input id="start-time" type="datetime-local" bind:value={startDateTimeLocal} />
          {#if scheduleType === "RECURRING"}
            <p class="text-muted-foreground text-xs">重复维护将在每天的相同时间发生，日期规则在下方配置。</p>
          {/if}
        </div>

        <!-- Duration -->
        <div class="flex flex-col gap-2">
          <Label>持续时间 <span class="text-destructive">*</span></Label>
          <div class="flex items-center gap-2">
            <div class="flex items-center gap-1">
              <Input type="number" min={0} max={72} class="w-20" bind:value={durationHours} />
              <span class="text-muted-foreground text-sm">小时</span>
            </div>
            <div class="flex items-center gap-1">
              <Input type="number" min={0} max={59} class="w-20" bind:value={durationMinutes} />
              <span class="text-muted-foreground text-sm">分钟</span>
            </div>
          </div>
          <p class="text-muted-foreground text-xs">
            总计：{calculatedDurationSeconds} 秒（{Math.floor(calculatedDurationSeconds / 60)} 分钟）
          </p>
        </div>

        <!-- RRULE Configuration -->
        <Card.Root class="bg-muted/50">
          <Card.Header class="pb-3">
            <Card.Title class="flex items-center gap-2 text-base">
              <InfoIcon class="size-4" />
              {scheduleType === "ONE_TIME" ? "计划规则" : "重复规则（RRULE）"}
            </Card.Title>
          </Card.Header>
          <Card.Content class="space-y-4">
            {#if scheduleType === "ONE_TIME"}
              <!-- One-time: Show readonly RRULE -->
              <div class="flex flex-col gap-2">
                <Label class="text-muted-foreground text-xs">iCalendar RRULE（自动生成）</Label>
                <Input value="FREQ=MINUTELY;COUNT=1" disabled class="bg-muted font-mono text-sm" />
                <p class="text-muted-foreground text-xs">单次维护使用只触发一次的固定 RRULE。</p>
              </div>
            {:else}
              <!-- Recurring: Editable RRULE -->
              <div class="flex flex-col gap-2">
                <Label for="rrule">iCalendar RRULE <span class="text-destructive">*</span></Label>
                <Input
                  id="rrule"
                  bind:value={customRrule}
                  placeholder="FREQ=WEEKLY;BYDAY=SU"
                  class={rruleError ? "border-destructive" : ""}
                />
                {#if rruleError}
                  <p class="text-destructive text-xs">{rruleError}</p>
                {/if}
              </div>

              <!-- Sample Patterns -->
              {#if isNew}
                <div class="flex flex-col gap-2">
                  <Label class="text-muted-foreground text-xs">快捷规则：</Label>
                  <div class="flex flex-wrap gap-2">
                    {#each sampleRrules as sample (sample.value)}
                      <Button
                        variant={customRrule === sample.value ? "default" : "outline"}
                        size="sm"
                        onclick={() => (customRrule = sample.value)}
                      >
                        {sample.label}
                      </Button>
                    {/each}
                  </div>
                </div>
              {/if}

              <!-- Preview Dates -->
              {#if previewDates.length > 0}
                <div class="bg-background rounded-md border p-3">
                  <Label class="text-muted-foreground text-xs">即将发生：</Label>
                  <ul class="mt-2 space-y-1 text-sm">
                    {#each previewDates as date (date)}
                      <li class="flex items-center gap-2">
                        <CalendarIcon class="text-muted-foreground size-3" />
                        {date}
                      </li>
                    {/each}
                  </ul>
                </div>
              {/if}
            {/if}
          </Card.Content>
        </Card.Root>

        <!-- Monitor Selection -->
        <div class="flex flex-col gap-3">
          <Label>受影响的监控器</Label>

          <!-- Available monitors to add -->
          <div class="rounded-md border p-3">
            <Label class="text-muted-foreground mb-2 block text-xs">选择要添加的监控器：</Label>
            <div class="grid max-h-32 grid-cols-2 gap-2 overflow-y-auto">
              {#each availableMonitors as monitor (monitor.tag)}
                <div class="flex items-center gap-2">
                  <Checkbox
                    id="monitor-{monitor.tag}"
                    checked={selectedMonitorTags.includes(monitor.tag)}
                    onCheckedChange={() => toggleMonitor(monitor.tag)}
                  />
                  <Label for="monitor-{monitor.tag}" class="cursor-pointer text-sm font-normal">
                    {monitor.name}
                  </Label>
                </div>
              {/each}
              {#if availableMonitors.length === 0}
                <p class="text-muted-foreground col-span-2 text-sm">暂无可用监控器</p>
              {/if}
            </div>
          </div>

          <!-- Selected monitors with status -->
          {#if selectedMonitors.length > 0}
            <div class="rounded-md border p-3">
              <Label class="text-muted-foreground mb-2 block text-xs">维护期间的监控器状态：</Label>
              <div class="space-y-2">
                {#each selectedMonitors as selectedMonitor, index (selectedMonitor.tag)}
                  {@const currentStatus = selectedMonitor.status}
                  <div class="bg-muted/30 flex items-center justify-between gap-3 rounded border p-2">
                    <span class="text-sm font-medium">{getMonitorName(selectedMonitor.tag)}</span>
                    <Select.Root
                      type="single"
                      value={currentStatus}
                      onValueChange={(value) => {
                        if (value) {
                          selectedMonitors[index].status = value as MonitorStatus;
                          selectedMonitors = [...selectedMonitors];
                        }
                      }}
                    >
                      <Select.Trigger class="h-8 w-36 text-xs">
                        {monitorStatusLabels[currentStatus]}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="UP">正常</Select.Item>
                        <Select.Item value="DOWN">中断</Select.Item>
                        <Select.Item value="DEGRADED">性能下降</Select.Item>
                        <Select.Item value="MAINTENANCE">维护中</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
          <p class="text-muted-foreground text-xs">选择监控器并设置其在维护时段内的状态</p>
        </div>

        <!-- Status Toggle (only for existing) -->
        {#if !isNew}
          <div class="flex flex-col gap-2">
            <Label>状态</Label>
            <div class="flex gap-2">
              <Button
                variant={maintenance.status === "ACTIVE" ? "default" : "outline"}
                size="sm"
                onclick={() => (maintenance.status = "ACTIVE")}
              >
                启用
              </Button>
              <Button
                variant={maintenance.status === "INACTIVE" ? "default" : "outline"}
                size="sm"
                onclick={() => (maintenance.status = "INACTIVE")}
              >
                停用
              </Button>
            </div>
          </div>
        {/if}
      </Card.Content>
      <Card.Footer class="flex justify-end gap-2">
        {#if !isNew}
          <Button variant="destructive" onclick={deleteMaintenance}>
            <TrashIcon class="size-4" />
            删除
          </Button>
        {/if}
        <Button onclick={saveMaintenance} disabled={saving || !isValid}>
          {#if saving}
            <Loader class="size-4 animate-spin" />
          {:else}
            <SaveIcon class="size-4" />
          {/if}
          {isNew ? "创建维护" : "保存更改"}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Events Section (only for existing) -->
    {#if !isNew}
      <Card.Root>
        <Card.Header>
          <div>
            <Card.Title>维护事件</Card.Title>
            <Card.Description>预先生成未来 7 天的维护时段</Card.Description>
          </div>
        </Card.Header>
        <Card.Content>
          {#if loadingEvents}
            <div class="flex justify-center py-4">
              <Spinner class="size-6" />
            </div>
          {:else if events.length === 0}
            <p class="text-muted-foreground py-4 text-center text-sm">
              暂无计划事件。创建或更新维护计划时会自动生成事件。
            </p>
          {:else}
            <div class="space-y-3">
              {#each events as event (event.id)}
                {@const displayStatus = getEventDisplayStatus(event)}
                <div class="flex items-center justify-between rounded-md border p-4">
                  <div class="flex items-center gap-3">
                    <div class="bg-muted flex size-8 items-center justify-center rounded-full">
                      {#if displayStatus.icon === "play"}
                        <PlayCircleIcon class="text-primary size-4" />
                      {:else if displayStatus.icon === "check"}
                        <CheckCircleIcon class="text-muted-foreground size-4" />
                      {:else if displayStatus.icon === "x"}
                        <XCircleIcon class="text-muted-foreground size-4" />
                      {:else}
                        <ClockIcon class="text-muted-foreground size-4" />
                      {/if}
                    </div>
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <Badge variant={displayStatus.variant}>{displayStatus.label}</Badge>
                      </div>
                      <p class="text-muted-foreground text-sm">
                        {format(new Date(event.start_date_time * 1000), "yyyy-MM-dd HH:mm")}
                        →
                        {format(new Date(event.end_date_time * 1000), "yyyy-MM-dd HH:mm")}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if event.status === "ONGOING"}
                      <Button variant="outline" size="sm" onclick={() => openEventStatusDialog(event.id, "COMPLETED")}>
                        <CheckCircleIcon class="size-4" />
                        完成
                      </Button>
                    {/if}
                    {#if event.status === "SCHEDULED" || event.status === "READY" || event.status === "ONGOING"}
                      <Button variant="outline" size="sm" onclick={() => openEventStatusDialog(event.id, "CANCELLED")}>
                        <XCircleIcon class="size-4" />
                        取消
                      </Button>
                    {/if}
                    <Button variant="ghost" size="icon" onclick={() => deleteEvent(event.id)}>
                      <TrashIcon class="size-4" />
                    </Button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>

<Dialog.Root bind:open={eventStatusDialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>{eventStatusDialogCopy.title}</Dialog.Title>
      <Dialog.Description>{eventStatusDialogCopy.description}</Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant="outline" onclick={closeEventStatusDialog} disabled={updatingEventStatus}>
        {eventStatusDialogCopy.cancelLabel}
      </Button>
      <Button
        variant={eventStatusDialogCopy.confirmVariant}
        onclick={confirmEventStatusUpdate}
        disabled={updatingEventStatus || !pendingEventStatusUpdate}
      >
        {#if updatingEventStatus}
          <Loader class="size-4 animate-spin" />
        {/if}
        {eventStatusDialogCopy.confirmLabel}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
