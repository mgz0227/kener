<script lang="ts">
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Breadcrumb from "$lib/components/ui/breadcrumb/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { toast } from "svelte-sonner";
  import Loader from "@lucide/svelte/icons/loader";
  import SaveIcon from "@lucide/svelte/icons/save";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import XIcon from "@lucide/svelte/icons/x";
  import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";
  import ArrowDownIcon from "@lucide/svelte/icons/arrow-down";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import ImageIcon from "@lucide/svelte/icons/image";
  import TrashIcon from "@lucide/svelte/icons/trash";
  import type { PageRecord, MonitorRecord, PageSettingsType } from "$lib/server/types/db.js";
  import { mode } from "mode-watcher";
  import CodeMirror from "svelte-codemirror-editor";
  import { adminEditorExtensions } from "$lib/client/admin-editor.js";
  import { onMount } from "svelte";
  import { markdown } from "@codemirror/lang-markdown";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import GC from "$lib/global-constants.js";

  // Default page settings
  const defaultPageSettings: PageSettingsType = {
    monitor_status_history_days: {
      desktop: GC.DEFAULT_STATUS_HISTORY_DAYS_DESKTOP,
      mobile: GC.DEFAULT_STATUS_HISTORY_DAYS_MOBILE
    },
    monitor_layout_style: GC.DEFAULT_MONITOR_LAYOUT_STYLE
  };

  interface PageWithMonitors extends PageRecord {
    monitors?: { monitor_tag: string }[];
  }

  // Get page ID from URL params
  const pageId = $derived(page.params.page_id);
  const isNew = $derived(pageId === "new");

  // State
  let loading = $state(true);
  let saving = $state(false);
  let savingMonitors = $state(false);
  let uploadingLogo = $state(false);
  let uploadingSocialPreview = $state(false);

  // Page data
  let currentPage = $state<PageWithMonitors | null>(null);
  let monitors = $state<MonitorRecord[]>([]);

  // Form state
  let formData = $state({
    page_path: "",
    page_title: "",
    page_header: "",
    page_subheader: "",
    page_logo: ""
  });

  // Monitor selection
  let selectedMonitorTag = $state("");
  let selectedMonitors = $state<string[]>([]);
  let addingMonitor = $state(false);
  let removingMonitor = $state<string | null>(null);
  let reordering = $state(false);

  // Delete state
  let deleteConfirmText = $state("");
  let deleting = $state(false);
  const canDelete = $derived(
    !isNew &&
      currentPage &&
      currentPage.page_path !== "" &&
      deleteConfirmText === `删除 ${currentPage?.page_path || "home"}`
  );

  // Page settings state
  let pageSettings = $state<PageSettingsType>(structuredClone(defaultPageSettings));
  const isHistoryDesktopValid = $derived(
    Number.isInteger(pageSettings.monitor_status_history_days.desktop) &&
      pageSettings.monitor_status_history_days.desktop >= GC.STATUS_HISTORY_DAYS_MIN &&
      pageSettings.monitor_status_history_days.desktop <= GC.STATUS_HISTORY_DAYS_MAX
  );
  const isHistoryMobileValid = $derived(
    Number.isInteger(pageSettings.monitor_status_history_days.mobile) &&
      pageSettings.monitor_status_history_days.mobile >= GC.STATUS_HISTORY_DAYS_MIN &&
      pageSettings.monitor_status_history_days.mobile <= GC.STATUS_HISTORY_DAYS_MAX
  );
  let savingDisplaySettings = $state(false);
  let savingSeoSettings = $state(false);

  // Validation
  const isFormValid = $derived(formData.page_title.trim().length > 0 && formData.page_header.trim().length > 0);

  async function fetchPage() {
    if (isNew) {
      loading = false;
      return;
    }

    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getPages" })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
        goto(clientResolver(resolve, "/manage/app/pages"));
        return;
      }

      const foundPage = result.find((p: PageWithMonitors) => p.id === parseInt(pageId || "0"));
      if (foundPage) {
        currentPage = foundPage;
        formData = {
          page_path: foundPage.page_path,
          page_title: foundPage.page_title,
          page_header: foundPage.page_header,
          page_subheader: foundPage.page_subheader || "",
          page_logo: foundPage.page_logo || ""
        };
        selectedMonitors = foundPage.monitors?.map((m: { monitor_tag: string }) => m.monitor_tag) || [];
        // Load page settings with defaults
        if (foundPage.page_settings_json) {
          try {
            const parsed =
              typeof foundPage.page_settings_json === "string"
                ? JSON.parse(foundPage.page_settings_json)
                : foundPage.page_settings_json;
            pageSettings = { ...structuredClone(defaultPageSettings), ...parsed };
          } catch {
            pageSettings = structuredClone(defaultPageSettings);
          }
        } else {
          pageSettings = structuredClone(defaultPageSettings);
        }
      } else {
        toast.error("未找到页面");
        goto(clientResolver(resolve, "/manage/app/pages"));
      }
    } catch (e) {
      toast.error("加载页面失败");
      goto(clientResolver(resolve, "/manage/app/pages"));
    } finally {
      loading = false;
    }
  }

  async function fetchMonitors() {
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getMonitors", data: {} })
      });
      const result = await response.json();
      if (!result.error) {
        monitors = result;
      }
    } catch (e) {
      console.error("获取监控项失败", e);
    }
  }

  async function savePage() {
    if (!isFormValid) return;

    saving = true;
    try {
      const action = isNew ? "createPage" : "updatePage";
      // Make page_path URL-friendly: lowercase, replace spaces with hyphens, remove special chars
      const sanitizedPath = formData.page_path
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9_-]/g, "");
      const data: Record<string, unknown> = {
        page_path: sanitizedPath,
        page_title: formData.page_title,
        page_header: formData.page_header,
        page_subheader: formData.page_subheader || null,
        page_logo: formData.page_logo || null
      };

      if (!isNew && currentPage) {
        data.id = currentPage.id;
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
        toast.success(isNew ? "页面创建成功" : "页面更新成功");
        if (isNew && result.id) {
          // Navigate to the newly created page
          goto(clientResolver(resolve, `/manage/app/pages/${result.id}`));
        } else if (isNew) {
          // Fallback: go back to pages list
          goto(clientResolver(resolve, "/manage/app/pages"));
        }
      }
    } catch (e) {
      toast.error(isNew ? "创建页面失败" : "更新页面失败");
    } finally {
      saving = false;
    }
  }

  async function addMonitorToPage() {
    if (!currentPage || !selectedMonitorTag) return;

    addingMonitor = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addMonitorToPage",
          data: {
            page_id: currentPage.id,
            monitor_tag: selectedMonitorTag
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控项已添加到页面");
        selectedMonitors = [...selectedMonitors, selectedMonitorTag];
        selectedMonitorTag = "";
      }
    } catch (e) {
      toast.error("添加监控项失败");
    } finally {
      addingMonitor = false;
    }
  }

  async function deletePage() {
    if (!currentPage || !canDelete) return;

    deleting = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deletePage",
          data: { id: currentPage.id }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("页面已删除");
        goto(clientResolver(resolve, "/manage/app/pages"));
      }
    } catch (e) {
      toast.error("删除页面失败");
    } finally {
      deleting = false;
    }
  }

  async function removeMonitorFromPage(monitorTag: string) {
    if (!currentPage) return;

    removingMonitor = monitorTag;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "removeMonitorFromPage",
          data: {
            page_id: currentPage.id,
            monitor_tag: monitorTag
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("监控项已从页面移除");
        selectedMonitors = selectedMonitors.filter((t) => t !== monitorTag);
      }
    } catch (e) {
      toast.error("移除监控项失败");
    } finally {
      removingMonitor = null;
    }
  }

  // Get available monitors (not already on the current page)
  const availableMonitors = $derived(monitors.filter((m) => !selectedMonitors.includes(m.tag)));

  async function moveMonitor(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= selectedMonitors.length) return;

    const updated = [...selectedMonitors];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    selectedMonitors = updated;

    if (!currentPage) return;
    reordering = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reorderPageMonitors",
          data: {
            page_id: currentPage.id,
            monitor_tags: selectedMonitors
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      }
    } catch (e) {
      toast.error("调整监控项顺序失败");
    } finally {
      reordering = false;
    }
  }

  // Image upload functions
  async function handleLogoUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("文件类型无效，允许：PNG、JPG、SVG、WebP");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > GC.MAX_UPLOAD_BYTES) {
      toast.error(`文件过大，最大为 ${GC.MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
      return;
    }

    uploadingLogo = true;

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
            maxWidth: 256,
            maxHeight: 256,
            prefix: "page_logo_"
          }
        })
      });

      if (!response.ok) {
        toast.error("上传徽标失败");
        return;
      }
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        formData.page_logo = result.url;
        toast.success("徽标上传成功");
      }
    } catch (e) {
      toast.error("上传徽标失败");
    } finally {
      uploadingLogo = false;
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

  function clearLogo() {
    formData.page_logo = "";
  }

  function clearSocialPreview() {
    pageSettings.socialPagePreviewImage = "";
  }

  async function handleSocialPreviewUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("文件类型无效，允许：PNG、JPG、WebP");
      return;
    }

    if (file.size > GC.MAX_UPLOAD_BYTES) {
      toast.error(`文件过大，最大为 ${GC.MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
      return;
    }

    uploadingSocialPreview = true;
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
            maxWidth: 1200,
            maxHeight: 630,
            prefix: "page_social_"
          }
        })
      });

      if (!response.ok) {
        toast.error("上传社交预览图失败");
        return;
      }
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        pageSettings.socialPagePreviewImage = result.url;
        toast.success("社交预览图已上传");
      }
    } catch (e) {
      toast.error("上传社交预览图失败");
    } finally {
      uploadingSocialPreview = false;
      input.value = "";
    }
  }

  async function savePageSettings(source: "display" | "seo") {
    if (!currentPage) return;

    if (source === "display" && (!isHistoryDesktopValid || !isHistoryMobileValid)) {
      toast.error(`天数必须是 ${GC.STATUS_HISTORY_DAYS_MIN} 到 ${GC.STATUS_HISTORY_DAYS_MAX} 之间的整数`);
      return;
    }

    if (source === "display") savingDisplaySettings = true;
    else savingSeoSettings = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePage",
          data: {
            id: currentPage.id,
            page_settings_json: JSON.stringify(pageSettings)
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("页面设置已保存");
      }
    } catch (e) {
      toast.error("保存页面设置失败");
    } finally {
      if (source === "display") savingDisplaySettings = false;
      else savingSeoSettings = false;
    }
  }

  onMount(() => {
    void fetchPage();
    void fetchMonitors();
  });
</script>

<div class="container space-y-6 py-6">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="size-8" />
    </div>
  {:else}
    <!-- Breadcrumb & Header -->
    <div class="flex items-center justify-between">
      <Breadcrumb.Root>
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link href={clientResolver(resolve, "/manage/app/pages")}>页面</Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page>{isNew ? "新建页面" : currentPage?.page_title || "编辑页面"}</Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
      <div>
        {#if !isNew}
          <Button
            variant="outline"
            target="_blank"
            size="sm"
            href={clientResolver(resolve, `/${currentPage?.page_path}`)}
          >
            查看
          </Button>
        {/if}
      </div>
    </div>

    <!-- General Information Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>基本信息</Card.Title>
        <Card.Description>
          {isNew ? "创建新的状态页" : "更新页面设置"}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Path -->
        <div class="space-y-2">
          <Label for="page-path">
            路径 <span class="text-destructive">*</span>
          </Label>
          <Input
            id="page-path"
            type="text"
            bind:value={formData.page_path}
            disabled={!isNew && currentPage?.page_path === ""}
          />
          <p class="text-muted-foreground text-xs">
            {!isNew && currentPage?.page_path === ""
              ? "首页路径无法修改"
              : "页面的 URL 路径（例如 services、infrastructure），系统会自动转换为适合 URL 的格式。"}
          </p>
        </div>

        <!-- Title -->
        <div class="space-y-2">
          <Label for="page-title">
            标题 <span class="text-destructive">*</span>
          </Label>
          <Input id="page-title" type="text" bind:value={formData.page_title} placeholder="服务状态" />
          <p class="text-muted-foreground text-xs">浏览器标签页中显示的页面标题</p>
        </div>

        <!-- Header -->
        <div class="space-y-2">
          <Label for="page-header">
            页头标题 <span class="text-destructive">*</span>
          </Label>
          <Input id="page-header" type="text" bind:value={formData.page_header} placeholder="服务状态" />
          <p class="text-muted-foreground text-xs">页面中显示的主标题</p>
        </div>

        <!-- Subheader -->
        <div class="space-y-2">
          <Label for="page-subheader">页面内容</Label>
          <div class="overflow-hidden rounded-md border">
            <CodeMirror
              extensions={adminEditorExtensions}
              bind:value={formData.page_subheader}
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
          <p class="text-muted-foreground text-xs">支持 Markdown，可选内容将显示在页头标题下方。</p>
        </div>

        <!-- Logo Upload -->
        <div class="space-y-2">
          <Label>页面徽标</Label>
          <div class="flex items-start gap-4">
            <div class="bg-muted flex h-16 w-16 items-center justify-center rounded-lg border">
              {#if formData.page_logo}
                <img
                  src={clientResolver(resolve, formData.page_logo)}
                  alt="徽标"
                  class="max-h-14 max-w-14 object-contain"
                />
              {:else}
                <ImageIcon class="text-muted-foreground h-6 w-6" />
              {/if}
            </div>
            <div class="flex flex-1 flex-col gap-2">
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingLogo}
                  onclick={() => document.getElementById("page-logo-input")?.click()}
                >
                  {#if uploadingLogo}
                    <Loader class="h-4 w-4 animate-spin" />
                    正在上传...
                  {:else}
                    <UploadIcon class="h-4 w-4" />
                    上传
                  {/if}
                </Button>
                <input
                  id="page-logo-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp,image/heic,image/heif"
                  class="hidden"
                  onchange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
                {#if formData.page_logo}
                  <Button variant="ghost" size="sm" onclick={clearLogo}>
                    <XIcon class="h-4 w-4" />
                  </Button>
                {/if}
              </div>
              <p class="text-muted-foreground text-xs">可选的页面徽标（最大 256x256 像素）</p>
            </div>
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={savePage} disabled={saving || !isFormValid}>
          {#if saving}
            <Loader class="h-4 w-4 animate-spin" />
            {isNew ? "正在创建..." : "正在保存..."}
          {:else}
            <SaveIcon class="h-4 w-4" />
            {isNew ? "创建页面" : "保存更改"}
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Monitors Card (only shown for existing pages) -->
    {#if !isNew && currentPage}
      <Card.Root>
        <Card.Header>
          <Card.Title>页面监控项</Card.Title>
          <Card.Description>选择要在此页面显示的监控项</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <!-- Add Monitor -->
          <div class="flex gap-2">
            <Select.Root type="single" bind:value={selectedMonitorTag}>
              <Select.Trigger class="flex-1">
                {#if selectedMonitorTag}
                  {monitors.find((m) => m.tag === selectedMonitorTag)?.name || selectedMonitorTag}
                {:else}
                  选择要添加的监控项
                {/if}
              </Select.Trigger>
              <Select.Content>
                {#each availableMonitors as monitor (monitor.tag)}
                  <Select.Item value={monitor.tag}>{monitor.name} ({monitor.tag})</Select.Item>
                {/each}
                {#if availableMonitors.length === 0}
                  <div class="text-muted-foreground px-2 py-1 text-sm">没有可添加的监控项</div>
                {/if}
              </Select.Content>
            </Select.Root>
            <Button onclick={addMonitorToPage} disabled={addingMonitor || !selectedMonitorTag}>
              {#if addingMonitor}
                <Loader class="h-4 w-4 animate-spin" />
              {:else}
                <PlusIcon class="h-4 w-4" />
                添加
              {/if}
            </Button>
          </div>

          <!-- Current Monitors -->
          <div class="space-y-2">
            <Label>当前监控项</Label>
            {#if selectedMonitors.length > 0}
              <div class="space-y-2">
                {#each selectedMonitors as monitorTag, i (monitorTag)}
                  {@const monitor = monitors.find((m) => m.tag === monitorTag)}
                  <div class="bg-muted flex items-center justify-between rounded-lg p-3">
                    <div>
                      <p class="font-medium">{monitor?.name || monitorTag}</p>
                      <p class="text-muted-foreground text-xs">{monitorTag}</p>
                    </div>
                    <div class="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => moveMonitor(i, "up")}
                        disabled={i === 0 || reordering}
                      >
                        <ArrowUpIcon class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => moveMonitor(i, "down")}
                        disabled={i === selectedMonitors.length - 1 || reordering}
                      >
                        <ArrowDownIcon class="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onclick={() => removeMonitorFromPage(monitorTag)}
                        disabled={removingMonitor === monitorTag}
                      >
                        {#if removingMonitor === monitorTag}
                          <Loader class="h-4 w-4 animate-spin" />
                        {:else}
                          <XIcon class="h-4 w-4" />
                        {/if}
                      </Button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-muted-foreground bg-muted rounded-lg p-4 text-center text-sm">此页面尚未添加监控项</div>
            {/if}
          </div>
        </Card.Content>
      </Card.Root>

      <!-- Page Settings Card -->
      <Card.Root>
        <Card.Header>
          <Card.Title>显示设置</Card.Title>
          <Card.Description>配置此状态页显示的内容</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-6">
          <!-- Monitor Status History Days -->
          <div class="space-y-4">
            <div>
              <Label class="text-base font-medium">监控状态历史</Label>
              <p class="text-muted-foreground text-sm">配置状态页显示多少天的状态历史</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="history-desktop">桌面端（天）</Label>
                <Input
                  id="history-desktop"
                  type="number"
                  step="1"
                  min={GC.STATUS_HISTORY_DAYS_MIN}
                  max={GC.STATUS_HISTORY_DAYS_MAX}
                  bind:value={pageSettings.monitor_status_history_days.desktop}
                  class={isHistoryDesktopValid ? "" : "border-destructive"}
                />
                <p class="text-muted-foreground text-xs">桌面屏幕显示的天数</p>
              </div>
              <div class="space-y-2">
                <Label for="history-mobile">移动端（天）</Label>
                <Input
                  id="history-mobile"
                  type="number"
                  step="1"
                  min={GC.STATUS_HISTORY_DAYS_MIN}
                  max={GC.STATUS_HISTORY_DAYS_MAX}
                  bind:value={pageSettings.monitor_status_history_days.mobile}
                  class={isHistoryMobileValid ? "" : "border-destructive"}
                />
                <p class="text-muted-foreground text-xs">移动屏幕显示的天数</p>
              </div>
            </div>
          </div>

          <hr class="border-muted" />

          <!-- Monitor Layout Style -->
          <div class="space-y-4">
            <div>
              <Label class="text-base font-medium">监控项布局样式</Label>
              <p class="text-muted-foreground text-sm">选择监控项在状态页中的显示方式</p>
            </div>
            <Select.Root type="single" bind:value={pageSettings.monitor_layout_style}>
              <Select.Trigger class="w-full">
                {#if pageSettings.monitor_layout_style === "default-list"}
                  默认列表
                {:else if pageSettings.monitor_layout_style === "default-grid"}
                  默认网格
                {:else if pageSettings.monitor_layout_style === "compact-list"}
                  紧凑列表
                {:else}
                  紧凑网格
                {/if}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="default-list">默认列表</Select.Item>
                <Select.Item value="default-grid">默认网格</Select.Item>
                <Select.Item value="compact-list">紧凑列表</Select.Item>
                <Select.Item value="compact-grid">紧凑网格</Select.Item>
              </Select.Content>
            </Select.Root>
            <p class="text-muted-foreground text-xs">
              默认值为 <code class="bg-muted rounded px-1 font-mono">default-list</code>
            </p>
          </div>
        </Card.Content>
        <Card.Footer class="flex justify-end">
          <Button onclick={() => savePageSettings("display")} disabled={savingDisplaySettings}>
            {#if savingDisplaySettings}
              <Loader class="h-4 w-4 animate-spin" />
              正在保存...
            {:else}
              <SaveIcon class="h-4 w-4" />
              保存显示设置
            {/if}
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Social Preview & SEO Card -->
      <Card.Root>
        <Card.Header>
          <Card.Title>社交预览和 SEO</Card.Title>
          <Card.Description>配置此页面的社交预览图和元标签，留空则使用站点默认值。</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-4">
          <div class="flex items-start gap-4">
            <!-- Preview -->
            <div class="bg-muted flex h-32 w-64 items-center justify-center rounded-lg border">
              {#if pageSettings.socialPagePreviewImage}
                <img
                  src={clientResolver(resolve, pageSettings.socialPagePreviewImage)}
                  alt="社交预览"
                  class="h-full w-full rounded-lg object-cover"
                />
              {:else}
                <ImageIcon class="text-muted-foreground h-8 w-8" />
              {/if}
            </div>

            <!-- Upload Controls -->
            <div class="flex flex-1 flex-col gap-2">
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploadingSocialPreview}
                  onclick={() => document.getElementById("page-social-preview-input")?.click()}
                >
                  {#if uploadingSocialPreview}
                    <Loader class="h-4 w-4 animate-spin" />
                    正在上传...
                  {:else}
                    <UploadIcon class="h-4 w-4" />
                    上传社交预览图
                  {/if}
                </Button>
                <input
                  id="page-social-preview-input"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                  class="hidden"
                  onchange={handleSocialPreviewUpload}
                  disabled={uploadingSocialPreview}
                />
                {#if pageSettings.socialPagePreviewImage}
                  <Button variant="ghost" size="sm" onclick={clearSocialPreview}>
                    <XIcon class="h-4 w-4" />
                  </Button>
                {/if}
              </div>
              {#if pageSettings.socialPagePreviewImage}
                <p class="text-muted-foreground truncate text-xs">{pageSettings.socialPagePreviewImage}</p>
              {:else}
                <p class="text-muted-foreground text-xs">可选，留空则使用站点默认值。</p>
              {/if}
            </div>
          </div>

          <div class="space-y-2">
            <Label for="page-metaPageTitle">Meta 标题</Label>
            <Input
              id="page-metaPageTitle"
              type="text"
              bind:value={pageSettings.metaPageTitle}
              placeholder="搜索引擎使用的自定义页面标题"
            />
            <p class="text-muted-foreground text-xs">覆盖搜索结果中的默认页面标题</p>
          </div>
          <div class="space-y-2">
            <Label for="page-metaPageDescription">Meta 描述</Label>
            <Textarea
              id="page-metaPageDescription"
              bind:value={pageSettings.metaPageDescription}
              placeholder="搜索引擎使用的自定义描述"
              rows={3}
            />
            <p class="text-muted-foreground text-xs">作为搜索结果中的摘要文字显示</p>
          </div>
        </Card.Content>
        <Card.Footer class="flex justify-end">
          <Button onclick={() => savePageSettings("seo")} disabled={savingSeoSettings}>
            {#if savingSeoSettings}
              <Loader class="h-4 w-4 animate-spin" />
              正在保存...
            {:else}
              <SaveIcon class="h-4 w-4" />
              保存
            {/if}
          </Button>
        </Card.Footer>
      </Card.Root>

      <!-- Danger Zone Card (only for non-home pages) -->
      {#if currentPage.page_path !== ""}
        <Card.Root class="border-destructive">
          <Card.Header>
            <Card.Title class="text-destructive">危险操作</Card.Title>
            <Card.Description>对该页面执行不可撤销的操作</Card.Description>
          </Card.Header>
          <Card.Content class="space-y-4">
            <div class="space-y-2">
              <Label for="delete-confirm">删除页面</Label>
              <p class="text-muted-foreground text-sm">页面删除后无法恢复，请确认后再操作。</p>
              <p class="text-muted-foreground text-sm">
                输入 <code class="bg-muted rounded px-1 font-mono">删除 {currentPage.page_path || "home"}</code> 以确认：
              </p>
              <Input
                id="delete-confirm"
                type="text"
                bind:value={deleteConfirmText}
                placeholder="删除 {currentPage.page_path || 'home'}"
              />
            </div>
          </Card.Content>
          <Card.Footer class="flex justify-end">
            <Button variant="destructive" onclick={deletePage} disabled={!canDelete || deleting}>
              {#if deleting}
                <Loader class="h-4 w-4 animate-spin" />
                正在删除...
              {:else}
                <TrashIcon class="h-4 w-4" />
                删除页面
              {/if}
            </Button>
          </Card.Footer>
        </Card.Root>
      {/if}
    {/if}
  {/if}
</div>
