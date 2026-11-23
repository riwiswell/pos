import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Film, ImagePlus, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/common/States";
import { useLGList, useLGMutations } from "@/hooks/use-life-graph";
import { useAuth } from "@/hooks/use-auth";
import { useGlobalDate } from "@/hooks/use-global-date";
import { usePrivatePhotos } from "@/hooks/use-private-photos";
import { privateMediaService } from "@/services/private-media.service";
import { lifeGraphService } from "@/services/life-graph.service";
import { lookupLearningCover } from "@/services/learning-cover.service";
import { CoverLightbox } from "@/components/learning/CoverLightbox";

function formatRuntime(value: unknown) {
  const minutes = Math.max(0, Math.floor(Number(value) || 0));
  if (!minutes) return "Duración no indicada";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ""}` : `${minutes} min`;
}

function isRemoteCover(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

export function MoviesLibrary() {
  const items = useLGList("learning_items");
  const sessions = useLGList("learning_sessions", "session_date");
  const relationships = useLGList("relationships");
  const itemMutation = useLGMutations("learning_items");
  const sessionMutation = useLGMutations("learning_sessions");
  const relationshipMutation = useLGMutations("relationship_interactions");
  const { user } = useAuth();
  const { date } = useGlobalDate();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [durationHours, setDurationHours] = useState("2");
  const [durationMinutes, setDurationMinutes] = useState("0");
  const [genre, setGenre] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [watchDate, setWatchDate] = useState(date);
  const [companionId, setCompanionId] = useState("alone");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const createCoverInput = useRef<HTMLInputElement>(null);
  const [posterCandidate, setPosterCandidate] = useState("");
  const [searchingPoster, setSearchingPoster] = useState(false);
  const [saving, setSaving] = useState(false);

  const movies = useMemo(() =>
    (items.data ?? [])
      .filter((item: any) => item.kind === "movie")
      .sort((a: any, b: any) => String(b.updated_at ?? b.created_at ?? "").localeCompare(String(a.updated_at ?? a.created_at ?? ""))),
    [items.data],
  );
  const sessionRows = sessions.data ?? [];
  const people = (relationships.data ?? []).filter((person: any) => person?.id && person?.name)
    .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name), "es"));

  const resetForm = () => {
    setTitle("");
    setDurationHours("2");
    setDurationMinutes("0");
    setGenre("");
    setReleaseYear("");
    setWatchDate(date);
    setCompanionId("alone");
    setCoverFile(null);
    setPosterCandidate("");
    setAdding(false);
  };

  const searchPoster = async () => {
    if (!title.trim()) {
      toast.error("Escribe primero el nombre de la película.");
      return;
    }
    setSearchingPoster(true);
    try {
      const result = await lookupLearningCover({ kind: "movie", title: title.trim() });
      if (!result) {
        setPosterCandidate("");
        toast.info("No encontré un póster fiable. Podrás subirlo desde la ficha.");
        return;
      }
      setPosterCandidate(result);
      toast.success("Encontré una imagen para el póster. Revísala antes de guardar.");
    } finally {
      setSearchingPoster(false);
    }
  };

  const addMovie = async () => {
    if (!title.trim()) {
      toast.error("Escribe el nombre de la película.");
      return;
    }
    const hours = Number(durationHours || 0);
    const remainder = Number(durationMinutes || 0);
    const minutes = hours * 60 + remainder;
    if (!Number.isInteger(hours) || !Number.isInteger(remainder) || hours < 0 || remainder < 0 || remainder > 59 || minutes < 1 || minutes > 1000) {
      toast.error("Indica una duración válida en horas y minutos.");
      return;
    }
    const parsedYear = releaseYear.trim() ? Number(releaseYear) : null;
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1888 || parsedYear > 2100)) {
      toast.error("Indica un año de estreno válido.");
      return;
    }
    const parsedDate = new Date(`${watchDate}T12:00:00-05:00`);
    if (!watchDate || Number.isNaN(parsedDate.getTime()) || watchDate > date) {
      toast.error("Selecciona una fecha de visualización válida.");
      return;
    }
    if (genre.trim().length > 80) {
      toast.error("Selecciona un género válido.");
      return;
    }
    if (movies.some((item: any) => String(item.title).trim().toLocaleLowerCase("es") === title.trim().toLocaleLowerCase("es"))) {
      toast.error("Esa película ya está en tu biblioteca.");
      return;
    }
    setSaving(true);
    try {
      let coverPath = posterCandidate || null;
      if (coverFile) coverPath = await privateMediaService.uploadPhoto(coverFile);
      else if (!coverPath) coverPath = await lookupLearningCover({ kind: "movie", title: title.trim() });
      const createdMovie = await itemMutation.create.mutateAsync({
        user_id: user?.id,
        title: title.trim(),
        kind: "movie",
        status: "active",
        target_minutes: minutes,
        genre: genre || null,
        publication_year: parsedYear,
        cover_path: coverPath,
        progress: 0,
        minutes_total: 0,
      });
      await recordWatch(createdMovie, watchDate, companionId === "alone" ? null : companionId);
      if (coverFile) toast.success("Póster subido desde la galería y guardado en la ficha.");
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar la película.");
    } finally {
      setSaving(false);
    }
  };

  const recordWatch = async (movie: any, sessionDate: string, companionId: string | null) => {
    const companion = companionId ? people.find((person: any) => person.id === companionId) : null;
    const detail = companion ? `Vista con ${companion.name}` : "Vista a solas";
    const session = await sessionMutation.create.mutateAsync({
      user_id: user?.id,
      learning_item_id: movie.id,
      session_date: sessionDate,
      minutes: Math.max(0, Number(movie.target_minutes) || 0),
      activity_type: "movie_watch",
      notes: `Película: ${movie.title} · ${detail}`,
    });
    if (companion) {
      try {
        await relationshipMutation.create.mutateAsync({
          user_id: user?.id,
          relationship_id: companion.id,
          interaction_on: sessionDate,
          interaction_type: "movie",
          notes: `Vimos juntos la película «${movie.title}».`,
        });
        await lifeGraphService.link(
          "learning_session",
          session.id,
          "relationship",
          companion.id,
          "watched_movie_with",
          { movie_title: movie.title, session_date: sessionDate },
        );
        toast.success(`Visualización registrada y relación con ${companion.name} actualizada.`);
      } catch (error) {
        toast.error("La película sí quedó registrada, pero no se pudo guardar la interacción en Relaciones. Puedes registrarla allí manualmente.");
      }
    } else {
      toast.success("Película registrada como vista a solas.");
    }
  };

  const deleteMovie = async (movie: any) => {
    if (isRemoteCover(movie.cover_path) === false && movie.cover_path) {
      await privateMediaService.removePhoto(String(movie.cover_path)).catch(() => undefined);
    }
    await itemMutation.remove.mutateAsync(movie.id);
    toast.success("Película eliminada.");
  };

  return <section className="space-y-3">
    {(items.isError || sessions.isError || relationships.isError) && (
      <ErrorState message="No se pudieron cargar todas las películas, visualizaciones o relaciones." />
    )}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-semibold">Mi biblioteca de películas</h2>
        <p className="text-xs text-muted-foreground">Póster, duración, género y fecha de cada visualización.</p>
      </div>
      <Button size="sm" onClick={() => setAdding((value) => !value)}>
        {adding ? "Cerrar" : "Agregar película"} {adding ? <X className="ml-1 h-4 w-4" /> : <Plus className="ml-1 h-4 w-4" />}
      </Button>
    </div>
    {adding && <div className="glass max-w-3xl space-y-3 rounded-2xl p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input placeholder="Nombre de la película" value={title} onChange={(event) => { setTitle(event.target.value); setPosterCandidate(""); }} />
        <label className="space-y-1 text-xs text-muted-foreground">Año de estreno
          <Input type="number" min="1888" max="2100" placeholder="Ej. 2024" value={releaseYear} onChange={(event) => setReleaseYear(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">Género
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={genre} onChange={(event) => setGenre(event.target.value)}>
            <option value="">Selecciona un género…</option>
            {["Acción","Aventura","Animación","Ciencia ficción","Comedia","Crimen","Documental","Drama","Fantasía","Musical","Misterio","Romance","Suspenso","Terror","Thriller psicológico","Bélica","Western"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div className="space-y-1 text-xs text-muted-foreground">Duración
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2"><Input type="number" min="0" max="16" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /><span>horas</span></label>
            <label className="flex items-center gap-2"><Input type="number" min="0" max="59" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} /><span>min</span></label>
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">¿Cuándo la viste?
          <Input type="date" value={watchDate} max={date} onChange={(event) => setWatchDate(event.target.value)} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">¿Con quién la viste?
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={companionId} onChange={(event) => setCompanionId(event.target.value)}>
            <option value="alone">La vi solo/a</option>
            {people.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" variant="outline" onClick={() => createCoverInput.current?.click()}>
          <ImagePlus className="mr-1 h-3.5 w-3.5" />{coverFile ? "Cambiar imagen de galería" : "Subir póster desde galería"}
        </Button>
        <input ref={createCoverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" className="sr-only" onChange={(event) => { setCoverFile(event.target.files?.[0] ?? null); setPosterCandidate(""); }} />
        {coverFile && <span className="max-w-full truncate text-xs text-muted-foreground">{coverFile.name}</span>}
        <Button size="sm" type="button" variant="ghost" disabled={!title.trim() || searchingPoster || Boolean(coverFile)} onClick={() => void searchPoster()}>
          <Search className="mr-1 h-3.5 w-3.5" />{searchingPoster ? "Buscando…" : "Buscar póster"}
        </Button>
        <Button size="sm" className="ml-auto" disabled={!title.trim() || saving || itemMutation.create.isPending} onClick={() => void addMovie()}>
          <Plus className="mr-1 h-4 w-4" />{saving ? "Guardando…" : "Agregar película"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" type="button" variant="outline" disabled={!title.trim() || searchingPoster} onClick={() => void searchPoster()}>
          <Search className="mr-1 h-3.5 w-3.5" />{searchingPoster ? "Buscando…" : "Buscar póster"}
        </Button>
        {posterCandidate && <span className="text-xs text-muted-foreground">Póster encontrado; comprueba que corresponda a esta película.</span>}
      </div>
      {posterCandidate && <div className="flex items-center gap-3 rounded-xl border p-2">
        <img src={posterCandidate} alt="Póster sugerido" className="h-24 w-16 rounded object-cover" />
        <span className="text-xs text-muted-foreground">La imagen se guardará como portada al agregar la película.</span>
      </div>}
    </div>}
    {movies.length === 0 && !items.isError && <div className="glass max-w-xl rounded-2xl p-4 text-sm text-muted-foreground">Aún no tienes películas. Agrega una para empezar tu historial.</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {movies.map((movie: any) => (
        <MovieCard
          key={movie.id}
          movie={movie}
          sessions={sessionRows.filter((session: any) => session.learning_item_id === movie.id && session.activity_type === "movie_watch")}
          people={people}
          date={date}
          onUpdate={(patch: any) => itemMutation.update.mutateAsync({ id: movie.id, patch })}
          onDelete={() => void deleteMovie(movie)}
          onRecordWatch={recordWatch}
        />
      ))}
    </div>
  </section>;
}

function MovieCard({ movie, sessions, people, date, onUpdate, onDelete, onRecordWatch }: {
  movie: any;
  sessions: any[];
  people: any[];
  date: string;
  onUpdate: (patch: Record<string, unknown>) => Promise<unknown>;
  onDelete: () => void;
  onRecordWatch: (movie: any, date: string, companionId: string | null) => Promise<unknown>;
}) {
  const remoteCover = isRemoteCover(movie.cover_path);
  const coverQuery = usePrivatePhotos(movie.cover_path && !remoteCover ? [movie.cover_path] : [], Boolean(movie.cover_path && !remoteCover));
  const coverUrl = remoteCover ? movie.cover_path : coverQuery.data?.find((item: any) => item.path === movie.cover_path)?.url;
  const coverInput = useRef<HTMLInputElement>(null);
  const [watching, setWatching] = useState(false);
  const [watchSaving, setWatchSaving] = useState(false);
  const [watchDate, setWatchDate] = useState(date);
  const [companionId, setCompanionId] = useState("alone");
  const [editing, setEditing] = useState(false);
  const [newTitle, setNewTitle] = useState(String(movie.title ?? ""));
  const [newDuration, setNewDuration] = useState(String(movie.target_minutes ?? ""));
  const [newGenre, setNewGenre] = useState(String(movie.genre ?? ""));
  const [newYear, setNewYear] = useState(String(movie.publication_year ?? ""));
  const [findingPoster, setFindingPoster] = useState(false);
  const [uploading, setUploading] = useState(false);
  const orderedSessions = [...sessions].sort((a: any, b: any) => String(b.session_date ?? "").localeCompare(String(a.session_date ?? "")) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));

  useEffect(() => setWatchDate(date), [date]);
  useEffect(() => setNewTitle(String(movie.title ?? "")), [movie.title]);
  useEffect(() => setNewDuration(String(movie.target_minutes ?? "")), [movie.target_minutes]);
  useEffect(() => setNewGenre(String(movie.genre ?? "")), [movie.genre]);
  useEffect(() => setNewYear(String(movie.publication_year ?? "")), [movie.publication_year]);

  const findPoster = async () => {
    setFindingPoster(true);
    try {
      const cover = await lookupLearningCover({ kind: "movie", title: newTitle.trim() || movie.title });
      if (!cover) {
        toast.info("No encontré un póster para esta película.");
        return;
      }
      await onUpdate({ cover_path: cover });
      toast.success("Póster actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo buscar el póster.");
    } finally {
      setFindingPoster(false);
    }
  };

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const nextPath = await privateMediaService.uploadPhoto(file);
      await onUpdate({ cover_path: nextPath });
      if (movie.cover_path && !remoteCover && movie.cover_path !== nextPath) {
        await privateMediaService.removePhoto(String(movie.cover_path)).catch(() => undefined);
      }
      toast.success("Póster actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo subir el póster.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const saveDetails = async () => {
    if (!newTitle.trim()) {
      toast.error("El nombre no puede quedar vacío.");
      return;
    }
    const minutes = Number(newDuration);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1000) {
      toast.error("La duración debe estar entre 1 y 1000 minutos.");
      return;
    }
    if (newGenre.trim().length > 80) {
      toast.error("Selecciona un género válido.");
      return;
    }
    const year = newYear.trim() ? Number(newYear) : null;
    if (year !== null && (!Number.isInteger(year) || year < 1888 || year > 2100)) {
      toast.error("Indica un año de estreno válido.");
      return;
    }
    await onUpdate({ title: newTitle.trim(), target_minutes: minutes, genre: newGenre.trim() || null, publication_year: year });
    setEditing(false);
    toast.success("Ficha de película actualizada.");
  };

  const saveWatch = async () => {
    const parsedDate = new Date(`${watchDate}T12:00:00-05:00`);
    if (!watchDate || Number.isNaN(parsedDate.getTime())) {
      toast.error("Selecciona una fecha válida.");
      return;
    }
    setWatchSaving(true);
    try {
      const selectedPerson = companionId === "alone" ? null : people.find((person: any) => person.id === companionId);
      await onRecordWatch(movie, watchDate, selectedPerson?.id ?? null);
      setWatching(false);
      setCompanionId("alone");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar la visualización.");
    } finally {
      setWatchSaving(false);
    }
  };

  return <article className="glass overflow-hidden rounded-2xl">
    <div className="flex gap-3 p-3">
      <div className="relative w-[92px] shrink-0">
        <div className="aspect-[2/3] overflow-hidden rounded-xl border bg-gradient-to-br from-slate-900 via-purple-950 to-slate-950">
          {coverUrl
            ? <CoverLightbox src={coverUrl} alt={`Póster de ${movie.title}`} title={movie.title} imageClassName="h-full w-full object-cover" />
            : <div className="flex h-full flex-col items-center justify-between p-2 text-center text-white">
                <Film className="mt-1 h-6 w-6 opacity-80" />
                <span className="line-clamp-5 break-words text-[10px] font-semibold leading-tight">{movie.title}</span>
                <span className="text-[8px] uppercase tracking-[.18em] opacity-65">Películas</span>
              </div>}
        </div>
        <button type="button" onClick={() => coverInput.current?.click()} disabled={uploading} aria-label="Cambiar póster" title="Cambiar póster" className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border bg-background text-foreground shadow transition hover:bg-accent disabled:opacity-50">
          <ImagePlus className="h-3.5 w-3.5" />
        </button>
        <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif" className="sr-only" onChange={uploadCover} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 font-semibold leading-snug">{movie.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatRuntime(movie.target_minutes)}{movie.genre ? ` · ${movie.genre}` : ""}{movie.publication_year ? ` · ${movie.publication_year}` : ""}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sessions.length ? `${sessions.length} visualización${sessions.length === 1 ? "" : "es"} · última: ${orderedSessions[0]?.session_date}` : "Aún no la has marcado como vista"}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onDelete} aria-label={`Eliminar ${movie.title}`}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" onClick={() => { setWatchDate(date); setCompanionId("alone"); setWatching((value) => !value); }}>
            <Check className="mr-1 h-3.5 w-3.5" />{watching ? "Cerrar" : "Marcar como vista"}
          </Button>
          <Button size="sm" type="button" variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />Editar ficha
          </Button>
        </div>
      </div>
    </div>
    {watching && <div className="space-y-2 border-t bg-muted/20 p-3">
      <p className="text-sm font-semibold">Registrar visualización</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">Fecha en que la viste
          <Input className="mt-1" type="date" value={watchDate} max={date} onChange={(event) => setWatchDate(event.target.value)} />
        </label>
        <label className="text-xs text-muted-foreground">¿La viste solo o con alguien?
          <select className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm text-foreground" value={companionId} onChange={(event) => setCompanionId(event.target.value)}>
            <option value="alone">La vi solo</option>
            {people.map((person: any) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select>
        </label>
      </div>
      {people.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay personas en Relaciones. Puedes agregar contactos allí y aparecerán en esta lista.</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setWatching(false)}>Cancelar</Button>
        <Button size="sm" disabled={watchSaving} onClick={() => void saveWatch()}>
          <Save className="mr-1 h-3.5 w-3.5" />Guardar visualización
        </Button>
      </div>
    </div>}
    {editing && <div className="space-y-2 border-t bg-muted/20 p-3">
      <p className="text-sm font-semibold">Editar ficha</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input aria-label="Nombre de la película" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
        <Input aria-label="Duración en minutos" type="number" min="1" max="1000" value={newDuration} onChange={(event) => setNewDuration(event.target.value)} />
        <label className="space-y-1 text-xs text-muted-foreground">Género
          <select aria-label="Género" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={newGenre} onChange={(event) => setNewGenre(event.target.value)}>
            <option value="">Sin especificar</option>
            {["Acción","Aventura","Animación","Ciencia ficción","Comedia","Crimen","Documental","Drama","Fantasía","Musical","Misterio","Romance","Suspenso","Terror","Thriller psicológico","Bélica","Western"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <Input aria-label="Año de estreno" type="number" min="1888" max="2100" placeholder="Año de estreno" value={newYear} onChange={(event) => setNewYear(event.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void saveDetails()}><Save className="mr-1 h-3.5 w-3.5" />Guardar</Button>
        <Button size="sm" variant="outline" disabled={findingPoster} onClick={() => void findPoster()}><Search className="mr-1 h-3.5 w-3.5" />{findingPoster ? "Buscando…" : "Buscar póster"}</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cerrar</Button>
      </div>
    </div>}
    {orderedSessions.length > 0 && <div className="space-y-1 border-t p-3">
      <p className="text-xs font-semibold">Historial de visualizaciones</p>
      {orderedSessions.slice(0, 4).map((session: any) => (
        <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2 py-1.5 text-xs">
          <span>{session.session_date} · {session.notes?.replace(`Película: ${movie.title} · `, "") || "Vista"}</span>
          <span className="text-muted-foreground">{formatRuntime(session.minutes)}</span>
        </div>
      ))}
    </div>}
  </article>;
}

