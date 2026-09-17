<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import XIcon from "@lucide/svelte/icons/x";
  import MoreVerticalIcon from "@lucide/svelte/icons/more-vertical";
  import CheckIcon from "@lucide/svelte/icons/check";
  import AlertTriangleIcon from "@lucide/svelte/icons/alert-triangle";
  import type { PageProps } from "./$types";
  import type { MonitorRecord, IncidentRecord, IncidentCommentRecord } from "$lib/server/types/db.js";
  import { goto } from "$app/navigation";
  import { toast } from "svelte-sonner";
  import LocalTime from "$lib/components/LocalTime.svelte";
  import GC from "$lib/global-constants";
  import { mode } from "mode-watcher";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { SveltePurify } from "@humanspeak/svelte-purify";

  import CodeMirror from "svelte-codemirror-editor";
  import { adminEditorExtensions } from "$lib/client/admin-editor.js";
  import { markdown } from "@codemirror/lang-markdown";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import mdToHTML from "$lib/marked";

  let { params }: PageProps = $props();
  const isNew = $derived(params.incident_id === "new");

  // Form state
  let loading = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);

  // Incident data
  let incident = $state<{
    id: number;
    title: string;
    start_date_time: number;
    status: string;
    state: string;
    is_global: string;
  }>({
    id: 0,
    title: "",
    start_date_time: Math.floor(Date.now() / 1000),
    status: "OPEN",
    state: GC.INVESTIGATING,
    is_global: "YES"
  });

  // For datetime inputs (convert to/from local datetime string)
  let startDateTimeLocal = $state("");

  // First comment for new incidents
  let firstComment = $state("");

  // Comments for existing incidents
  let comments = $state<IncidentCommentRecord[]>([]);
  let loadingComments = $state(false);

  // Monitors
  let availableMonitors = $state<MonitorRecord[]>([]);
  let incidentMonitors = $state<Array<{ monitor_tag: string; monitor_impact: string | null }>>([]);
  let originalMonitors = $state<Array<{ monitor_tag: string; monitor_impact: string | null }>>([]);
  let addMonitorDialogOpen = $state(false);
  let selectedMonitorTag = $state("");
  let selectedMonitorImpact = $state("DOWN");
  let addingMonitor = $state(false);

  // Comment inline editing/adding
  let addingNewComment = $state(false);
  let editingCommentId = $state<number | null>(null);
  let commentText = $state<string>("");
  let commentState = $state<string>(GC.INVESTIGATING);
  let commentDateTime = $state<string>("");
  let savingComment = $state<boolean>(false);

  const states = [GC.INVESTIGATING, GC.IDENTIFIED, GC.MONITORING, GC.RESOLVED];
  const stateLabels: Record<string, string> = {
    [GC.INVESTIGATING]: "调查中",
    [GC.IDENTIFIED]: "已定位",
    [GC.MONITORING]: "监控中",
    [GC.RESOLVED]: "已解决"
  };
  const impactLabels: Record<string, string> = {
    DOWN: "中断",
    DEGRADED: "性能下降",
    MAINTENANCE: "维护中"
  };

  // Convert timestamp to local datetime string for input (YYYY-MM-DDTHH:MM format)
  function timestampToLocalDatetime(ts: number): string {
    const date = new Date(ts * 1000);
    // Format as YYYY-MM-DDTHH:MM in local time
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  // Convert local datetime string to timestamp (stores as UTC)
  function localDatetimeToTimestamp(datetime: string): number {
    if (!datetime) return Math.floor(Date.now() / 1000);
    const date = new Date(datetime);
    return Math.floor(date.getTime() / 1000);
  }

  // Sync datetime inputs with incident state
  $effect(() => {
    if (incident.start_date_time) {
      startDateTimeLocal = timestampToLocalDatetime(incident.start_date_time);
    }
  });

  // Update incident timestamps when inputs change
  function handleStartDateChange(e: Event) {
    const target = e.target as HTMLInputElement;
    startDateTimeLocal = target.value;
    incident.start_date_time = localDatetimeToTimestamp(target.value);
  }

  // Validation
  const isValid = $derived(incident.title.trim() !== "" && incident.start_date_time > 0);

  // Fetch incident data
  async function fetchIncident() {
    if (isNew) {
      loading = false;
      return;
    }

    loading = true;
    error = null;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getIncident", data: { incident_id: parseInt(params.incident_id) } })
      });
      const result = await response.json();
      if (result.error) {
        error = result.error;
      } else if (result) {
        incident = {
          id: result.id,
          title: result.title,
          start_date_time: result.start_date_time,
          status: result.status,
          state: result.state,
          is_global: result.is_global || "YES"
        };
        // Fetch comments and monitors
        await Promise.all([fetchComments(), fetchIncidentMonitors()]);
      } else {
        error = "未找到事件";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "获取事件失败";
    } finally {
      loading = false;
    }
  }

  // Fetch comments
  async function fetchComments() {
    if (isNew) return;
    loadingComments = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getComments", data: { incident_id: parseInt(params.incident_id) } })
      });
      const result = await response.json();
      if (!result.error) {
        comments = result;
      }
    } catch {
      // Ignore errors
    } finally {
      loadingComments = false;
    }
  }

  // Fetch incident monitors
  async function fetchIncidentMonitors() {
    if (isNew) return;
    try {
      // We get monitors from the getIncident response - need to fetch full incident data
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getIncidents",
          data: { page: 1, limit: 100, filter: { status: "ALL" } }
        })
      });
      const result = await response.json();
      if (!result.error && result.incidents) {
        const found = result.incidents.find((i: any) => i.id === parseInt(params.incident_id));
        if (found && found.monitors) {
          incidentMonitors = found.monitors.map((m: any) => ({
            monitor_tag: m.tag || m.monitor_tag,
            monitor_impact: m.impact_type || m.monitor_impact
          }));
          // Store original monitors to compare on save
          originalMonitors = [...incidentMonitors];
        }
      }
    } catch {
      // Ignore errors
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

  // Save incident (create or update)
  async function saveIncident() {
    if (!isValid) return;
    saving = true;
    error = null;

    try {
      if (isNew) {
        // Create new incident
        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createIncident",
            data: {
              title: incident.title,
              start_date_time: incident.start_date_time,
              end_date_time: null,
              status: "OPEN",
              state: GC.INVESTIGATING,
              incident_type: GC.INCIDENT,
              is_global: incident.is_global
            }
          })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          const incidentId = result.incident_id;

          // Add monitors
          for (const monitor of incidentMonitors) {
            await fetch(clientResolver(resolve, "/manage/api"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "addMonitor",
                data: {
                  incident_id: incidentId,
                  monitor_tag: monitor.monitor_tag,
                  monitor_impact: monitor.monitor_impact
                }
              })
            });
          }

          // Add first comment if provided
          if (firstComment.trim()) {
            await fetch(clientResolver(resolve, "/manage/api"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "addComment",
                data: {
                  incident_id: incidentId,
                  comment: firstComment,
                  state: GC.INVESTIGATING,
                  commented_at: incident.start_date_time
                }
              })
            });
          }
          toast.success("事件创建成功");
          goto(clientResolver(resolve, `/manage/app/incidents/${incidentId}`));
        }
      } else {
        // Update existing incident
        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateIncident",
            data: {
              id: incident.id,
              title: incident.title,
              start_date_time: incident.start_date_time,
              end_date_time: null,
              status: "OPEN",
              is_global: incident.is_global
            }
          })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          // Sync monitors - find added, removed, and changed
          const originalTags = originalMonitors.map((m) => m.monitor_tag);
          const currentTags = incidentMonitors.map((m) => m.monitor_tag);

          // Monitors to add (in current but not in original)
          const toAdd = incidentMonitors.filter((m) => !originalTags.includes(m.monitor_tag));
          // Monitors to remove (in original but not in current)
          const toRemove = originalMonitors.filter((m) => !currentTags.includes(m.monitor_tag));
          // Monitors with changed impact (in both but impact is different)
          const toUpdate = incidentMonitors.filter((m) => {
            const original = originalMonitors.find((o) => o.monitor_tag === m.monitor_tag);
            return original && original.monitor_impact !== m.monitor_impact;
          });

          // Add new monitors
          for (const monitor of toAdd) {
            await fetch(clientResolver(resolve, "/manage/api"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "addMonitor",
                data: {
                  incident_id: incident.id,
                  monitor_tag: monitor.monitor_tag,
                  monitor_impact: monitor.monitor_impact
                }
              })
            });
          }

          // Update monitors with changed impact
          for (const monitor of toUpdate) {
            await fetch(clientResolver(resolve, "/manage/api"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "addMonitor",
                data: {
                  incident_id: incident.id,
                  monitor_tag: monitor.monitor_tag,
                  monitor_impact: monitor.monitor_impact
                }
              })
            });
          }

          // Remove deleted monitors
          for (const monitor of toRemove) {
            await fetch(clientResolver(resolve, "/manage/api"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "removeMonitor",
                data: {
                  incident_id: incident.id,
                  monitor_tag: monitor.monitor_tag
                }
              })
            });
          }

          // Update originalMonitors to reflect current state
          originalMonitors = [...incidentMonitors];

          toast.success("更改已保存");
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败");
    } finally {
      saving = false;
    }
  }

  // Add monitor to incident
  async function addMonitorToIncident() {
    if (!selectedMonitorTag || !incident.id) return;
    addingMonitor = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addMonitor",
          data: {
            incident_id: incident.id,
            monitor_tag: selectedMonitorTag,
            monitor_impact: selectedMonitorImpact
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控器已添加到事件");
        await fetchIncidentMonitors();
        addMonitorDialogOpen = false;
        selectedMonitorTag = "";
        selectedMonitorImpact = "DOWN";
      }
    } catch (e) {
      toast.error("添加监控器失败");
    } finally {
      addingMonitor = false;
    }
  }

  // Remove monitor from incident
  async function removeMonitorFromIncident(monitorTag: string) {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeMonitor",
          data: {
            incident_id: incident.id,
            monitor_tag: monitorTag
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控器已从事件中移除");
        await fetchIncidentMonitors();
      }
    } catch {
      toast.error("移除监控器失败");
    }
  }

  // Start editing a comment (inline)
  function startEditComment(comment: IncidentCommentRecord) {
    editingCommentId = comment.id;
    commentText = comment.comment;
    commentState = comment.state;
    commentDateTime = timestampToLocalDatetime(comment.commented_at);
  }

  // Cancel editing
  function cancelEditComment() {
    editingCommentId = null;
    commentText = "";
    commentState = incident.state;
    commentDateTime = "";
  }

  // Start adding new comment (inline)
  function startAddComment() {
    addingNewComment = true;
    editingCommentId = null;
    commentText = "";
    commentState = incident.state;
    commentDateTime = timestampToLocalDatetime(Math.floor(Date.now() / 1000));
  }

  // Cancel adding new comment
  function cancelAddComment() {
    addingNewComment = false;
    commentText = "";
    commentState = incident.state;
    commentDateTime = "";
  }

  // Save comment (add or edit)
  async function saveComment() {
    if (!commentText.trim()) return;
    savingComment = true;
    try {
      if (editingCommentId !== null) {
        // Update existing comment
        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "updateComment",
            data: {
              incident_id: incident.id,
              comment_id: editingCommentId,
              comment: commentText,
              state: commentState,
              commented_at: localDatetimeToTimestamp(commentDateTime)
            }
          })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("更新已保存");
          await fetchComments();
          await fetchIncident();
          cancelEditComment();
        }
      } else {
        // Add new comment
        const response = await fetch(clientResolver(resolve, "/manage/api"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "addComment",
            data: {
              incident_id: incident.id,
              comment: commentText,
              state: commentState,
              commented_at: localDatetimeToTimestamp(commentDateTime)
            }
          })
        });
        const result = await response.json();
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("更新已添加");
          await fetchComments();
          await fetchIncident();
          cancelAddComment();
        }
      }
    } catch {
      toast.error("保存更新失败");
    } finally {
      savingComment = false;
    }
  }

  // Delete comment
  async function deleteComment(commentId: number) {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteComment",
          data: {
            incident_id: incident.id,
            comment_id: commentId
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("更新已删除");
        await fetchComments();
      }
    } catch {
      toast.error("删除更新失败");
    }
  }

  // Add monitor to list (for new incidents, just adds to local array)
  function addMonitorToList() {
    if (!selectedMonitorTag) return;
    incidentMonitors = [
      ...incidentMonitors,
      { monitor_tag: selectedMonitorTag, monitor_impact: selectedMonitorImpact }
    ];
    addMonitorDialogOpen = false;
    selectedMonitorTag = "";
    selectedMonitorImpact = "DOWN";
  }

  // Remove monitor from list (for new incidents)
  function removeMonitorFromList(monitorTag: string) {
    incidentMonitors = incidentMonitors.filter((m) => m.monitor_tag !== monitorTag);
  }

  // Update monitor impact in list
  function updateMonitorImpact(monitorTag: string, newImpact: string) {
    incidentMonitors = incidentMonitors.map((m) =>
      m.monitor_tag === monitorTag ? { ...m, monitor_impact: newImpact } : m
    );
  }

  // Get state badge variant
  function getStateBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
    switch (state) {
      case GC.RESOLVED:
        return "default";
      case GC.MONITORING:
        return "secondary";
      case GC.IDENTIFIED:
        return "outline";
      case GC.INVESTIGATING:
      default:
        return "destructive";
    }
  }

  // Get impact badge variant
  function getImpactBadgeVariant(impact: string | null): "default" | "secondary" | "destructive" | "outline" {
    switch (impact) {
      case "DOWN":
        return "destructive";
      case "DEGRADED":
        return "secondary";
      case "MAINTENANCE":
        return "outline";
      default:
        return "default";
    }
  }

  // Get monitor name by tag
  function getMonitorName(tag: string): string {
    const monitor = availableMonitors.find((m) => m.tag === tag);
    return monitor?.name || tag;
  }

  // Get unassigned monitors
  const unassignedMonitors = $derived(
    availableMonitors.filter((m) => !incidentMonitors.some((im) => im.monitor_tag === m.tag))
  );

  // Delete incident
  let deleteDialogOpen = $state(false);
  let deleteConfirmText = $state("");
  let deleting = $state(false);
  const deleteConfirmPhrase = $derived(`删除事件 ${params.incident_id}`);
  const deleteConfirmed = $derived(deleteConfirmText === deleteConfirmPhrase);

  async function deleteIncident() {
    if (!deleteConfirmed) return;
    deleting = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteIncident",
          data: { incident_id: parseInt(params.incident_id) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("事件删除成功");
        window.location.replace(clientResolver(resolve, "/manage/app/incidents"));
      }
    } catch {
      toast.error("删除事件失败");
    } finally {
      deleting = false;
    }
  }

  $effect(() => {
    fetchIncident();
    fetchAvailableMonitors();
  });
</script>

<div class="container space-y-6 py-6">
  <!-- Breadcrumb -->
  <div class="flex justify-between gap-2">
    <Breadcrumb.Root>
      <Breadcrumb.List>
        <Breadcrumb.Item>
          <Breadcrumb.Link href={clientResolver(resolve, "/manage/app/incidents")}>事件</Breadcrumb.Link>
        </Breadcrumb.Item>
        <Breadcrumb.Separator />
        <Breadcrumb.Item>
          <Breadcrumb.Page>{isNew ? "新建事件" : `编辑事件 #${params.incident_id}`}</Breadcrumb.Page>
        </Breadcrumb.Item>
      </Breadcrumb.List>
    </Breadcrumb.Root>
    <div class="flex gap-2">
      {#if !isNew}
        <Button
          variant="outline"
          target="_blank"
          size="sm"
          href={clientResolver(resolve, `/incidents/${params.incident_id}`)}
        >
          查看
        </Button>
        <Dialog.Root bind:open={deleteDialogOpen} onOpenChange={() => (deleteConfirmText = "")}>
          <Dialog.Trigger>
            {#snippet child({ props })}
              <Button {...props} variant="destructive" size="sm">
                <TrashIcon class="size-4" />
                删除
              </Button>
            {/snippet}
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>删除事件</Dialog.Title>
              <Dialog.Description>
                此操作无法撤销，将永久删除该事件及其更新，并移除所有关联的监控器链接。
              </Dialog.Description>
            </Dialog.Header>
            <div class="space-y-4 py-4">
              <div class="flex flex-col gap-2">
                <Label>请输入 <span class="font-mono font-semibold">{deleteConfirmPhrase}</span> 进行确认</Label>
                <Input bind:value={deleteConfirmText} placeholder={deleteConfirmPhrase} />
              </div>
            </div>
            <Dialog.Footer>
              <Button variant="outline" onclick={() => (deleteDialogOpen = false)}>取消</Button>
              <Button variant="destructive" onclick={deleteIncident} disabled={!deleteConfirmed || deleting}>
                {#if deleting}
                  <Loader class="size-4 animate-spin" />
                {/if}
                删除事件
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
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
    <!-- Incident Details -->
    <Card.Root>
      <Card.Header>
        <Card.Title>{isNew ? "创建新事件" : "事件详情"}</Card.Title>
        <Card.Description>
          {#if isNew}
            创建要跟踪的新事件
          {:else}
            编辑事件详情并管理更新
          {/if}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Status badges (only for existing) -->
        {#if !isNew}
          <div class="flex items-center gap-2">
            <Badge
              variant="outline"
              class="text-{incident.state.toLowerCase()} border-{incident.state.toLowerCase()} font-semibold"
              >{stateLabels[incident.state] || incident.state}</Badge
            >
          </div>
        {/if}

        <!-- Title -->
        <div class="flex flex-col gap-2">
          <Label for="incident-title">标题 <span class="text-destructive">*</span></Label>
          <Input id="incident-title" bind:value={incident.title} placeholder="简要描述此事件" />
        </div>

        <!-- Start Date/Time -->
        <div class="flex flex-col gap-2">
          <Label for="incident-start">开始日期/时间 <span class="text-destructive">*</span></Label>
          <Input
            id="incident-start"
            type="datetime-local"
            value={startDateTimeLocal}
            onchange={handleStartDateChange}
          />
          <p class="text-muted-foreground text-xs">请输入本地时区时间，系统将以 UTC 存储。</p>
        </div>

        <!-- Global Visibility -->
        <div class="flex items-center justify-between rounded-md border p-3">
          <div class="flex flex-col gap-1">
            <Label for="is-global">全局事件</Label>
            <p class="text-muted-foreground text-xs">启用后，此事件将在所有状态页上显示</p>
          </div>
          <Switch
            id="is-global"
            checked={incident.is_global === "YES"}
            onCheckedChange={(checked) => {
              incident.is_global = checked ? "YES" : "NO";
            }}
          />
        </div>

        <!-- First Comment (only for new) -->
        {#if isNew}
          <div class="flex flex-col gap-2">
            <Label for="first-comment">初始更新（可选）</Label>
            <div class="overflow-hidden rounded-md border">
              <CodeMirror
                extensions={adminEditorExtensions}
                bind:value={firstComment}
                lang={markdown()}
                theme={mode.current === "dark" ? githubDark : githubLight}
                styles={{
                  "&": {
                    width: "100%",
                    maxWidth: "100%",
                    height: "160px"
                  }
                }}
              />
            </div>
            <p class="text-muted-foreground text-xs">支持 Markdown。此内容将作为该事件的第一条更新。</p>
          </div>
        {/if}

        <!-- Affected Monitors (for both new and existing incidents) -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <Label>受影响的监控器（可选）</Label>
            <Dialog.Root bind:open={addMonitorDialogOpen}>
              <Dialog.Trigger>
                {#snippet child({ props })}
                  <Button {...props} size="sm" variant="outline" disabled={unassignedMonitors.length === 0}>
                    <PlusIcon class="size-4" />
                    添加监控器
                  </Button>
                {/snippet}
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>添加受影响的监控器</Dialog.Title>
                  <Dialog.Description>选择监控器及其影响级别</Dialog.Description>
                </Dialog.Header>
                <div class="space-y-4 py-4">
                  <div class="flex flex-col gap-2">
                    <Label>监控器</Label>
                    <Select.Root
                      type="single"
                      value={selectedMonitorTag}
                      onValueChange={(v) => {
                        if (v) selectedMonitorTag = v;
                      }}
                    >
                      <Select.Trigger class="w-full">
                        {selectedMonitorTag ? getMonitorName(selectedMonitorTag) : "选择监控器"}
                      </Select.Trigger>
                      <Select.Content>
                        {#each unassignedMonitors as monitor}
                          <Select.Item value={monitor.tag}>{monitor.name}</Select.Item>
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                  <div class="flex flex-col gap-2">
                    <Label>影响级别</Label>
                    <Select.Root
                      type="single"
                      value={selectedMonitorImpact}
                      onValueChange={(v) => {
                        if (v) selectedMonitorImpact = v;
                      }}
                    >
                      <Select.Trigger class="w-full">
                        {impactLabels[selectedMonitorImpact] || selectedMonitorImpact}
                      </Select.Trigger>
                      <Select.Content>
                        <Select.Item value="DOWN">中断</Select.Item>
                        <Select.Item value="DEGRADED">性能下降</Select.Item>
                      </Select.Content>
                    </Select.Root>
                  </div>
                </div>
                <Dialog.Footer>
                  <Button variant="outline" onclick={() => (addMonitorDialogOpen = false)}>取消</Button>
                  <Button onclick={addMonitorToList} disabled={!selectedMonitorTag}>添加监控器</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Root>
          </div>
          {#if incidentMonitors.length === 0}
            <p class="text-muted-foreground text-sm">未选择监控器</p>
          {:else}
            <div class="space-y-2">
              {#each incidentMonitors as monitor}
                <div class="flex items-center justify-between rounded-md border p-3">
                  <div class="flex items-center gap-3">
                    <span class="font-medium">{getMonitorName(monitor.monitor_tag)}</span>
                    <Badge
                      variant="outline"
                      class="text-{monitor.monitor_impact?.toLowerCase() ||
                        'default'} font-semibold border-{monitor.monitor_impact?.toLowerCase() || 'default'}"
                    >
                      {impactLabels[monitor.monitor_impact || ""] || monitor.monitor_impact || "未知"}
                    </Badge>
                  </div>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger>
                      {#snippet child({ props })}
                        <Button {...props} variant="ghost" size="icon">
                          <MoreVerticalIcon class="size-4" />
                        </Button>
                      {/snippet}
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end">
                      <DropdownMenu.Label>更新影响</DropdownMenu.Label>
                      <DropdownMenu.Group>
                        <DropdownMenu.Item
                          class="cursor-pointer"
                          onclick={() => updateMonitorImpact(monitor.monitor_tag, "DOWN")}
                        >
                          <span class="flex items-center gap-2">
                            {#if monitor.monitor_impact === "DOWN"}
                              <CheckIcon class="size-4" />
                            {:else}
                              <span class="size-4"></span>
                            {/if}
                            中断
                          </span>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          class="cursor-pointer"
                          onclick={() => updateMonitorImpact(monitor.monitor_tag, "DEGRADED")}
                        >
                          <span class="flex items-center gap-2">
                            {#if monitor.monitor_impact === "DEGRADED"}
                              <CheckIcon class="size-4" />
                            {:else}
                              <span class="size-4"></span>
                            {/if}
                            性能下降
                          </span>
                        </DropdownMenu.Item>
                      </DropdownMenu.Group>
                      <DropdownMenu.Separator />
                      <DropdownMenu.Item
                        class="text-destructive cursor-pointer"
                        onclick={() => removeMonitorFromList(monitor.monitor_tag)}
                      >
                        <TrashIcon class="size-4" />
                        移除
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveIncident} disabled={saving || !isValid}>
          {#if saving}
            <Loader class="size-4 animate-spin" />
          {:else}
            <SaveIcon class="size-4" />
          {/if}
          {isNew ? "创建事件" : "保存更改"}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Updates/Comments (only for existing incidents) -->
    {#if !isNew}
      <Card.Root>
        <Card.Header>
          <div class="flex items-center justify-between">
            <div>
              <Card.Title>更新</Card.Title>
              <Card.Description>此事件的状态更新时间线</Card.Description>
            </div>
            {#if !addingNewComment}
              <Button size="sm" onclick={startAddComment}>
                <PlusIcon class="size-4" />
                添加更新
              </Button>
            {/if}
          </div>
        </Card.Header>
        <Card.Content>
          <!-- Add new comment inline form -->
          {#if addingNewComment}
            <div class="mb-4 space-y-4 rounded-md border p-4">
              <div class="flex flex-col gap-2">
                <Label>更新内容</Label>
                <div class="overflow-hidden rounded-md border">
                  <CodeMirror
                    extensions={adminEditorExtensions}
                    bind:value={commentText}
                    lang={markdown()}
                    theme={mode.current === "dark" ? githubDark : githubLight}
                    styles={{
                      "&": {
                        width: "100%",
                        maxWidth: "100%",
                        height: "120px"
                      }
                    }}
                  />
                </div>
                <p class="text-muted-foreground text-xs">支持 Markdown 格式</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <Label>状态</Label>
                  <Select.Root
                    type="single"
                    value={commentState}
                    onValueChange={(v) => {
                      if (v) commentState = v;
                    }}
                  >
                    <Select.Trigger class="w-full">{stateLabels[commentState] || commentState}</Select.Trigger>
                    <Select.Content>
                      {#each states as state}
                        <Select.Item value={state}>{stateLabels[state] || state}</Select.Item>
                      {/each}
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="flex flex-col gap-2">
                  <Label>日期/时间</Label>
                  <Input type="datetime-local" bind:value={commentDateTime} />
                </div>
              </div>
              <div class="flex justify-end gap-2">
                <Button variant="outline" size="sm" onclick={cancelAddComment}>取消</Button>
                <Button size="sm" onclick={saveComment} disabled={!commentText.trim() || savingComment}>
                  {#if savingComment}
                    <Loader class="size-4 animate-spin" />
                  {/if}
                  添加更新
                </Button>
              </div>
            </div>
          {/if}

          {#if loadingComments}
            <div class="flex justify-center py-4">
              <Spinner class="size-6" />
            </div>
          {:else if comments.length === 0 && !addingNewComment}
            <p class="text-muted-foreground py-4 text-center text-sm">暂无更新</p>
          {:else}
            <div class="space-y-4">
              {#each comments as comment (comment.id)}
                <div class="rounded-md border p-4">
                  {#if editingCommentId === comment.id}
                    <!-- Inline edit mode -->
                    <div class="space-y-4">
                      <div class="flex flex-col gap-2">
                        <Label>更新内容</Label>
                        <div class="overflow-hidden rounded-md border">
                          <CodeMirror
                            extensions={adminEditorExtensions}
                            bind:value={commentText}
                            lang={markdown()}
                            theme={mode.current === "dark" ? githubDark : githubLight}
                            styles={{
                              "&": {
                                width: "100%",
                                maxWidth: "100%",
                                height: "120px"
                              }
                            }}
                          />
                        </div>
                        <p class="text-muted-foreground text-xs">支持 Markdown 格式</p>
                      </div>
                      <div class="grid grid-cols-2 gap-4">
                        <div class="flex flex-col gap-2">
                          <Label>状态</Label>
                          <Select.Root
                            type="single"
                            value={commentState}
                            onValueChange={(v) => {
                              if (v) commentState = v;
                            }}
                          >
                            <Select.Trigger class="w-full">{stateLabels[commentState] || commentState}</Select.Trigger>
                            <Select.Content>
                              {#each states as state}
                                <Select.Item value={state}>{stateLabels[state] || state}</Select.Item>
                              {/each}
                            </Select.Content>
                          </Select.Root>
                        </div>
                        <div class="flex flex-col gap-2">
                          <Label>日期/时间</Label>
                          <Input type="datetime-local" bind:value={commentDateTime} />
                        </div>
                      </div>
                      <div class="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onclick={cancelEditComment}>取消</Button>
                        <Button size="sm" onclick={saveComment} disabled={!commentText.trim() || savingComment}>
                          {#if savingComment}
                            <Loader class="size-4 animate-spin" />
                          {/if}
                          保存
                        </Button>
                      </div>
                    </div>
                  {:else}
                    <!-- View mode -->
                    <div class="flex items-start justify-between">
                      <div class="flex-1 space-y-2">
                        <div class="flex items-center gap-2">
                          <Badge variant={getStateBadgeVariant(comment.state)}>
                            {stateLabels[comment.state] || comment.state}
                          </Badge>
                          <span class="text-muted-foreground text-sm">
                            <LocalTime value={comment.commented_at} format="yyyy-MM-dd HH:mm" />
                          </span>
                        </div>
                        <div
                          class="kener-md prose prose-neutral dark:prose-invert prose-code:rounded prose-code:py-[0.2rem] prose-code:font-mono prose-code:text-sm prose-code:font-normal prose-pre:bg-opacity-0 dark:prose-pre:bg-neutral-800 max-w-none"
                        >
                          <SveltePurify html={mdToHTML(comment.comment)} />
                        </div>
                      </div>
                      <div class="ml-4 flex gap-1">
                        <Button variant="ghost" size="icon" onclick={() => startEditComment(comment)}>
                          <PencilIcon class="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onclick={() => deleteComment(comment.id)}>
                          <TrashIcon class="size-4" />
                        </Button>
                      </div>
                    </div>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </Card.Content>
      </Card.Root>
    {/if}
  {/if}
</div>
