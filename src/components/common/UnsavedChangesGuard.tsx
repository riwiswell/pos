import { useEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";

type EditableControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isEditableControl(target: EventTarget | null): target is EditableControl {
  if (!(target instanceof HTMLElement)) return false;
  if (!target.matches("input, textarea, select")) return false;
  if (target instanceof HTMLInputElement && ["hidden", "search", "submit", "button", "reset"].includes(target.type)) return false;
  if (target instanceof HTMLInputElement && (target.disabled || target.readOnly)) return false;
  if (target instanceof HTMLTextAreaElement && (target.disabled || target.readOnly)) return false;
  if (target instanceof HTMLSelectElement && target.disabled) return false;
  const description = [target.getAttribute("placeholder"), target.getAttribute("aria-label"), target.getAttribute("name")].join(" ").toLowerCase();
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
  return control.value;
}

function formScope(element: Element): Element {
  return element.closest("form, [role='dialog'], [data-unsaved-scope], .glass, section, article") ?? document.body;
}

/**
 * Global fallback guard for POS' many editor panels, including panels built
 * from controlled inputs rather than native <form> elements.
 */
export function UnsavedChangesGuard() {
  const [dirty, setDirty] = useState(false);
  const dirtyControls = useRef(new Map<EditableControl, { baseline: string; scope: Element }>());
  const dirtyRef = useRef(false);

  const refreshDirty = () => {
    const next = dirtyControls.current.size > 0;
    dirtyRef.current = next;
    setDirty(next);
  };

  useBlocker({
    shouldBlockFn: () => {
      if (!dirtyRef.current) return false;
      const leave = window.confirm("¿Desea salir sin guardar?\n\nAcepta para salir y descartar los cambios, o cancela para seguir editando.");
      if (leave) {
        dirtyControls.current.clear();
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
    };

    const onInput = (event: Event) => {
      if (!isEditableControl(event.target)) return;
      const control = event.target;
      const existing = dirtyControls.current.get(control);
      if (!existing) {
        dirtyControls.current.set(control, { baseline: controlValue(control), scope: formScope(control) });
        return;
      }
      if (controlValue(control) === existing.baseline) dirtyControls.current.delete(control);
      else dirtyControls.current.set(control, existing);
      refreshDirty();
    };

    const clearScope = (scope: Element) => {
      for (const [control, entry] of dirtyControls.current) {
        if (scope === document.body || scope.contains(control) || entry.scope === scope) {
          dirtyControls.current.delete(control);
        }
      }
      refreshDirty();
    };

    const onClick = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest("button, [role='button'], input[type='submit']");
      if (!button) return;
      const label = (button.getAttribute("aria-label") || button.textContent || (button instanceof HTMLInputElement ? button.value : "")).trim();
      if (/^(guardar|save|registrar|actualizar|crear|terminar|completar|confirmar|enviar|done|listo)\b/i.test(label)) {
        const scope = formScope(button);
        window.setTimeout(() => clearScope(scope), 1200);
      } else if (/^(cancelar|cerrar|descartar)\b/i.test(label)) {
        clearScope(formScope(button));
      }
    };

    const onSubmit = (event: Event) => {
      const target = event.target;
      if (target instanceof Element) {
        const scope = formScope(target);
        window.setTimeout(() => clearScope(scope), 1200);
      }
    };

    document.addEventListener("focusin", onFocus, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("change", onInput, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("change", onInput, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return dirty ? <span className="sr-only" aria-live="polite">Hay cambios sin guardar.</span> : null;
}
