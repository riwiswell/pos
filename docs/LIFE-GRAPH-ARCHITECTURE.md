# PERSONAL OS — Life Graph Architecture

## Principio

Personal OS es un solo sistema. Vida, Hábitos, Salud, Finanzas, Diario, Aprendizaje, Relaciones, Trabajo, Espiritualidad, IA, Gamificación y Configuración son dominios conceptuales. No son aplicaciones aisladas.

**Registrar una vez → reutilizar muchas veces.**

## Núcleo de entidades

- Vida: planner_items, life_goals, routines, routine_logs, checklists, checklist_items, bucket_list, alarms.
- Hábitos: habits, habit_categories, habit_logs.
- Salud: health_metrics, medications, medication_doses, medical_appointments, nutrition_logs, menstrual_profiles, menstrual_records.
- Finanzas: finance_accounts, finance_categories, finance_transactions, finance_budgets, finance_debts, finance_savings_goals, finance_investments, finance_external_sources, finance_external_snapshots.
- Diario: journal_entries + fotografías/archivos.
- Aprendizaje: learning_items, learning_notes, learning_sessions, language_profiles.
- Relaciones: relationships, relationship_interactions.
- Trabajo: work_items, work_sessions.
- Espiritualidad: spiritual_entries.
- IA: ai_runs + eventos + consultas cruzadas del Life Graph.
- Gamificación: gamification_profiles, gamification_achievements, gamification_challenges.
- Configuración: profiles y preferencias por usuario.

## Grafo transversal

life_links es el mecanismo explícito para relaciones entre entidades sin crear tablas duplicadas por cada combinación de dominios.

Ejemplos:
- journal_entry → work_item = became_project
- work_item proyecto → checklist = has_checklist
- checklist → goal = supports_goal
- work_item → work_item tarea = contains_task
- work_session → work_item = worked_on
- learning_session → language_profile = practiced_language
- relationship_interaction → relationship = interaction_with
- health_metric → life_goal = measures_progress
- habit_log → life_goal = supports_goal
- cualquier evento importante → life_events

No se debe duplicar una entidad para obtener contexto en otro dominio.

## Tiempo

Todo registro temporal utiliza la fecha global ?date=YYYY-MM-DD cuando el concepto es una fecha de usuario.

Los procesos con hora real usan timestamptz:
- alarmas;
- citas;
- sesiones de trabajo;
- toma real de medicamentos;
- eventos.

Una actividad planificada y su ejecución son cosas distintas.

Ejemplo de medicamento:
scheduled_at = 12:00
taken_at = 12:45

El retraso no modifica la hora programada; conserva ambas.

## Trabajo y descanso

Un proyecto es un work_item con kind=project.

Las tareas son work_items con parent_work_item_id.

Una sesión de trabajo registra:
- started_at
- ended_at
- minutes
- status
- target_minutes

Al iniciar una sesión se programa un notification_job para descanso. El job lo procesa el worker en segundo plano.

La IA puede detectar bloques demasiado largos, exceso de horas en el día, concentración en un proyecto, falta de pausas y proyectos con mucho tiempo y poco avance.

## Diario → Trabajo

Una idea nace como journal_entry tipo idea.

Puede permanecer como captura, desarrollarse durante múltiples ediciones y, cuando el usuario lo decide, convertirse en un work_item tipo project.

La captura original permanece.

El proyecto queda enlazado al origen mediante:
- journal_entries.linked_work_item_id
- work_items.source_journal_entry_id
- life_links.relation = became_project

Así el Diario conserva la historia y Trabajo adquiere estructura.

## Relaciones → Alarmas

Los cumpleaños y aniversarios son propiedades de relationships.

No se crean manualmente como duplicados en Alarmas.

Un trigger genera notification_jobs con anticipación.

Alarmas es un dominio de notificación; el origen continúa siendo Relaciones.

## Salud → Alarmas

Una medical_appointment genera sus propios notification_jobs.

Un medication_dose mantiene su scheduled_at y puede registrar taken_at real.

El usuario puede corregir una toma tardía sin destruir el calendario de dosis.

## Aprendizaje

Un learning_item de tipo book puede almacenar total_pages, current_page, progreso, summary y learning_notes por sección/páginas.

Los idiomas utilizan language_profiles:
- language_code
- locale_code
- country_name
- nivel actual
- nivel objetivo
- áreas de enfoque

Ejemplos:
- Portuguese → pt-BR → Brasil
- Portuguese → pt-PT → Portugal
- English → en-US → Estados Unidos
- English → en-GB → Reino Unido

La sesión de estudio se registra separadamente y puede indicar habilidad:
speaking, listening, reading, writing, vocabulary, grammar.

## Espiritualidad opcional

No existe una práctica obligatoria.

Cada usuario puede ocultar funciones concretas desde Perfil/Configuración.

Ejemplos:
- ocultar Ayuno;
- mantener oración;
- registrar reflexión;
- registrar profecías fechadas como texto libre.

El contenido largo utiliza Tiptap.

## IA

La IA no recibe un formulario de preguntas.

Consume el Life Graph existente.

Capas:
1. Señales: reglas deterministas y métricas.
2. Contexto: snapshot temporal del usuario.
3. Relaciones: life_links y life_events.
4. Recomendaciones: acciones concretas.
5. Historial: ai_runs.
6. Proveedor generativo opcional: capa intercambiable; nunca acoplar el producto a un proveedor.

La IA debe preferir frases como:
“Llevas 67 minutos en una sesión activa. Es un buen momento para descansar.”

y evitar inventar causas o diagnósticos.

## Notificaciones persistentes

El frontend puede funcionar localmente cuando está abierto.

Para avisos con Personal OS cerrado:

domain event → notification_jobs → worker/cron → Web Push → service worker

El worker debe procesar jobs vencidos, eliminar suscripciones inválidas, marcar jobs enviados, reprogramar recurrentes y evitar duplicados.

## Seguridad

Todas las tablas de usuario tienen user_id, RLS y policies usando auth.uid(). Los grants se limitan a authenticated.

El servidor utiliza secretos exclusivamente en backend.

## Configuración por usuario

profiles concentra:
- identidad;
- tema;
- foto/fondo;
- help_enabled;
- module_order;
- hidden_modules;
- hidden_features;
- dashboard_widgets;
- notification_preferences.

Esto permite que dos usuarios tengan el mismo Personal OS con distinta configuración.

## Flujo transversal de ejemplo

“Se me ocurrió crear una aplicación”

1. Diario → Idea.
2. Tiptap guarda la idea completa.
3. Usuario pulsa Convertir en proyecto.
4. Se crea Work Item project.
5. Se enlaza Diario ↔ Trabajo.
6. El proyecto recibe tareas.
7. Las tareas pueden tener checklist.
8. Se inicia una sesión de trabajo.
9. Se programa una pausa a los 50 minutos.
10. Al finalizar se calcula tiempo real.
11. Gamificación puede otorgar XP.
12. Dashboard resume trabajo.
13. IA ve tiempo, avance, metas y otros dominios.
14. El usuario no tuvo que copiar la idea de una aplicación a otra.

## Regla de diseño

No añadir una tabla o pantalla únicamente porque otro módulo necesita el dato.

Primero buscar:
- una entidad existente;
- life_links;
- life_events;
- una vista derivada;
- o una relación temporal.

Crear una entidad nueva solo cuando representa un concepto real distinto.
