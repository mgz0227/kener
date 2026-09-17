<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
  import GC from "$lib/global-constants.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import Loader from "@lucide/svelte/icons/loader";
  import UploadIcon from "@lucide/svelte/icons/upload";
  import XIcon from "@lucide/svelte/icons/x";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Plus from "@lucide/svelte/icons/plus";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import { onMount } from "svelte";
  import { toast } from "svelte-sonner";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";
  import { page } from "$app/state";
  import type {
    DataRetentionPolicy,
    EventDisplaySettings,
    GlobalPageVisibilitySettings,
    SitemapXMLConfig,
    GlobalMaintenanceNotificationSettings
  } from "$lib/types/site.js";
  interface NavItem {
    name: string;
    url: string;
    iconURL: string;
    uploading?: boolean;
  }

  // Form state
  let loading = $state(true);
  let savingSiteInfo = $state(false);
  let savingLogo = $state(false);
  let savingFavicon = $state(false);
  let savingSocialPreviewImage = $state(false);
  let savingNav = $state(false);
  let savingSubMenuOptions = $state(false);
  let savingGlobalPageVisibilitySettings = $state(false);
  let savingDataRetentionPolicy = $state(false);
  let savingEventDisplaySettings = $state(false);
  let savingSitemap = $state(false);
  let savingMaintenanceNotificationSettings = $state(false);
  let uploadingLogo = $state(false);
  let uploadingFavicon = $state(false);
  let uploadingSocialPreviewImage = $state(false);

  const defaultEventDisplaySettings: EventDisplaySettings = page.data.seedSiteData.eventDisplaySettings;

  interface SiteDataForm {
    siteName: string;
    siteURL: string;
    logo: string;
    favicon: string;
    socialPreviewImage: string | null;
  }

  // Site data
  let siteData = $state<SiteDataForm>({
    siteName: "",
    siteURL: "",
    logo: "",
    favicon: "",
    socialPreviewImage: null
  });

  // Navigation data
  let nav = $state<NavItem[]>([]);

  // Sub Menu Options
  let subMenuOptions = $state({
    showShareBadgeMonitor: true,
    showShareEmbedMonitor: true,
    showRssFeed: true
  });

  const defaultGlobalPageVisibilitySettings: GlobalPageVisibilitySettings =
    page.data.seedSiteData.globalPageVisibilitySettings;

  let globalPageVisibilitySettings = $state<GlobalPageVisibilitySettings>(
    structuredClone(defaultGlobalPageVisibilitySettings)
  );

  let dataRetentionPolicy = $state<DataRetentionPolicy>(page.data.seedSiteData.dataRetentionPolicy);

  let eventDisplaySettings = $state<EventDisplaySettings>(structuredClone(defaultEventDisplaySettings));
  let metaSiteTitle = $state("");
  let metaSiteDescription = $state("");

  const defaultSitemap: SitemapXMLConfig = page.data.seedSiteData.sitemap;
  let sitemap = $state<SitemapXMLConfig>(structuredClone(defaultSitemap));

  const defaultMaintenanceNotificationSettings: GlobalMaintenanceNotificationSettings =
    page.data.seedSiteData.globalMaintenanceNotificationSettings;
  let maintenanceNotificationSettings = $state<GlobalMaintenanceNotificationSettings>(
    structuredClone(defaultMaintenanceNotificationSettings)
  );

  const sitemapURL = $derived(
    siteData.siteURL ? siteData.siteURL.replace(/\/$/, "") + clientResolver(resolve, "/sitemap.xml") : ""
  );

  let currentOrigin = $state("");

  function onForceExclusivityChange(checked: boolean | "indeterminate") {
    const enabled = checked === true;
    globalPageVisibilitySettings.forceExclusivity = enabled;
    if (enabled) {
      globalPageVisibilitySettings.showSwitcher = true;
    }
  }

  function parseOriginOnlyURL(value: string): URL | null {
    try {
      const trimmedValue = value.trim();
      if (!trimmedValue) return null;

      const url = new URL(trimmedValue);
      if (!url.hostname || !["http:", "https:"].includes(url.protocol)) return null;
      if (url.username || url.password) return null;
      if (url.pathname !== "/" || url.search || url.hash) return null;

      return url;
    } catch {
      return null;
    }
  }

  const parsedSiteOriginURL = $derived(parseOriginOnlyURL(siteData.siteURL));
  const isOriginOnlySiteURL = $derived(parsedSiteOriginURL !== null);
  const enteredSiteOrigin = $derived(parsedSiteOriginURL?.origin ?? "");
  const hasOriginMismatch = $derived(
    Boolean(currentOrigin && enteredSiteOrigin && currentOrigin !== enteredSiteOrigin)
  );

  // Validation
  const isValidSiteInfo = $derived(
    siteData.siteName.trim().length > 0 && siteData.siteURL.trim().length > 0 && isOriginOnlySiteURL
  );

  async function fetchSiteData() {
    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getAllSiteData" })
      });
      if (response.ok) {
        const data = await response.json();
        siteData = {
          siteName: data.siteName || "",
          siteURL: data.siteURL || "",
          logo: data.logo || "",
          favicon: data.favicon || "",
          socialPreviewImage: data.socialPreviewImage || null
        };
        if (data.nav) {
          nav = data.nav.map((item: NavItem) => ({
            name: item.name || "",
            url: item.url || "",
            iconURL: item.iconURL || ""
          }));
        }
        if (data.subMenuOptions) {
          subMenuOptions = {
            showShareBadgeMonitor: data.subMenuOptions.showShareBadgeMonitor ?? true,
            showShareEmbedMonitor: data.subMenuOptions.showShareEmbedMonitor ?? true,
            showRssFeed: data.subMenuOptions.showRssFeed ?? true
          };
        }

        if (data.globalPageVisibilitySettings) {
          try {
            const parsed =
              typeof data.globalPageVisibilitySettings === "string"
                ? JSON.parse(data.globalPageVisibilitySettings)
                : data.globalPageVisibilitySettings;

            globalPageVisibilitySettings = {
              ...structuredClone(defaultGlobalPageVisibilitySettings),
              ...parsed,
              showSwitcher: Boolean(parsed?.showSwitcher ?? true),
              forceExclusivity: Boolean(parsed?.forceExclusivity ?? false)
            };
          } catch {
            globalPageVisibilitySettings = structuredClone(defaultGlobalPageVisibilitySettings);
          }
        } else {
          globalPageVisibilitySettings = structuredClone(defaultGlobalPageVisibilitySettings);
        }

        dataRetentionPolicy = {
          enabled: data.dataRetentionPolicy?.enabled ?? true,
          retentionDays: data.dataRetentionPolicy?.retentionDays ?? 90
        };

        if (data.eventDisplaySettings) {
          try {
            eventDisplaySettings = parseEventDisplaySettings(data.eventDisplaySettings);
          } catch {
            eventDisplaySettings = structuredClone(defaultEventDisplaySettings);
          }
        } else {
          eventDisplaySettings = structuredClone(defaultEventDisplaySettings);
        }

        metaSiteTitle = data.metaSiteTitle || "";
        metaSiteDescription = data.metaSiteDescription || "";
        if (data.sitemap) {
          try {
            const parsed = typeof data.sitemap === "string" ? JSON.parse(data.sitemap) : data.sitemap;
            sitemap = {
              mode: parsed?.mode ?? "auto",
              urls: Array.isArray(parsed?.urls) ? parsed.urls : []
            };
          } catch {
            sitemap = structuredClone(defaultSitemap);
          }
        } else {
          sitemap = structuredClone(defaultSitemap);
        }

        if (data.globalMaintenanceNotificationSettings) {
          try {
            const parsed =
              typeof data.globalMaintenanceNotificationSettings === "string"
                ? JSON.parse(data.globalMaintenanceNotificationSettings)
                : data.globalMaintenanceNotificationSettings;
            maintenanceNotificationSettings = {
              ...structuredClone(defaultMaintenanceNotificationSettings),
              ...parsed,
              event_types: {
                ...structuredClone(defaultMaintenanceNotificationSettings.event_types),
                ...parsed?.event_types
              }
            };
          } catch {
            maintenanceNotificationSettings = structuredClone(defaultMaintenanceNotificationSettings);
          }
        } else {
          maintenanceNotificationSettings = structuredClone(defaultMaintenanceNotificationSettings);
        }
      }
    } catch (e) {
      toast.error("加载站点数据失败");
    } finally {
      loading = false;
    }
  }

  async function saveSiteInfo() {
    if (!isValidSiteInfo) return;

    savingSiteInfo = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: {
            siteName: siteData.siteName,
            siteURL: siteData.siteURL
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("站点信息已保存");
      }
    } catch (e) {
      toast.error("保存站点信息失败");
    } finally {
      savingSiteInfo = false;
    }
  }

  async function saveLogo() {
    savingLogo = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { logo: siteData.logo }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("徽标已保存");
      }
    } catch (e) {
      toast.error("保存徽标失败");
    } finally {
      savingLogo = false;
    }
  }

  async function saveFavicon() {
    savingFavicon = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { favicon: siteData.favicon }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("网站图标已保存");
      }
    } catch (e) {
      toast.error("保存网站图标失败");
    } finally {
      savingFavicon = false;
    }
  }

  async function saveSocialPreviewImage() {
    savingSocialPreviewImage = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: {
            socialPreviewImage: siteData.socialPreviewImage,
            metaSiteTitle: metaSiteTitle,
            metaSiteDescription: metaSiteDescription
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("社交预览和 SEO 设置已保存");
      }
    } catch (e) {
      toast.error("保存社交预览和 SEO 设置失败");
    } finally {
      savingSocialPreviewImage = false;
    }
  }

  async function saveNavigation() {
    savingNav = true;
    try {
      const cleanNav = nav.map((item) => ({
        name: item.name,
        url: item.url,
        iconURL: item.iconURL
      }));
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { nav: JSON.stringify(cleanNav) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("导航设置已保存");
      }
    } catch (e) {
      toast.error("保存导航设置失败");
    } finally {
      savingNav = false;
    }
  }

  async function saveSubMenuOptions() {
    savingSubMenuOptions = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { subMenuOptions: JSON.stringify(subMenuOptions) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("子菜单选项已保存");
      }
    } catch (e) {
      toast.error("保存子菜单选项失败");
    } finally {
      savingSubMenuOptions = false;
    }
  }

  async function saveGlobalPageVisibilitySettings() {
    savingGlobalPageVisibilitySettings = true;
    try {
      const payload: GlobalPageVisibilitySettings = {
        showSwitcher: globalPageVisibilitySettings.forceExclusivity ? true : globalPageVisibilitySettings.showSwitcher,
        forceExclusivity: globalPageVisibilitySettings.forceExclusivity
      };

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { globalPageVisibilitySettings: JSON.stringify(payload) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        globalPageVisibilitySettings = payload;
        toast.success("全局页面可见性设置已保存");
      }
    } catch (e) {
      toast.error("保存全局页面可见性设置失败");
    } finally {
      savingGlobalPageVisibilitySettings = false;
    }
  }

  async function saveDataRetentionPolicy() {
    savingDataRetentionPolicy = true;
    try {
      const safeRetentionDays = Math.max(1, Number(dataRetentionPolicy.retentionDays) || 90);
      const payload: DataRetentionPolicy = {
        enabled: dataRetentionPolicy.enabled,
        retentionDays: safeRetentionDays
      };

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { dataRetentionPolicy: JSON.stringify(payload) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        dataRetentionPolicy.retentionDays = safeRetentionDays;
        toast.success("数据保留策略已保存");
      }
    } catch (e) {
      toast.error("保存数据保留策略失败");
    } finally {
      savingDataRetentionPolicy = false;
    }
  }

  async function saveEventDisplaySettings() {
    savingEventDisplaySettings = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { eventDisplaySettings: JSON.stringify(eventDisplaySettings) }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("事件显示设置已保存");
      }
    } catch (e) {
      toast.error("保存事件显示设置失败");
    } finally {
      savingEventDisplaySettings = false;
    }
  }

  function parseEventDisplaySettings(value: unknown): EventDisplaySettings {
    const parsed = (typeof value === "string" ? JSON.parse(value) : value) as Partial<EventDisplaySettings> | null;
    const defaults = structuredClone(defaultEventDisplaySettings);

    return {
      showInlineEvents:
        typeof parsed?.showInlineEvents === "boolean" ? parsed.showInlineEvents : defaults.showInlineEvents,
      incidents: {
        ...defaults.incidents,
        ...parsed?.incidents,
        ongoing: {
          ...defaults.incidents.ongoing,
          ...parsed?.incidents?.ongoing
        },
        resolved: {
          ...defaults.incidents.resolved,
          ...parsed?.incidents?.resolved
        }
      },
      maintenances: {
        ...defaults.maintenances,
        ...parsed?.maintenances,
        ongoing: {
          ...defaults.maintenances.ongoing,
          ...parsed?.maintenances?.ongoing
        },
        past: {
          ...defaults.maintenances.past,
          ...parsed?.maintenances?.past
        },
        upcoming: {
          ...defaults.maintenances.upcoming,
          ...parsed?.maintenances?.upcoming
        }
      }
    };
  }

  function addSitemapUrl() {
    sitemap.urls = [...sitemap.urls, { loc: "" }];
  }

  function removeSitemapUrl(index: number) {
    sitemap.urls = sitemap.urls.filter((_, i) => i !== index);
  }

  const isValidSitemap = $derived(
    sitemap.mode !== "manual" || (sitemap.urls.length > 0 && sitemap.urls.every((u) => u.loc.trim().length > 0))
  );

  async function saveSitemap() {
    if (!isValidSitemap) return;
    savingSitemap = true;
    try {
      const payload: SitemapXMLConfig = {
        mode: sitemap.mode,
        urls:
          sitemap.mode !== "off" ? sitemap.urls.map((u) => ({ loc: u.loc.trim() })).filter((u) => u.loc.length > 0) : []
      };

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { sitemap: JSON.stringify(payload) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("站点地图设置已保存");
      }
    } catch (e) {
      toast.error("保存站点地图设置失败");
    } finally {
      savingSitemap = false;
    }
  }

  async function saveMaintenanceNotificationSettings() {
    const bufferHours = Number(maintenanceNotificationSettings.reminder_buffer_hours);
    if (!Number.isFinite(bufferHours) || bufferHours < 1) {
      toast.error("提醒提前时间必须是不小于 1 的数字");
      return;
    }
    savingMaintenanceNotificationSettings = true;
    try {
      const payload: GlobalMaintenanceNotificationSettings = {
        event_types: {
          created: maintenanceNotificationSettings.event_types.created,
          reminder: maintenanceNotificationSettings.event_types.reminder,
          started: maintenanceNotificationSettings.event_types.started,
          ended: maintenanceNotificationSettings.event_types.ended
        },
        reminder_buffer_hours: Math.max(1, Math.floor(bufferHours))
      };

      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "storeSiteData",
          data: { globalMaintenanceNotificationSettings: JSON.stringify(payload) }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        maintenanceNotificationSettings.reminder_buffer_hours = payload.reminder_buffer_hours;
        toast.success("维护通知设置已保存");
      }
    } catch (e) {
      toast.error("保存维护通知设置失败");
    } finally {
      savingMaintenanceNotificationSettings = false;
    }
  }

  async function handleImageUpload(event: Event, type: "logo" | "favicon" | "socialPreviewImage"): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("文件类型无效，允许：PNG、JPG、WebP");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > GC.MAX_UPLOAD_BYTES) {
      toast.error(`文件过大，最大为 ${GC.MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
      return;
    }

    if (type === "logo") {
      uploadingLogo = true;
    } else if (type === "favicon") {
      uploadingFavicon = true;
    } else {
      uploadingSocialPreviewImage = true;
    }

    try {
      // Convert file to base64
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
            maxWidth: type === "favicon" ? 64 : type === "socialPreviewImage" ? 640 : 256,
            maxHeight: type === "favicon" ? 64 : type === "socialPreviewImage" ? 320 : 256,
            forceDimensions: type === "socialPreviewImage",
            prefix: `${type}_`
          }
        })
      });

      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        if (type === "logo") {
          siteData.logo = result.url;
        } else if (type === "socialPreviewImage") {
          siteData.socialPreviewImage = result.url;
        } else {
          siteData.favicon = result.url;
        }
        toast.success(`${type === "logo" ? "徽标" : type === "favicon" ? "网站图标" : "社交预览图"}上传成功`);
      }
    } catch (e) {
      toast.error(`上传${type === "logo" ? "徽标" : type === "favicon" ? "网站图标" : "社交预览图"}失败`);
    } finally {
      if (type === "logo") {
        uploadingLogo = false;
      } else if (type === "favicon") {
        uploadingFavicon = false;
      } else {
        uploadingSocialPreviewImage = false;
      }
      // Reset input
      input.value = "";
    }
  }

  async function handleNavIconUpload(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 102400) {
      toast.error("文件大小应小于 100KB");
      return;
    }

    nav[index].uploading = true;
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
            maxWidth: 32,
            maxHeight: 32,
            prefix: "navicon_"
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        nav[index].iconURL = result.url;
      }
    } catch (e) {
      toast.error("上传图标失败");
    } finally {
      nav[index].uploading = false;
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URI prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  function clearImage(type: "logo" | "favicon" | "socialPreviewImage") {
    if (type === "logo") {
      siteData.logo = "";
    } else if (type === "favicon") {
      siteData.favicon = "";
    } else {
      siteData.socialPreviewImage = null;
    }
  }

  function addNavItem() {
    nav = [...nav, { name: "", url: "", iconURL: "" }];
  }

  function removeNavItem(index: number) {
    nav = nav.filter((_, i) => i !== index);
  }

  onMount(() => {
    currentOrigin = window.location.origin;
    void fetchSiteData();
  });
</script>

<div class="flex w-full flex-col gap-4 p-4">
  <!-- Breadcrumb -->

  {#if loading}
    <div class="flex items-center justify-center py-8">
      <Spinner />
    </div>
  {:else}
    <!-- Site Information Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>站点信息</Card.Title>
        <Card.Description>状态页的基本信息</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2">
          <!-- Site Name -->
          <div class="space-y-2">
            <Label for="siteName">站点名称 *</Label>
            <Input id="siteName" type="text" bind:value={siteData.siteName} placeholder="我的状态页" />
            <p class="text-muted-foreground text-xs">显示在页头和浏览器标签页中的名称</p>
          </div>

          <!-- Site URL -->
          <div class="space-y-2">
            <Label for="siteURL">站点 URL *</Label>
            <Input id="siteURL" type="url" bind:value={siteData.siteURL} placeholder="https://status.example.com" />
            {#if siteData.siteURL.trim().length > 0 && !isOriginOnlySiteURL}
              <p class="text-destructive text-xs">站点 URL 无效，请只输入协议和域名，不要包含路径、查询参数或锚点。</p>
            {/if}
            {#if siteData.siteURL.trim().length > 0 && isOriginOnlySiteURL && hasOriginMismatch}
              <p class="text-xs text-amber-600 dark:text-amber-400">
                警告：输入的源（{enteredSiteOrigin}）与当前源（{currentOrigin}）不一致。
              </p>
            {/if}
            <p class="text-muted-foreground text-xs">
              实际 URL：{(isOriginOnlySiteURL ? enteredSiteOrigin : siteData.siteURL) + clientResolver(resolve, "/")}
            </p>
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveSiteInfo} disabled={savingSiteInfo || !isValidSiteInfo} class="cursor-pointer">
          {#if savingSiteInfo}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Logo Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>站点徽标</Card.Title>
        <Card.Description>上传站点徽标（最大 256x256 像素，PNG/JPG/WebP）</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-start gap-4">
          <!-- Preview -->
          <div class="bg-muted flex h-24 w-24 items-center justify-center rounded-lg border">
            {#if siteData.logo}
              <img
                src={clientResolver(resolve, siteData.logo)}
                alt="站点徽标"
                class="max-h-20 max-w-20 object-contain"
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
                disabled={uploadingLogo}
                onclick={() => document.getElementById("logo-input")?.click()}
              >
                {#if uploadingLogo}
                  <Loader class="h-4 w-4 animate-spin" />
                  正在上传...
                {:else}
                  <UploadIcon class="h-4 w-4" />
                  上传徽标
                {/if}
              </Button>
              <input
                id="logo-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                class="hidden"
                onchange={(e) => handleImageUpload(e, "logo")}
                disabled={uploadingLogo}
              />
              {#if siteData.logo}
                <Button variant="ghost" size="icon" onclick={() => clearImage("logo")}>
                  <XIcon class="h-4 w-4" />
                </Button>
              {/if}
            </div>
            {#if siteData.logo}
              <p class="text-muted-foreground truncate text-xs">{siteData.logo}</p>
            {/if}
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveLogo} disabled={savingLogo} class="cursor-pointer">
          {#if savingLogo}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Favicon Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>网站图标</Card.Title>
        <Card.Description>上传网站图标（最大 64x64 像素，PNG/JPG/WebP）</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-start gap-4">
          <!-- Preview -->
          <div class="bg-muted flex h-16 w-16 items-center justify-center rounded-lg border">
            {#if siteData.favicon}
              <img
                src={clientResolver(resolve, siteData.favicon)}
                alt="网站图标"
                class="max-h-12 max-w-12 object-contain"
              />
            {:else}
              <ImageIcon class="text-muted-foreground h-6 w-6" />
            {/if}
          </div>

          <!-- Upload Controls -->
          <div class="flex flex-1 flex-col gap-2">
            <div class="flex gap-2">
              <Button
                variant="outline"
                disabled={uploadingFavicon}
                onclick={() => document.getElementById("favicon-input")?.click()}
              >
                {#if uploadingFavicon}
                  <Loader class="h-4 w-4 animate-spin" />
                  正在上传...
                {:else}
                  <UploadIcon class="h-4 w-4" />
                  上传网站图标
                {/if}
              </Button>
              <input
                id="favicon-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                class="hidden"
                onchange={(e) => handleImageUpload(e, "favicon")}
                disabled={uploadingFavicon}
              />
              {#if siteData.favicon}
                <Button variant="ghost" size="icon" onclick={() => clearImage("favicon")}>
                  <XIcon class="h-4 w-4" />
                </Button>
              {/if}
            </div>
            {#if siteData.favicon}
              <p class="text-muted-foreground truncate text-xs">{siteData.favicon}</p>
            {/if}
          </div>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveFavicon} disabled={savingFavicon} class="cursor-pointer">
          {#if savingFavicon}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Social Preview & SEO Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>社交预览和 SEO</Card.Title>
        <Card.Description>配置社交预览图和搜索引擎元标签</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="flex items-start gap-4">
          <!-- Preview -->
          <div class="bg-muted flex h-32 w-64 items-center justify-center rounded-lg border">
            {#if siteData.socialPreviewImage}
              <img
                src={clientResolver(resolve, siteData.socialPreviewImage)}
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
                disabled={uploadingSocialPreviewImage}
                onclick={() => document.getElementById("social-preview-image-input")?.click()}
              >
                {#if uploadingSocialPreviewImage}
                  <Loader class="h-4 w-4 animate-spin" />
                  正在上传...
                {:else}
                  <UploadIcon class="h-4 w-4" />
                  上传社交预览图
                {/if}
              </Button>
              <input
                id="social-preview-image-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                class="hidden"
                onchange={(e) => handleImageUpload(e, "socialPreviewImage")}
                disabled={uploadingSocialPreviewImage}
              />
              {#if siteData.socialPreviewImage}
                <Button variant="ghost" size="icon" onclick={() => clearImage("socialPreviewImage")}>
                  <XIcon class="h-4 w-4" />
                </Button>
              {/if}
            </div>
            {#if siteData.socialPreviewImage}
              <p class="text-muted-foreground truncate text-xs">{siteData.socialPreviewImage}</p>
            {:else}
              <p class="text-muted-foreground text-xs">可选，留空则不使用社交预览图。</p>
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          <Label for="metaSiteTitle">Meta 标题</Label>
          <Input id="metaSiteTitle" type="text" bind:value={metaSiteTitle} placeholder="搜索引擎使用的自定义页面标题" />
          <p class="text-muted-foreground text-xs">覆盖搜索结果中的默认页面标题</p>
        </div>
        <div class="space-y-2">
          <Label for="metaSiteDescription">Meta 描述</Label>
          <Textarea
            id="metaSiteDescription"
            bind:value={metaSiteDescription}
            placeholder="搜索引擎使用的自定义描述"
            rows={3}
          />
          <p class="text-muted-foreground text-xs">作为搜索结果中的摘要文字显示</p>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveSocialPreviewImage} disabled={savingSocialPreviewImage} class="cursor-pointer">
          {#if savingSocialPreviewImage}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Navigation Menu Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>导航菜单</Card.Title>
        <Card.Description>将自定义导航链接添加到状态页页眉</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        {#each nav as item, index (index)}
          <div class="flex items-end gap-2 rounded-lg border p-3">
            <div class="grid flex-1 gap-2 sm:grid-cols-3">
              <div class="space-y-1">
                <Label for="nav-name-{index}">名称</Label>
                <Input id="nav-name-{index}" type="text" bind:value={item.name} placeholder="文档" />
              </div>
              <div class="space-y-1">
                <Label for="nav-url-{index}">URL</Label>
                <Input id="nav-url-{index}" type="text" bind:value={item.url} placeholder="https://docs.example.com" />
              </div>
              <div class="space-y-1">
                <Label for="nav-icon-{index}">图标</Label>
                <div class="flex items-center gap-2">
                  {#if item.iconURL}
                    <img src={clientResolver(resolve, item.iconURL)} alt="图标" class="h-6 w-6 object-contain" />
                    <Button variant="ghost" size="sm" onclick={() => (item.iconURL = "")}>
                      <XIcon class="h-4 w-4" />
                    </Button>
                  {:else}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={item.uploading}
                      onclick={() => document.getElementById(`nav-icon-input-${index}`)?.click()}
                    >
                      {#if item.uploading}
                        <Loader class="h-4 w-4 animate-spin" />
                      {:else}
                        <UploadIcon class="h-4 w-4" />
                      {/if}
                    </Button>
                  {/if}
                  <input
                    id="nav-icon-input-{index}"
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                    class="hidden"
                    onchange={(e) => handleNavIconUpload(e, index)}
                  />
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onclick={() => removeNavItem(index)}>
              <XIcon class="h-4 w-4" />
            </Button>
          </div>
        {/each}
        <Button variant="outline" onclick={addNavItem}>
          <Plus class="h-4 w-4" />
          添加导航项
        </Button>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveNavigation} disabled={savingNav} class="cursor-pointer">
          {#if savingNav}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Sub Menu Options Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>监控器子菜单选项</Card.Title>
        <Card.Description>配置状态页监控器子菜单中显示的选项</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>分享徽章</Label>
            <p class="text-muted-foreground text-xs">显示获取可嵌入的监控器状态和可用率徽章的选项</p>
          </div>
          <Switch bind:checked={subMenuOptions.showShareBadgeMonitor} />
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>分享嵌入</Label>
            <p class="text-muted-foreground text-xs">显示获取监控器 iframe 或 script 嵌入代码的选项</p>
          </div>
          <Switch bind:checked={subMenuOptions.showShareEmbedMonitor} />
        </div>
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>RSS 订阅源</Label>
            <p class="text-muted-foreground text-xs">
              在页眉中显示 RSS 订阅源链接。订阅源本身始终可通过 /rss.xml 访问。
            </p>
          </div>
          <Switch bind:checked={subMenuOptions.showRssFeed} />
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveSubMenuOptions} disabled={savingSubMenuOptions} class="cursor-pointer">
          {#if savingSubMenuOptions}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Global Page Visibility Settings Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>全局页面可见性设置</Card.Title>
        <Card.Description>配置页面切换器的可见性以及页面关联内容的全局独占行为。</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>显示页面切换器</Label>
            <p class="text-muted-foreground text-xs">这会从菜单中隐藏页面下拉列表。</p>
          </div>
          <Switch
            bind:checked={globalPageVisibilitySettings.showSwitcher}
            disabled={globalPageVisibilitySettings.forceExclusivity}
          />
        </div>

        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>强制独占</Label>
            <p class="text-muted-foreground text-xs">
              这会将 <code>showSwitcher</code> 设为 true
              并设为只读。它还会覆盖品牌图标链接，并更新受影响监控器的日历事件。全局事件（<code>is_global=YES</code> 的事件和维护）仍会显示。
            </p>
          </div>
          <Switch checked={globalPageVisibilitySettings.forceExclusivity} onCheckedChange={onForceExclusivityChange} />
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button
          onclick={saveGlobalPageVisibilitySettings}
          disabled={savingGlobalPageVisibilitySettings}
          class="cursor-pointer"
        >
          {#if savingGlobalPageVisibilitySettings}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Data Retention Policy Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>数据保留策略</Card.Title>
        <Card.Description>配置旧监控器状态数据的自动清理</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>启用数据保留</Label>
            <p class="text-muted-foreground text-xs">自动删除早于保留天数的状态数据</p>
          </div>
          <Switch bind:checked={dataRetentionPolicy.enabled} />
        </div>

        <div class="space-y-2">
          <Label for="retention-days">保留天数</Label>
          <Input
            id="retention-days"
            type="number"
            min="1"
            bind:value={dataRetentionPolicy.retentionDays}
            disabled={!dataRetentionPolicy.enabled}
          />
          <p class="text-muted-foreground text-xs">未配置时默认为 90 天。</p>
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveDataRetentionPolicy} disabled={savingDataRetentionPolicy} class="cursor-pointer">
          {#if savingDataRetentionPolicy}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Event Display Settings Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>事件显示设置</Card.Title>
        <Card.Description>配置站点上显示的事件和维护计划</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="flex items-center justify-between rounded-lg border p-4">
          <div class="space-y-0.5">
            <Label for="events-display-inline">内联显示事件</Label>
            <p class="text-muted-foreground text-xs">启用后在状态页内联显示事件；停用后在通知列表中显示。</p>
          </div>
          <Switch id="events-display-inline" bind:checked={eventDisplaySettings.showInlineEvents} />
        </div>

        <!-- Incidents -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>事件</Label>
              <p class="text-muted-foreground text-xs">全局启用或停用事件显示</p>
            </div>
            <Switch bind:checked={eventDisplaySettings.incidents.enabled} />
          </div>

          {#if eventDisplaySettings.incidents.enabled}
            <div class="border-muted ml-4 space-y-4 border-l-2 pl-4">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>显示进行中的事件</Label>
                  <p class="text-muted-foreground text-xs">显示当前活动的事件</p>
                </div>
                <Switch bind:checked={eventDisplaySettings.incidents.ongoing.show} />
              </div>

              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>显示已解决的事件</Label>
                  <p class="text-muted-foreground text-xs">显示最近解决的事件</p>
                </div>
                <Switch bind:checked={eventDisplaySettings.incidents.resolved.show} />
              </div>

              {#if eventDisplaySettings.incidents.resolved.show}
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="events-incidents-max-count">已解决事件最大数量</Label>
                    <Input
                      id="events-incidents-max-count"
                      type="number"
                      min="1"
                      max="50"
                      bind:value={eventDisplaySettings.incidents.resolved.maxCount}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="events-incidents-days-in-past">过去天数</Label>
                    <Input
                      id="events-incidents-days-in-past"
                      type="number"
                      min="1"
                      max="90"
                      bind:value={eventDisplaySettings.incidents.resolved.daysInPast}
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <hr class="border-muted" />

        <!-- Maintenances -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div class="space-y-0.5">
              <Label>维护计划</Label>
              <p class="text-muted-foreground text-xs">全局启用或停用维护计划显示</p>
            </div>
            <Switch bind:checked={eventDisplaySettings.maintenances.enabled} />
          </div>

          {#if eventDisplaySettings.maintenances.enabled}
            <div class="border-muted ml-4 space-y-4 border-l-2 pl-4">
              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>显示进行中的维护</Label>
                  <p class="text-muted-foreground text-xs">显示当前活动的维护时段</p>
                </div>
                <Switch bind:checked={eventDisplaySettings.maintenances.ongoing.show} />
              </div>

              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>显示过去的维护</Label>
                  <p class="text-muted-foreground text-xs">显示已完成的维护时段</p>
                </div>
                <Switch bind:checked={eventDisplaySettings.maintenances.past.show} />
              </div>

              {#if eventDisplaySettings.maintenances.past.show}
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="events-maint-past-max-count">过去维护最大数量</Label>
                    <Input
                      id="events-maint-past-max-count"
                      type="number"
                      min="1"
                      max="50"
                      bind:value={eventDisplaySettings.maintenances.past.maxCount}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="events-maint-past-days-in-past">过去天数</Label>
                    <Input
                      id="events-maint-past-days-in-past"
                      type="number"
                      min="1"
                      max="90"
                      bind:value={eventDisplaySettings.maintenances.past.daysInPast}
                    />
                  </div>
                </div>
              {/if}

              <div class="flex items-center justify-between">
                <div class="space-y-0.5">
                  <Label>显示即将进行的维护</Label>
                  <p class="text-muted-foreground text-xs">显示已计划的维护时段</p>
                </div>
                <Switch bind:checked={eventDisplaySettings.maintenances.upcoming.show} />
              </div>

              {#if eventDisplaySettings.maintenances.upcoming.show}
                <div class="grid gap-4 md:grid-cols-2">
                  <div class="space-y-2">
                    <Label for="events-maint-upcoming-max-count">即将进行的维护最大数量</Label>
                    <Input
                      id="events-maint-upcoming-max-count"
                      type="number"
                      min="1"
                      max="50"
                      bind:value={eventDisplaySettings.maintenances.upcoming.maxCount}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label for="events-maint-upcoming-days-in-future">未来天数</Label>
                    <Input
                      id="events-maint-upcoming-days-in-future"
                      type="number"
                      min="1"
                      max="90"
                      bind:value={eventDisplaySettings.maintenances.upcoming.daysInFuture}
                    />
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button onclick={saveEventDisplaySettings} disabled={savingEventDisplaySettings} class="cursor-pointer">
          {#if savingEventDisplaySettings}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Sitemap Configuration Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>站点地图</Card.Title>
        <Card.Description>配置 sitemap.xml 的生成方式</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="space-y-3">
          <Label>模式</Label>
          <RadioGroup.Root
            value={sitemap.mode}
            onValueChange={(v: string) => {
              sitemap.mode = v as SitemapXMLConfig["mode"];
              if (v === "manual" && sitemap.urls.length === 0) {
                sitemap.urls = [{ loc: "" }];
              }
            }}
            class="flex flex-col gap-3"
          >
            <div class="flex items-center space-x-2">
              <RadioGroup.Item value="auto" id="sitemap-auto" />
              <Label for="sitemap-auto" class="cursor-pointer font-normal">自动</Label>
            </div>
            <div class="flex items-center space-x-2">
              <RadioGroup.Item value="manual" id="sitemap-manual" />
              <Label for="sitemap-manual" class="cursor-pointer font-normal">手动</Label>
            </div>
            <div class="flex items-center space-x-2">
              <RadioGroup.Item value="off" id="sitemap-off" />
              <Label for="sitemap-off" class="cursor-pointer font-normal">关闭</Label>
            </div>
          </RadioGroup.Root>
          <p class="text-muted-foreground text-xs">
            {#if sitemap.mode === "auto"}
              将根据监控器和页面自动生成站点地图。也可以在下方添加其他 URL。
            {:else if sitemap.mode === "manual"}
              提供要包含在站点地图中的自定义 URL。
            {:else}
              已停用站点地图生成。
            {/if}
          </p>
        </div>

        {#if sitemap.mode === "manual" || sitemap.mode === "auto"}
          <div class="space-y-3">
            <Label>{sitemap.mode === "auto" ? "附加 URL" : "URL"}</Label>
            {#each sitemap.urls as url, index (index)}
              <div class="flex items-center gap-2">
                <Input type="url" bind:value={url.loc} placeholder="https://example.com/page" class="flex-1" />
                <Button
                  variant="ghost"
                  size="icon"
                  onclick={() => removeSitemapUrl(index)}
                  disabled={sitemap.mode === "manual" && sitemap.urls.length <= 1}
                >
                  <XIcon class="h-4 w-4" />
                </Button>
              </div>
            {/each}
            <Button variant="outline" onclick={addSitemapUrl}>
              <Plus class="h-4 w-4" />
              {sitemap.urls.length > 0 ? "添加更多 URL" : "添加 URL"}
            </Button>
            {#if sitemap.mode === "manual" && sitemap.urls.length === 0}
              <p class="text-destructive text-xs">手动模式至少需要一个 URL。</p>
            {/if}
          </div>
        {/if}
      </Card.Content>
      <Card.Footer class="flex justify-end gap-2">
        {#if sitemap.mode !== "off" && sitemapURL}
          <CopyButton variant="outline" size="default" text={sitemapURL} copiedLabel="已复制">
            <CopyIcon class="mr-2 h-4 w-4" />
            复制 URL
          </CopyButton>
          <Button
            variant="outline"
            class="cursor-pointer"
            onclick={() => window.open(clientResolver(resolve, "/sitemap.xml"), "_blank")}
          >
            <ExternalLinkIcon class="h-4 w-4" />
            查看
          </Button>
        {/if}
        <Button onclick={saveSitemap} disabled={savingSitemap || !isValidSitemap} class="cursor-pointer">
          {#if savingSitemap}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>

    <!-- Maintenance Notification Settings Card -->
    <Card.Root>
      <Card.Header>
        <Card.Title>维护通知设置</Card.Title>
        <Card.Description>配置哪些维护生命周期事件会触发订阅者通知</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="space-y-4">
          <Label>事件类型</Label>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium">已创建</p>
                <p class="text-muted-foreground text-xs">创建维护计划时</p>
              </div>
              <Switch
                checked={maintenanceNotificationSettings.event_types.created}
                onCheckedChange={(v) => {
                  maintenanceNotificationSettings.event_types.created = v === true;
                }}
              />
            </div>
            <div class="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium">提醒</p>
                <p class="text-muted-foreground text-xs">计划维护开始前</p>
              </div>
              <Switch
                checked={maintenanceNotificationSettings.event_types.reminder}
                onCheckedChange={(v) => {
                  maintenanceNotificationSettings.event_types.reminder = v === true;
                }}
              />
            </div>
            <div class="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium">已开始</p>
                <p class="text-muted-foreground text-xs">维护开始时</p>
              </div>
              <Switch
                checked={maintenanceNotificationSettings.event_types.started}
                onCheckedChange={(v) => {
                  maintenanceNotificationSettings.event_types.started = v === true;
                }}
              />
            </div>
            <div class="flex items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p class="text-sm font-medium">已结束</p>
                <p class="text-muted-foreground text-xs">维护完成时</p>
              </div>
              <Switch
                checked={maintenanceNotificationSettings.event_types.ended}
                onCheckedChange={(v) => {
                  maintenanceNotificationSettings.event_types.ended = v === true;
                }}
              />
            </div>
          </div>
        </div>

        {#if maintenanceNotificationSettings.event_types.reminder}
          <div class="space-y-2">
            <Label for="reminder-buffer-hours">提醒提前时间（小时）</Label>
            <Input
              id="reminder-buffer-hours"
              type="number"
              min={1}
              bind:value={maintenanceNotificationSettings.reminder_buffer_hours}
            />
            <p class="text-muted-foreground text-xs">在维护开始前多少小时发送提醒通知</p>
          </div>
        {/if}
      </Card.Content>
      <Card.Footer class="flex justify-end">
        <Button
          onclick={saveMaintenanceNotificationSettings}
          disabled={savingMaintenanceNotificationSettings}
          class="cursor-pointer"
        >
          {#if savingMaintenanceNotificationSettings}
            <Loader class="h-4 w-4 animate-spin" />
            正在保存...
          {:else}
            <SaveIcon class="h-4 w-4" />
            保存
          {/if}
        </Button>
      </Card.Footer>
    </Card.Root>
  {/if}
</div>
