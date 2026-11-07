import { useEffect, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { useToast, useTranslation } from "@termix-ssh/plugin-sdk/frontend";
import {
  FOLDER_COLORS,
  FormFooter,
  InlineView,
  NumberField,
  TextField,
  cn,
} from "@termix-ssh/plugin-sdk/ui";
import { normalizeUrl, type CardInput } from "../catalog.js";

export const emptyCard: CardInput = {
  name: "",
  url: "",
  description: "",
  icon: "",
  color: "#6b7280",
  order: 0,
};
export type Editing = { id?: string; form: CardInput } | null;

export function ApplicationForm({
  editing,
  onClose,
  save,
}: {
  editing: Editing;
  onClose: () => void;
  save: (card: CardInput, id?: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [form, setForm] = useState<CardInput>(emptyCard);
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (editing) {
      setForm(editing.form);
      setErrors({});
    }
  }, [editing]);
  const set = (key: keyof CardInput, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = t("form.nameRequired");
    try {
      normalizeUrl(form.url);
    } catch {
      next.url = t("form.urlInvalid");
    }
    setErrors(next);
    if (next.name || next.url) return;
    setSaving(true);
    try {
      await save(form, editing?.id);
      onClose();
    } catch {
      toast.error(t("errors.save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <InlineView
      open={!!editing}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      icon={<LayoutGrid className="size-4" />}
      title={
        editing?.id
          ? t("form.editTitle", { name: editing.form.name })
          : t("form.addTitle")
      }
      footer={
        <FormFooter
          saving={saving}
          onCancel={onClose}
          onSave={() => void submit()}
          saveLabel={t("form.save")}
          cancelLabel={t("form.cancel")}
        />
      }
    >
      {editing && (
        <div className="flex flex-col gap-3 p-3">
          <TextField
            label={t("form.name")}
            value={form.name}
            onChange={(value) => set("name", value)}
            error={errors.name}
          />
          <TextField
            label={t("form.url")}
            value={form.url}
            onChange={(value) => set("url", value)}
            hint={t("form.urlHint")}
            error={errors.url}
            mono
          />
          <TextField
            label={t("form.description")}
            value={form.description}
            onChange={(value) => set("description", value)}
          />
          <TextField
            label={t("form.icon")}
            value={form.icon}
            onChange={(value) => set("icon", value.slice(0, 8))}
            hint={t("form.iconHint")}
            mono
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">{t("form.color")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[...new Set([...FOLDER_COLORS, form.color])].map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={form.color === color}
                  onClick={() => set("color", color)}
                  className={cn(
                    "size-6 rounded-sm border",
                    form.color === color
                      ? "border-foreground"
                      : "border-border",
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
          <NumberField
            label={t("form.order")}
            value={form.order}
            onChange={(value) => set("order", value)}
          />
        </div>
      )}
    </InlineView>
  );
}
