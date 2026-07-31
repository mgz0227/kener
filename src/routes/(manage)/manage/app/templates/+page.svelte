<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Spinner } from "$lib/components/ui/spinner/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Textarea } from "$lib/components/ui/textarea/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import SaveIcon from "@lucide/svelte/icons/save";
  import FileTextIcon from "@lucide/svelte/icons/file-text";
  import MailIcon from "@lucide/svelte/icons/mail";
  import Loader from "@lucide/svelte/icons/loader";
  import { toast } from "svelte-sonner";
  import { mode } from "mode-watcher";
  import CodeMirror from "svelte-codemirror-editor";
  import { html } from "@codemirror/lang-html";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import { onMount } from "svelte";
  import { resolve } from "$app/paths";
  import clientResolver from "$lib/client/resolver.js";

  interface GeneralEmailTemplate {
    template_id: string;
    template_subject: string | null;
    template_html_body: string | null;
    template_text_body: string | null;
  }

  // State
  let loading = $state(true);
  let saving = $state(false);
  let templates = $state<GeneralEmailTemplate[]>([]);
  let selectedTemplateId = $state<string>("");

  // Form state for selected template
  let templateSubject = $state("");
  let templateHtmlBody = $state("");
  let templateTextBody = $state("");

  // Derived: selected template
  let selectedTemplate = $derived(templates.find((t) => t.template_id === selectedTemplateId));

  // Fetch templates on mount
  onMount(() => {
    fetchTemplates();
  });

  // Handle template selection change
  function handleTemplateSelect(templateId: string) {
    selectedTemplateId = templateId;
    const template = templates.find((t) => t.template_id === templateId);
    if (template) {
      templateSubject = template.template_subject || "";
      templateHtmlBody = template.template_html_body || "";
      templateTextBody = template.template_text_body || "";
    } else {
      templateSubject = "";
      templateHtmlBody = "";
      templateTextBody = "";
    }
  }

  async function fetchTemplates() {
    loading = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getGeneralEmailTemplates",
          data: {}
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        templates = result;
        // Auto-select first template if available
        if (templates.length > 0 && !selectedTemplateId) {
          handleTemplateSelect(templates[0].template_id);
        }
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("加载模板失败");
    } finally {
      loading = false;
    }
  }

  async function updateTemplate() {
    if (!selectedTemplateId) {
      toast.error("请选择模板");
      return;
    }

    saving = true;
    try {
      const response = await fetch(clientResolver(resolve, "/manage/api"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateGeneralEmailTemplate",
          data: {
            templateId: selectedTemplateId,
            template_subject: templateSubject,
            template_html_body: templateHtmlBody,
            template_text_body: templateTextBody
          }
        })
      });
      const result = await response.json();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("模板更新成功");
        // Update local state
        const index = templates.findIndex((t) => t.template_id === selectedTemplateId);
        if (index !== -1) {
          templates[index] = {
            ...templates[index],
            template_subject: templateSubject,
            template_html_body: templateHtmlBody,
            template_text_body: templateTextBody
          };
        }
      }
    } catch (error) {
      console.error("Error updating template:", error);
      toast.error("更新模板失败");
    } finally {
      saving = false;
    }
  }

  function formatTemplateId(id: string): string {
    // Convert snake_case or kebab-case to Title Case
    return id.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }
</script>

<div class="container mx-auto space-y-6 py-6">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner class="size-8" />
    </div>
  {:else if templates.length === 0}
    <Card.Root>
      <Card.Content class="flex flex-col items-center justify-center py-12">
        <MailIcon class="text-muted-foreground mb-4 size-12" />
        <h3 class="mb-2 text-lg font-semibold">未找到模板</h3>
        <p class="text-muted-foreground text-center">尚未配置电子邮件模板。</p>
      </Card.Content>
    </Card.Root>
  {:else}
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <FileTextIcon class="size-5" />
          编辑模板
        </Card.Title>
        <Card.Description>从下拉菜单中选择模板以查看和编辑其内容</Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Template Selector -->
        <div class="space-y-2">
          <Label for="template-select">选择模板</Label>
          <Select.Root
            type="single"
            value={selectedTemplateId}
            onValueChange={(value) => {
              if (value) handleTemplateSelect(value);
            }}
          >
            <Select.Trigger class="w-full md:w-[400px]">
              {#if selectedTemplateId}
                {formatTemplateId(selectedTemplateId)}
              {:else}
                选择模板...
              {/if}
            </Select.Trigger>
            <Select.Content>
              {#each templates as template (template.template_id)}
                <Select.Item value={template.template_id}>
                  {formatTemplateId(template.template_id)}
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        {#if selectedTemplateId}
          <!-- Subject -->
          <div class="space-y-2">
            <Label for="template-subject">主题</Label>
            <Input id="template-subject" bind:value={templateSubject} placeholder="电子邮件主题" />
            <p class="text-muted-foreground text-xs">
              电子邮件主题行。可以使用 Mustache 变量，例如 <code class="bg-muted rounded px-1">{"{{variable}}"}</code>
            </p>
          </div>

          <!-- HTML Body -->
          <div class="space-y-2">
            <Label>HTML 正文</Label>
            <p class="text-muted-foreground text-xs">电子邮件的 HTML 内容。使用 Mustache 变量插入动态内容。</p>
            <div class="overflow-hidden rounded-md border">
              <CodeMirror
                bind:value={templateHtmlBody}
                lang={html()}
                theme={mode.current === "dark" ? githubDark : githubLight}
                styles={{ "&": { width: "100%", height: "400px" } }}
              />
            </div>
          </div>

          <!-- Text Body -->
          <div class="space-y-2">
            <Label for="template-text-body">文本正文</Label>
            <p class="text-muted-foreground text-xs">不支持 HTML 的客户端使用的纯文本版本</p>
            <Textarea id="template-text-body" bind:value={templateTextBody} placeholder="纯文本电子邮件内容" rows={8} />
          </div>
        {/if}
      </Card.Content>
      {#if selectedTemplateId}
        <Card.Footer class="flex justify-end">
          <Button onclick={updateTemplate} disabled={saving}>
            {#if saving}
              <Loader class="size-4 animate-spin" />
            {:else}
              <SaveIcon class="size-4" />
            {/if}
            更新模板
          </Button>
        </Card.Footer>
      {/if}
    </Card.Root>
  {/if}
</div>
