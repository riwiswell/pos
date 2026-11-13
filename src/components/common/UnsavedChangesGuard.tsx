import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";

type EditableControl = HTMLElement;
type SaveAttempt = { existingToasts: Set<Element> };

const discardMessage =
  "¿Desea salir sin guardar?\n\nAceptar = salir y descartar los cambios. Cancelar = seguir editando.";

function isEditableControl(target: EventTarget | null): target is EditableControl {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (!target.matches(
    "input, textarea, select, [role='checkbox'], [role='switch'], [role='radio'], [role='combobox'], [role='textbox'], [role='spinbutton'], [role='slider']",
  )) return false;
  if (target instanceof HTMLInputElement && ["hidden", "search", "submit", "button", "reset"].includes(target.type)) return false;
  if (target instanceof HTMLInputElement && (target.disabled || target.readOnly)) return false;
  if (target instanceof HTMLTextAreaElement && (target.disabled || target.readOnly)) return false;
  if (target instanceof HTMLSelectElement && target.disabled) return false;
  if (target.getAttribute("aria-disabled") === "true") return false;
  const description = [
    target.getAttribute("placeholder"),
    target.getAttribute("aria-label"),
    target.getAttribute("name"),
  ].join(" ").toLowerCase();
  if (description.includes("buscar") || description.includes("search") || description.includes("filtro")) return false;
  return true;
}

function controlValue(control: EditableControl): string {
  if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
    return control.checked ? "checked" : "unchecked";
  }
  if (control instanceof HTMLSelectElement && control.multiple) {
    return Array.from(control.selectedOptions).map((option) => option.value).join("|");
  }
  if (
    control instanceof HTMLInputElement ||
    control instanceof HTMLTextAreaElement ||
    control instanceof HTMLSelectElement
  ) {
    return control.value;
  }
  if (control.matches("[role='checkbox'], [role='switch'], [role='radio']")) {
    return control.getAttribute("aria-checked") ?? "unchecked";
  }
  if (control.matches("[role='spinbutton'], [role='slider']")) {
    return control.getAttribute("aria-valuenow") ?? control.getAttribute("aria-valuetext") ?? control.innerHTML;
  }
  return control.innerHTML;
}

function initialControlValue(control: EditableControl): string {
  if (control instanceof HTMLInputElement && (control.type === "checkbox" || control.type === "radio")) {
    return control.defaultChecked ? "checked" : "unchecked";
  }
  if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
    return control.defaultValue;
  }
  if (control instanceof HTMLSelectElement && control.multiple) {
    return Array.from(control.options).filter((option) => option.defaultSelected).map((option) => option.value).join("|");
  }
  if (control instanceof HTMLSelectElement) {
    return Array.from(control.options).find((option) => option.defaultSelected)?.value ?? "";
  }
  return control.getAttribute("data-initial-value") ?? control.innerHTML;
}

function formScope(element: Element): Element {
  return element.closest("form, [role='dialog'], [data-unsaved-scope], .glass, section, article") ?? document.body;
}

function isDismissLabel(label: string): boolean {
  return /^(cancelar|cancel|cerrar|close|descartar|discard|volver|back|salir|×|✕|x)(\b|$)/i.test(label);
}

function isSaveLabel(label: string): boolean {
  return /^(guardar|save|registrar|actualizar|crear|agregar|añadir|aplicar|terminar|completar|confirmar|enviar|done|listo)(\b|$)/i.test(label);
}

function blockEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

/**
 * Global protection for POS editor panels, including controlled fields,
 * rich-text editors, custom selects/toggles and dialogs that are not native forms.
 */
export function UnsavedChangesGuard() {
  const [dirty, setDirty] = useState(false);
  const dirtyControls = useRef(new Map<EditableControl, { baseline: string; scope: Element }>());
  const dirtyRef = useRef(false);
  const pendingSaveScopes = useRef(new Map<Element, SaveAttempt>());

  const refreshDirty = () => {
    for (const [control] of dirtyControls.current) {
      if (!control.isConnected) dirtyControls.current.delete(control);
    }
    const next = Array.from(dirtyControls.current).some(
      ([control, entry]) => controlValue(control) !== entry.baseline,
    );
    dirtyRef.current = next;
    setDirty((current) => (current === next ? current : next));
    return next;
  };

  const scopeHasChanges = (scope: Element) => {
    refreshDirty();
    return Array.from(dirtyControls.current).some(([control, entry]) => {
      const belongs = scope === document.body || scope.contains(control) || entry.scope === scope;
      return belongs && controlValue(control) !== entry.baseline;
    });
  };

  const clearScope = (scope: Element) => {
    for (const [control, entry] of dirtyControls.current) {
      if (scope === document.body || scope.contains(control) || entry.scope === scope) {
        dirtyControls.current.delete(control);
      }
    }
    pendingSaveScopes.current.delete(scope);
    refreshDirty();
  };

  const resetScopeAfterSave = (scope: Element) => {
    for (const [control, entry] of dirtyControls.current) {
      if (scope === document.body || scope.contains(control) || entry.scope === scope) {
        dirtyControls.current.set(control, { ...entry, baseline: controlValue(control) });
      }
    }
    pendingSaveScopes.current.delete(scope);
    refreshDirty();
  };

  const confirmDiscard = (scope: Element) => {
    if (!scopeHasChanges(scope)) return true;
    return window.confirm(discardMessage);
  };

  const watchSave = (scope: Element) => {
    const existingToasts = new Set(document.querySelectorAll("[data-sonner-toast]"));
    pendingSaveScopes.current.set(scope, { existingToasts });
    window.setTimeout(() => pendingSaveScopes.current.delete(scope), 12_000);
  };

  useBlocker({
    shouldBlockFn: () => {
      if (!dirtyRef.current) return false;
      const leave = window.confirm(discardMessage);
      if (leave) {
        dirtyControls.current.clear();
        pendingSaveScopes.current.clear();
        refreshDirty();
        return false;
      }
      return true;
    },
    enableBeforeUnload: () => dirtyRef.current,
  });

  useEffect(() => {
    const onFocus = (event: Event) => {
      if (!isEditableControl(event.target)) return;
      const control = event.target;
      if (!dirtyControls.current.has(control)) {
        dirtyControls.current.set(control, { baseline: controlValue(control), scope: formScope(control) });
      }
      refreshDirty();
    };

    const onInput = (event: Event) => {
      if (!isEditableControl(event.target)) return;
      const control = event.target;
      if (!dirtyControls.current.has(control)) {
        dirtyControls.current.set(control, { baseline: initialControlValue(control), scope: formScope(control) });
      }
      refreshDirty();
    };

    const onClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      // Radix checkboxes and switches update their aria-checked state after click.
      const toggle = target.closest("[role='checkbox'], [role='switch'], [role='radio']");
      if (toggle instanceof HTMLElement) {
        if (!dirtyControls.current.has(toggle)) {
          dirtyControls.current.set(toggle, { baseline: controlValue(toggle), scope: formScope(toggle) });
        }
        window.setTimeout(() => refreshDirty(), 0);
        return;
      }

      const button = target.closest("button, [role='button'], input[type='submit']");
      if (!button) return;
      const label = (
        button.getAttribute("aria-label") ||
        button.getAttribute("title") ||
        button.textContent ||
        (button instanceof HTMLInputElement ? button.value : "")
      ).trim();
      const scope = formScope(button);

      if (isDismissLabel(label)) {
        if (!confirmDiscard(scope)) {
          blockEvent(event);
          return;
        }
        clearScope(scope);
        return;
      }

      if (isSaveLabel(label)) watchSave(scope);
    };

    const onSubmit = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) watchSave(formScope(target));
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const dialogs = Array.from(document.querySelectorAll("[role='dialog']"));
      const dialog = dialogs.reverse().find((candidate) => scopeHasChanges(candidate));
      if (!dialog) return;
      if (!confirmDiscard(dialog)) {
        blockEvent(event);
        return;
      }
      clearScope(dialog);
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const dialogs = Array.from(document.querySelectorAll("[role='dialog']"));
      const dialog = dialogs.reverse().find((candidate) => scopeHasChanges(candidate));
      if (!dialog || dialog.contains(target)) return;
      if (!confirmDiscard(dialog)) {
        blockEvent(event);
        return;
      }
      clearScope(dialog);
    };

    const observer = new MutationObserver(() => {
      refreshDirty();
      const toasts = Array.from(document.querySelectorAll("[data-sonner-toast]"));
      for (const [scope, attempt] of pendingSaveScopes.current) {
        if (!scope.isConnected) {
          clearScope(scope);
          continue;
        }
        const newToast = toasts.find((toast) => !attempt.existingToasts.has(toast));
        if (!newToast) continue;
        const type = newToast.getAttribute("data-type");
        if (type === "error") {
          pendingSaveScopes.current.delete(scope);
        } else if (type === "success") {
          resetScopeAfterSave(scope);
        }
      }
    });

    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);

  return dirty ? <span className="sr-only" aria-live="polite">Hay cambios sin guardar.</span> : null;
}
