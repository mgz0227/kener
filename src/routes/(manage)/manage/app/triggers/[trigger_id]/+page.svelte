<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Alert from "$lib/components/ui/alert/index.js";

  import { Button } from "$lib/components/ui/button/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import AlertCircleIcon from "@lucide/svelte/icons/octagon-alert";
  import Loader from "@lucide/svelte/icons/loader";
  import CheckIcon from "@lucide/svelte/icons/check";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { toast } from "svelte-sonner";
  import { onMount } from "svelte";
  import { mode } from "mode-watcher";
  import { IsValidURL } from "$lib/clientTools";
  import CodeMirror from "svelte-codemirror-editor";
  import { adminEditorExtensions } from "$lib/client/admin-editor.js";
  import { html } from "@codemirror/lang-html";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import type { TriggerMeta } from "$lib/server/types/db";

  let { data } = page;
  // Types

  // State
  let loading = $state(true);
  let saving = $state(false);
  let testing = $state<"idle" | "loading" | "success" | "error">("idle");
  let invalidFormMessage = $state("");
  let deleteDialogOpen = $state(false);
  let deleteConfirmName = $state("");
  let isDeleting = $state(false);

  // Get trigger ID from URL params
  const triggerId = $derived(data.trigger_id);
  const isNew = $derived(triggerId === "new");

  // Form state
  let trigger = $state<{
    id: number;
    name: string;
    trigger_type: string;
    trigger_desc: string;
    trigger_status: string;
    trigger_meta: TriggerMeta;
  }>({
    id: 0,
    name: "",
    trigger_type: "webhook",
    trigger_desc: "",
    trigger_status: "ACTIVE",
    trigger_meta: {
      url: "",
      headers: [],
      to: "",
      from: "",
      webhook_body: data.webhook_template.webhook_body,
      discord_body: data.discord_template.discord_body,
      slack_body: data.slack_template.slack_body,
      email_body: data.email_template.email_body,
      email_subject: data.email_template.email_subject
    }
  });

  async function fetchTrigger() {
    if (isNew) {
      loading = false;
      return;
    }

    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getTriggers",
          data: {}
        })
      });
      const result = await response.json();
      const foundTrigger = result.find((t: { id: number }) => t.id === parseInt(triggerId || "0"));
      if (foundTrigger) {
        const meta = JSON.parse(foundTrigger.trigger_meta) as TriggerMeta;
        trigger = {
          id: foundTrigger.id,
          name: foundTrigger.name,
          trigger_type: foundTrigger.trigger_type,
          trigger_desc: foundTrigger.trigger_desc || "",
          trigger_status: foundTrigger.trigger_status || "ACTIVE",
          trigger_meta: {
            url: meta.url || "",
            headers: meta.headers || [],
            to: meta.to || "",
            from: meta.from || "",
            webhook_body: meta.webhook_body || data.webhook_template.webhook_body,
            discord_body: meta.discord_body || data.discord_template.discord_body,
            slack_body: meta.slack_body || data.slack_template.slack_body,
            email_body: meta.email_body || data.email_template.email_body,
            email_subject: meta.email_subject || data.email_template.email_subject
          }
        };
      } else {
        toast.error("未找到触发器");
        goto(clientResolver(resolve, "/manage/app/triggers"));
      }
    } catch (error) {
      console.error("Error fetching trigger:", error);
      toast.error("加载触发器失败");
    } finally {
      loading = false;
    }
  }

  // Validation
  function validateNameEmailPattern(input: string): { isValid: boolean; name: string | null; email: string | null } {
    const pattern = /^([\w\s]+)\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>$/;
    const match = input.match(pattern);
    if (match) {
      return { isValid: true, name: match[1].trim(), email: match[2] };
    }
    return { isValid: false, name: null, email: null };
  }

  async function saveTrigger() {
    invalidFormMessage = "";

    // Validation
    if (!trigger.name.trim()) {
      invalidFormMessage = "触发器名称为必填项";
      return;
    }

    if (!trigger.trigger_type) {
      invalidFormMessage = "触发器类型为必填项";
      return;
    }

    if (trigger.trigger_type === "email") {
      if (!trigger.trigger_meta.to.trim()) {
        invalidFormMessage = "收件人电子邮箱地址为必填项";
        return;
      }
      if (!validateNameEmailPattern(trigger.trigger_meta.from).isValid) {
        invalidFormMessage = "发件人格式无效。格式：名称 <email@example.com>";
        return;
      }
    } else {
      // URL validation for non-email triggers
      if (!trigger.trigger_meta.url.trim()) {
        invalidFormMessage = "触发器 URL 为必填项";
        return;
      }
      if (!IsValidURL(trigger.trigger_meta.url)) {
        invalidFormMessage = "URL 无效";
        return;
      }
    }

    saving = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createUpdateTrigger",
          data: {
            id: trigger.id || undefined,
            name: trigger.name,
            trigger_type: trigger.trigger_type,
            trigger_status: trigger.trigger_status,
            trigger_desc: trigger.trigger_desc,
            trigger_meta: JSON.stringify(trigger.trigger_meta)
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        invalidFormMessage = result.error;
      } else {
        toast.success(trigger.id ? "触发器更新成功" : "触发器创建成功");
        if (isNew) {
          goto(clientResolver(resolve, "/manage/app/triggers"));
        }
      }
    } catch (error) {
      invalidFormMessage = "保存触发器失败";
    } finally {
      saving = false;
    }
  }

  async function testTrigger() {
    if (!trigger.id) {
      toast.error("请先保存触发器");
      return;
    }

    testing = "loading";
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testTrigger",
          data: { trigger_id: trigger.id, status: "TRIGGERED" }
        })
      });
      const result = await response.json();
      if (result.error) {
        testing = "error";
        toast.error(result.error);
      } else {
        testing = "success";
        toast.success("测试触发器发送成功");
      }
    } catch (error) {
      testing = "error";
      toast.error("测试触发器失败");
    } finally {
      setTimeout(() => {
        testing = "idle";
      }, 3000);
    }
  }

  function addHeader() {
    trigger.trigger_meta.headers = [...trigger.trigger_meta.headers, { key: "", value: "" }];
  }

  function removeHeader(index: number) {
    trigger.trigger_meta.headers = trigger.trigger_meta.headers.filter((_, i) => i !== index);
  }

  async function deleteTrigger() {
    if (!trigger.id || deleteConfirmName !== trigger.name) return;

    isDeleting = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteTrigger",
          data: { trigger_id: trigger.id }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("触发器删除成功");
        goto(clientResolver(resolve, "/manage/app/triggers"));
      }
    } catch (error) {
      toast.error("删除触发器失败");
    } finally {
      isDeleting = false;
      deleteDialogOpen = false;
      deleteConfirmName = "";
    }
  }

  onMount(() => {
    fetchTrigger();
  });
</script>

<div class="container space-y-6 py-6">
  <!-- Breadcrumb -->
  <Breadcrumb.Root>
    <Breadcrumb.List>
      <Breadcrumb.Item>
        <Breadcrumb.Link href={clientResolver(resolve, "/manage/app/triggers")}>触发器</Breadcrumb.Link>
      </Breadcrumb.Item>
      <Breadcrumb.Separator />
      <Breadcrumb.Item>
        <Breadcrumb.Page>{isNew ? "新建触发器" : trigger.name || "编辑触发器"}</Breadcrumb.Page>
      </Breadcrumb.Item>
    </Breadcrumb.List>
  </Breadcrumb.Root>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="size-8" />
    </div>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title>{isNew ? "新建触发器" : "编辑触发器"}</Card.Title>
        <Card.Description>配置监控器的通知触发器</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Error Message -->
        {#if invalidFormMessage}
          <div class="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">{invalidFormMessage}</div>
        {/if}

        <!-- Trigger Type Selection -->
        <div class="space-y-3">
          <Label>触发器类型</Label>
          <p class="text-muted-foreground text-sm">选择要发送的通知类型</p>
          <Select.Root
            type="single"
            value={trigger.trigger_type}
            onValueChange={(value) => {
              if (value) trigger.trigger_type = value;
            }}
          >
            <Select.Trigger class="w-full max-w-sm capitalize">
              {trigger.trigger_type === "email" ? "电子邮件" : trigger.trigger_type}
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="webhook">Webhook</Select.Item>
              <Select.Item value="discord">Discord</Select.Item>
              <Select.Item value="slack">Slack</Select.Item>
              <Select.Item value="email">电子邮件</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Status Toggle -->
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label>状态</Label>
            <p class="text-muted-foreground text-sm">启用或停用此触发器</p>
          </div>
          <Switch
            checked={trigger.trigger_status === "ACTIVE"}
            onCheckedChange={(checked) => (trigger.trigger_status = checked ? "ACTIVE" : "INACTIVE")}
          />
        </div>

        <!-- Name -->
        <div class="space-y-2">
          <Label for="trigger-name">
            名称 <span class="text-destructive">*</span>
          </Label>
          <Input id="trigger-name" bind:value={trigger.name} placeholder="我的触发器" />
        </div>

        <!-- Description -->
        <div class="space-y-2">
          <Label for="trigger-desc">描述</Label>
          <Input id="trigger-desc" bind:value={trigger.trigger_desc} placeholder="可选描述" />
        </div>

        <!-- URL (for non-email) -->
        {#if trigger.trigger_type !== "email"}
          <div class="space-y-2">
            <Label for="trigger-url">
              URL <span class="text-destructive">*</span>
            </Label>
            <Input id="trigger-url" bind:value={trigger.trigger_meta.url} placeholder="https://example.com/webhook" />
            <p class="text-muted-foreground text-xs">用于发送通知的 URL</p>
          </div>
        {/if}

        <!-- Webhook Specific -->
        {#if trigger.trigger_type === "webhook"}
          <!-- Headers -->
          <div class="space-y-3">
            <Label>请求头</Label>
            <div class="space-y-2">
              {#each trigger.trigger_meta.headers as header, index}
                <div class="flex gap-2">
                  <Input bind:value={header.key} placeholder="请求头键" class="flex-1" />
                  <Input bind:value={header.value} placeholder="请求头值" class="flex-1" />
                  <Button variant="ghost" size="icon" onclick={() => removeHeader(index)}>
                    <XIcon class="size-4" />
                  </Button>
                </div>
              {/each}
            </div>
            <Button variant="outline" size="sm" onclick={addHeader}>
              <PlusIcon class="size-4" />
              添加请求头
            </Button>
          </div>

          <!-- Custom Body -->
          <div class="space-y-3">
            <div>
              <Label>自定义 Webhook 正文</Label>
              <p class="text-muted-foreground text-sm">覆盖默认 JSON 载荷</p>
            </div>
            <p class="text-muted-foreground text-xs">
              可以使用 Mustache 变量，例如 <code class="bg-muted rounded px-1">{"{{variable}}"}</code>。可用变量：
              alert_id, alert_name, alert_for, alert_value, alert_status, alert_severity, alert_message, alert_source,
              alert_timestamp, alert_cta_url, alert_cta_text, alert_incident_id, alert_incident_url,
              alert_failure_threshold, alert_success_threshold, is_resolved, is_triggered, site_url, site_name,
              site_logo_url, colors_up, colors_down, colors_degraded, colors_maintenance
            </p>
            <div class="overflow-hidden rounded-md border">
              <Textarea bind:value={trigger.trigger_meta.webhook_body} />
            </div>
          </div>
        {/if}

        <!-- Discord Specific -->
        {#if trigger.trigger_type === "discord"}
          <div class="space-y-3">
            <div>
              <Label>自定义 Discord 载荷</Label>
              <p class="text-muted-foreground text-sm">覆盖默认 Discord 消息</p>
            </div>
            <p class="text-muted-foreground text-xs">
              可以使用 Mustache 变量。可用变量：alert_id, alert_name, alert_for, alert_value, alert_status,
              alert_severity, alert_message, alert_source, alert_timestamp, alert_cta_url, alert_cta_text,
              alert_incident_id, alert_incident_url, alert_failure_threshold, alert_success_threshold, is_resolved,
              is_triggered, site_url, site_name, site_logo_url, colors_up, colors_down, colors_degraded,
              colors_maintenance
            </p>
            <div class="overflow-hidden rounded-md border">
              <Textarea bind:value={trigger.trigger_meta.discord_body} />
            </div>
          </div>
        {/if}

        <!-- Slack Specific -->
        {#if trigger.trigger_type === "slack"}
          <div class="space-y-3">
            <div>
              <Label>自定义 Slack 载荷</Label>
              <p class="text-muted-foreground text-sm">覆盖默认 Slack 消息</p>
            </div>
            <p class="text-muted-foreground text-xs">
              可以使用 Mustache 变量。可用变量：alert_id, alert_name, alert_for, alert_value, alert_status,
              alert_severity, alert_message, alert_source, alert_timestamp, alert_cta_url, alert_cta_text,
              alert_incident_id, alert_incident_url, alert_failure_threshold, alert_success_threshold, is_resolved,
              is_triggered, site_url, site_name, site_logo_url, colors_up, colors_down, colors_degraded,
              colors_maintenance
            </p>
            <div class="overflow-hidden rounded-md border">
              <Textarea bind:value={trigger.trigger_meta.slack_body} />
            </div>
          </div>
        {/if}

        <!-- Email Specific -->
        {#if trigger.trigger_type === "email"}
          <!-- Email Recipients -->
          {#if page.data.canSendEmail === false}
            <Alert.Root variant="destructive">
              <AlertCircleIcon />
              <Alert.Title>电子邮件尚未配置</Alert.Title>
              <Alert.Description>
                <p>
                  请查看电子邮件设置文档，点击<a
                    class="underline"
                    href={clientResolver(resolve, "https://kener.ing/docs/v4/setup/email-setup")}>这里</a
                  >。
                </p>
              </Alert.Description>
            </Alert.Root>
          {/if}
          <div class="space-y-2">
            <Label for="email-to">
              收件人（用逗号分隔）<span class="text-destructive">*</span>
            </Label>
            <Input
              id="email-to"
              bind:value={trigger.trigger_meta.to}
              placeholder="john@example.com, jane@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="email-from">
              发件人 <span class="text-destructive">*</span>
            </Label>
            <Input id="email-from" bind:value={trigger.trigger_meta.from} placeholder="告警 <alert@example.com>" />
            <p class="text-muted-foreground text-xs">格式：名称 &lt;email@example.com&gt;</p>
          </div>

          <!-- Custom Email Template -->
          <div class="space-y-3">
            <div>
              <Label>自定义 HTML 模板</Label>
              <p class="text-muted-foreground text-sm">创建自己的电子邮件样式</p>
            </div>
            <p class="text-muted-foreground text-xs">
              可以使用 Mustache 变量。可用变量：alert_id, alert_name, alert_for, alert_value, alert_status,
              alert_severity, alert_message, alert_source, alert_timestamp, alert_cta_url, alert_cta_text,
              alert_incident_id, alert_incident_url, alert_failure_threshold, alert_success_threshold, is_resolved,
              is_triggered, site_url, site_name, site_logo_url, colors_up, colors_down, colors_degraded,
              colors_maintenance
            </p>
            <div class="overflow-hidden rounded-md border">
              <CodeMirror
                extensions={adminEditorExtensions}
                bind:value={trigger.trigger_meta.email_body}
                lang={html()}
                theme={mode.current === "dark" ? githubDark : githubLight}
                styles={{ "&": { width: "100%", height: "400px" } }}
              />
            </div>
          </div>
        {/if}
      </Card.Content>
      <Card.Footer class="flex justify-end gap-2">
        {#if !isNew}
          <Button variant="outline" onclick={testTrigger} disabled={testing === "loading"}>
            {#if testing === "loading"}
              <Loader class="size-4 animate-spin" />
            {:else if testing === "success"}
              <CheckIcon class="size-4 text-green-500" />
            {:else if testing === "error"}
              <XIcon class="size-4 text-red-500" />
            {/if}
            测试触发器
          </Button>
        {/if}
        <Button onclick={saveTrigger} disabled={saving}>
          {#if saving}
            <Loader class="size-4 animate-spin" />
          {:else}
            <SaveIcon class="size-4" />
          {/if}
          {isNew ? "创建触发器" : "保存触发器"}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Delete Trigger Card -->
    {#if !isNew}
      <Card.Root class="border-destructive">
        <Card.Header>
          <Card.Title class="text-destructive">危险操作</Card.Title>
          <Card.Description>永久删除此触发器。此操作无法撤销。</Card.Description>
        </Card.Header>
        <Card.Content>
          <p class="text-muted-foreground text-sm">删除此触发器也会将其从所有使用它的告警配置中移除。</p>
        </Card.Content>
        <Card.Footer class="flex justify-end">
          <Button variant="destructive" onclick={() => (deleteDialogOpen = true)}>
            <Trash2Icon class="size-4" />
            删除触发器
          </Button>
        </Card.Footer>
      </Card.Root>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>删除触发器</AlertDialog.Title>
      <AlertDialog.Description>此操作无法撤销，将永久删除此触发器并将其从所有告警配置中移除。</AlertDialog.Description>
    </AlertDialog.Header>
    <div class="space-y-4 py-4">
      <p class="text-sm">
        要确认删除，请在下方输入 <span class="bg-muted rounded px-1.5 py-0.5 font-mono text-sm">{trigger.name}</span>：
      </p>
      <Input bind:value={deleteConfirmName} placeholder="输入触发器名称以确认" />
    </div>
    <AlertDialog.Footer>
      <AlertDialog.Cancel
        disabled={isDeleting}
        onclick={() => {
          deleteConfirmName = "";
        }}>取消</AlertDialog.Cancel
      >
      <Button variant="destructive" onclick={deleteTrigger} disabled={isDeleting || deleteConfirmName !== trigger.name}>
        {#if isDeleting}
          <Loader class="size-4 animate-spin" />
        {:else}
          <Trash2Icon class="size-4" />
        {/if}
        删除触发器
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
