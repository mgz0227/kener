import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { EditorView, keymap } from "@codemirror/view";
import { search, searchKeymap } from "@codemirror/search";
import ColorPicker from "svelte-awesome-color-picker";
import { adminEditorExtensions } from "./admin-editor.js";
import { colorPickerTexts } from "./admin-labels.js";

it("keeps editor search and replacement working with Chinese controls", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const editor = new EditorView({
    parent: host,
    doc: "first target\nsecond target",
    extensions: [search(), keymap.of(searchKeymap), ...adminEditorExtensions],
  });
  const screen = page.elementLocator(host);
  try {
    await screen.getByRole("textbox").click();
    await userEvent.keyboard("{Control>}f{/Control}");
    await screen.getByRole("textbox", { name: "查找", exact: true }).fill("target");
    await expect.element(screen.getByRole("button", { name: "下一个", exact: true })).toBeVisible();
    await screen.getByRole("button", { name: "下一个", exact: true }).click();
    await expect
      .poll(() => editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to))
      .toBe("target");
    await screen.getByRole("textbox", { name: "替换", exact: true }).fill("替换结果");
    await screen.getByRole("button", { name: "全部替换", exact: true }).click();
    await expect.poll(() => editor.state.doc.toString()).toBe("first 替换结果\nsecond 替换结果");
  } finally {
    editor.destroy();
    host.remove();
  }
});

it("uses Chinese labels inside the color picker", async () => {
  const screen = await render(ColorPicker, { isDialog: false, texts: colorPickerTexts });
  await expect.element(screen.getByRole("slider", { name: "色相" })).toBeVisible();
  await expect.element(screen.getByRole("textbox", { name: "十六进制颜色" })).toBeVisible();
});
