import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextEditor } from "@/components/common/RichTextEditor";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habitName: string;
  initialNote: string;
  onSave: (note: string | null) => void;
}

export function NoteDialog({ open, onOpenChange, habitName, initialNote, onSave }: Props) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote(initialNote);
  }, [open, initialNote]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nota — {habitName}</DialogTitle>
        </DialogHeader>
        <RichTextEditor value={note} onChange={setNote} placeholder="Escribe una nota para este día" />
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={() => {
              onSave(null);
              onOpenChange(false);
            }}
          >
            Eliminar nota
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave(note.trim() ? note.trim() : null);
              onOpenChange(false);
            }}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}