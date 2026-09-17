<script lang="ts">
  import { Label } from "$lib/components/ui/label/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import MonitorPicker from "$lib/components/MonitorPicker.svelte";
  import type { MonitorRecord } from "$lib/server/types/db.js";
  import type { GroupMonitorMember } from "$lib/server/types/monitor.js";
  import ArrowUp from "@lucide/svelte/icons/arrow-up";
  import ArrowDown from "@lucide/svelte/icons/arrow-down";
  import GripVertical from "@lucide/svelte/icons/grip-vertical";
  import X from "@lucide/svelte/icons/x";
  import clientResolver from "$lib/client/resolver.js";
  import { resolve } from "$app/paths";

  const LATENCY_CALCULATION_OPTIONS = ["AVG", "MAX", "MIN"] as const;
  type LatencyCalculationOption = (typeof LATENCY_CALCULATION_OPTIONS)[number];
  const LATENCY_CALCULATION_LABELS: Record<LatencyCalculationOption, string> = {
    AVG: "平均值",
    MAX: "最大值（最慢）",
    MIN: "最小值（最快）"
  };

  type GroupMonitorFormData = {
    monitors: GroupMonitorMember[];
    executionDelay: number;
    latencyCalculation: LatencyCalculationOption;
  };

  let {
    data = $bindable({} as Record<string, unknown>),
    availableMonitors = [],
    tag = ""
  }: { data: Record<string, unknown>; availableMonitors: MonitorRecord[]; tag: string } = $props();

  const formData = data as GroupMonitorFormData;

  const MIN_SELECTED_MONITORS = 2;
  const MIN_DELAY_MS = 1000;
  // Initialize defaults if not set
  if (!Array.isArray(formData.monitors)) formData.monitors = [];
  if (
    typeof formData.executionDelay !== "number" ||
    !Number.isFinite(formData.executionDelay) ||
    formData.executionDelay < MIN_DELAY_MS
  ) {
    formData.executionDelay = MIN_DELAY_MS;
  }
  if (!LATENCY_CALCULATION_OPTIONS.includes(formData.latencyCalculation)) {
    formData.latencyCalculation = "AVG";
  }

  let executionDelayInput = $state(String(formData.executionDelay));
  const parsedExecutionDelay = $derived.by(() => {
    const value = Number(executionDelayInput);
    return Number.isFinite(value) ? value : MIN_DELAY_MS;
  });
  $effect(() => {
    formData.executionDelay = parsedExecutionDelay;
  });

  // Filter out GROUP monitors - groups can't contain other groups - and the group being edited itself
  let eligibleMonitors = $derived(
    availableMonitors.filter((m) => m.monitor_type !== "GROUP" && m.status === "ACTIVE" && m.tag !== tag)
  );
  let selectedTags = $derived(formData.monitors.map((m) => m.tag));

  /** A stale member's monitor is no longer eligible (paused or deleted after being added). */
  function isStale(monitorTag: string): boolean {
    return !eligibleMonitors.some((m) => m.tag === monitorTag);
  }

  let totalWeight = $derived(Math.round(formData.monitors.reduce((sum, m) => sum + m.weight, 0) * 1000) / 1000);
  let weightsValid = $derived(Math.abs(totalWeight - 1) < 0.001 || formData.monitors.length === 0);

  function isSelected(monitorTag: string): boolean {
    return formData.monitors.some((m) => m.tag === monitorTag);
  }

  /** Distribute weights equally across all selected monitors. */
  function distributeEqually() {
    const count = formData.monitors.length;
    if (count === 0) return;
    const weight = Math.round((1 / count) * 1000) / 1000;
    formData.monitors = formData.monitors.map((m, i) => ({
      ...m,
      // Give the last monitor the remainder to ensure sum = 1
      weight: i === count - 1 ? Math.round((1 - weight * (count - 1)) * 1000) / 1000 : weight
    }));
  }

  function toggleMonitor(monitorTag: string) {
    if (isSelected(monitorTag)) {
      formData.monitors = formData.monitors.filter((m) => m.tag !== monitorTag);
    } else {
      formData.monitors = [...formData.monitors, { tag: monitorTag, weight: 0 }];
    }
    distributeEqually();
  }

  function addMonitors(tags: string[]) {
    const newTags = tags.filter((t) => !isSelected(t));
    if (newTags.length === 0) return;
    formData.monitors = [...formData.monitors, ...newTags.map((t) => ({ tag: t, weight: 0 }))];
    distributeEqually();
  }

  function removeMonitor(monitorTag: string) {
    formData.monitors = formData.monitors.filter((m) => m.tag !== monitorTag);
    distributeEqually();
  }

  function clearAll() {
    formData.monitors = [];
  }

  function setWeight(monitorTag: string, weight: number) {
    formData.monitors = formData.monitors.map((m) => {
      if (m.tag !== monitorTag) return m;
      return { ...m, weight: Math.min(1, Math.max(0, Math.round(weight * 1000) / 1000)) };
    });
  }

  function moveMonitorUp(index: number) {
    if (index <= 0) return;
    const arr = [...formData.monitors];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    formData.monitors = arr;
  }

  function moveMonitorDown(index: number) {
    if (index >= formData.monitors.length - 1) return;
    const arr = [...formData.monitors];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    formData.monitors = arr;
  }
</script>

<div class="space-y-4">
  <div class="flex flex-col gap-2">
    <div class="flex flex-col gap-1">
      <Label>选择组合成员</Label>
      <p class="text-muted-foreground text-xs">
        组合监控通过加权评分汇总多个监控项的状态。各状态的标准分值为：正常=1、性能下降=0.5、故障=0。维护中的成员按正常
        计算。加权总分决定组合状态：1=正常，0 到 1 之间=性能下降，0=故障。
      </p>
      <p class="text-muted-foreground text-xs">
        请至少选择 {MIN_SELECTED_MONITORS} 个监控项，权重总和必须为 1。
      </p>
    </div>

    {#if eligibleMonitors.length > 0 || formData.monitors.length > 0}
      <MonitorPicker monitors={eligibleMonitors} {selectedTags} onToggle={toggleMonitor} onAddMany={addMonitors} />
    {:else}
      <p class="text-muted-foreground text-sm">没有可选的监控项，请先创建非组合监控项。</p>
    {/if}
  </div>

  {#if formData.monitors.length > 0}
    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm {weightsValid
          ? 'border-green-500/50 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
          : 'border-destructive/50 text-destructive bg-red-50 dark:bg-red-950'}"
      >
        总权重：{totalWeight}
        {#if !weightsValid}
          <span class="text-xs">（必须等于 1）</span>
        {/if}
      </div>
      <Button
        type="button"
        variant="link"
        size="sm"
        class="text-muted-foreground hover:text-foreground h-auto p-0 text-xs"
        onclick={distributeEqually}
      >
        平均分配
      </Button>
      <Button
        type="button"
        variant="link"
        size="sm"
        class="text-muted-foreground hover:text-destructive h-auto p-0 text-xs"
        onclick={clearAll}
      >
        全部清除
      </Button>
    </div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2">
    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <Label for="group-execution-delay">执行延迟（毫秒）</Label>
        <span class="text-muted-foreground text-xs">最小 {MIN_DELAY_MS} 毫秒</span>
      </div>
      <Input id="group-execution-delay" type="number" min={MIN_DELAY_MS} step={100} bind:value={executionDelayInput} />
      <p class="text-muted-foreground text-xs">在汇总结果前等待所有子监控项完成的最长时间。</p>
    </div>

    <div class="space-y-2">
      <Label for="group-latency-calculation">延迟计算方式</Label>
      <Select.Root
        type="single"
        value={formData.latencyCalculation}
        onValueChange={(value) => {
          if (value && LATENCY_CALCULATION_OPTIONS.includes(value as LatencyCalculationOption)) {
            formData.latencyCalculation = value as LatencyCalculationOption;
          }
        }}
      >
        <Select.Trigger id="group-latency-calculation" class="w-full">
          {LATENCY_CALCULATION_LABELS[formData.latencyCalculation as LatencyCalculationOption]}
        </Select.Trigger>
        <Select.Content>
          {#each LATENCY_CALCULATION_OPTIONS as option (option)}
            <Select.Item value={option}>{LATENCY_CALCULATION_LABELS[option]}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      <p class="text-muted-foreground text-xs">选择如何根据所选监控项计算延迟。</p>
    </div>
  </div>

  {#if formData.monitors.length > 0}
    <div class="rounded-lg border">
      <div class="mb-2 border-b px-3 py-2">
        <p class="text-sm font-medium">已选择 {formData.monitors.length} 个监控项 — 执行顺序</p>
        <p class="text-muted-foreground text-xs">监控项将按此顺序执行。可使用箭头调整顺序。</p>
      </div>
      {#each formData.monitors as m, index (m.tag)}
        {@const monitorInfo = availableMonitors.find((am) => am.tag === m.tag)}
        {@const stale = isStale(m.tag)}
        <div
          class="flex items-center justify-between gap-2 px-3 py-2 {index < formData.monitors.length - 1
            ? 'border-b'
            : ''}"
        >
          <div class="flex min-w-0 items-center gap-2">
            <GripVertical class="text-muted-foreground h-4 w-4 shrink-0" />
            <span class="text-muted-foreground text-xs font-medium">{index + 1}.</span>
            {#if monitorInfo?.image}
              <img
                src={clientResolver(resolve, monitorInfo.image)}
                alt={monitorInfo.name}
                class="size-8 shrink-0 rounded object-cover"
              />
            {:else}
              <div class="bg-muted flex size-8 shrink-0 items-center justify-center rounded text-xs font-medium">
                {(monitorInfo?.name || m.tag).charAt(0).toUpperCase()}
              </div>
            {/if}
            <div class="min-w-0">
              <p class="flex items-center gap-1.5 truncate text-sm">
                {monitorInfo?.name || m.tag}
                {#if stale}
                  <Badge
                    variant="outline"
                    class="text-muted-foreground shrink-0 text-[10px]"
                    title="当前未检查，已从组合评分中排除"
                  >
                    未启用
                  </Badge>
                {/if}
              </p>
              <p class="text-muted-foreground truncate text-xs">{m.tag}</p>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <div class="flex items-center gap-1.5">
              <Label class="text-muted-foreground text-xs" for="group-member-weight-{m.tag}">权重</Label>
              <Input
                id="group-member-weight-{m.tag}"
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={String(m.weight)}
                class="h-8 w-[80px] text-xs"
                onchange={(e) => {
                  const target = e.currentTarget as HTMLInputElement;
                  setWeight(m.tag, Number(target.value));
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              disabled={index === 0}
              aria-label="上移监控项"
              onclick={() => moveMonitorUp(index)}
            >
              <ArrowUp class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="h-7 w-7"
              disabled={index === formData.monitors.length - 1}
              aria-label="下移监控项"
              onclick={() => moveMonitorDown(index)}
            >
              <ArrowDown class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="hover:text-destructive h-7 w-7"
              title="从组合中移除"
              onclick={() => removeMonitor(m.tag)}
            >
              <X class="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
