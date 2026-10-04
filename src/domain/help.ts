/**
 * Global contextual help registry. Any module declares short help entries here
 * (help_key → title + description) and renders them with <HelpTip helpKey="…" />.
 * Keep descriptions to one or two sentences.
 */
export interface HelpEntry {
  title: string;
  description: string;
}

export const HELP: Record<string, HelpEntry> = {
  // Medicamentos
  "medication.dose": {
    title: "Dosis",
    description: "Cuánto tomas en cada toma. Ej.: 1 Tableta. Se usa para calcular cuánto te queda.",
  },
  "medication.total": {
    title: "Cantidad total",
    description:
      "Lo que trae la caja o frasco al empezar. Con la dosis y los horarios calculamos cuántos días te alcanza.",
  },
  "medication.duration": {
    title: "Duración estimada",
    description:
      "Cantidad total ÷ (dosis × tomas por día). Si no pones fecha de fin, se usa esta estimación.",
  },
  "medication.remaining": {
    title: "Restantes",
    description: "Cantidad total menos lo que ya marcaste como tomado.",
  },
  "medication.water": {
    title: "Agua con la toma",
    description:
      "Los vasos de agua que tomaste con esta dosis. Puedes cambiarlo en cada toma; se cuenta aparte del agua normal.",
  },
  // Hidratación
  "hydration.medication": {
    title: "Agua con medicamentos",
    description:
      "Suma automática del agua que marcaste al registrar tomas. Si deshaces una toma, su agua se descuenta.",
  },
  // Diezmo
  "tithe.basis": {
    title: "Criterio del diezmo",
    description: "Indica qué ingresos usa Personal OS para calcular tu diezmo.",
  },
  "tithe.generated": {
    title: "Generado",
    description: "El diezmo que generaron los ingresos de este período según tu criterio y porcentaje.",
  },
  "tithe.paid": {
    title: "Pagado",
    description: "Gastos de este período marcados como pago de diezmo.",
  },
  "tithe.pending": {
    title: "Pendiente",
    description: "Lo que aún debes, sumando lo pendiente de períodos anteriores.",
  },
  "tithe.credit": {
    title: "A favor",
    description: "Lo que pagaste de más. Se descuenta automáticamente del próximo diezmo generado.",
  },
  "tithe.carry": {
    title: "Saldo anterior",
    description: "Lo que venía de antes de este período: pendiente (debes) o a favor (pagaste de más).",
  },
  "dashboard": { title: "Inicio", description: "Resumen del día basado en registros reales de Personal OS." },
  "habits": { title: "Hábitos", description: "Registra constancia diaria, contadores, notas e historial usando la fecha global." },
  "planner": { title: "Planeador", description: "Organiza tareas y eventos por fecha, hora, prioridad y categoría." },
  "finance": { title: "Finanzas", description: "Registra ingresos, gastos, cuentas y movimientos con datos persistentes." },
  "journal": { title: "Diario", description: "Registra experiencias, reflexiones, estado de ánimo y recuerdos por fecha." },
  "profile": { title: "Perfil", description: "Personaliza identidad, apariencia y preferencias globales de Personal OS." },
  "life.alarms": { title: "Alarmas", description: "Recordatorios con fecha, hora y repetición. La notificación se activa con permiso del navegador." },
  "life.shopping": { title: "Lista de mercado", description: "Registra compras pendientes rápidamente. Marcar un artículo no borra su historial." },
  "health.metrics": { title: "Métricas de salud", description: "Guarda mediciones por la fecha global. Puedes registrar peso, estatura, cintura, sueño, ejercicio y agua." },
  "health.bmi": { title: "IMC", description: "Se calcula automáticamente como peso en kg dividido por estatura en metros al cuadrado." },
  "learning": { title: "Aprendizaje", description: "Agrupa cursos, libros, idiomas, ajedrez, videos y certificaciones sin crear dominios separados." },
  "relationships": { title: "Relaciones", description: "Registra personas importantes y señales de seguimiento para cuidar relaciones, no para sustituir una agenda de contactos." },
  "work": { title: "Trabajo", description: "Centraliza tareas, proyectos, tiempo, clientes, objetivos e ideas de trabajo." },
  "spirituality": { title: "Espiritualidad", description: "Espacio opcional y neutral para oración, meditación, lecturas, gratitud o reflexiones." },
  "ai.personal": { title: "IA Personal", description: "Analiza datos que ya existen en Personal OS. No inventa registros ni depende de un chatbot para funcionar." },
  "gamification": { title: "Gamificación", description: "XP y niveles para reforzar constancia y equilibrio, sin castigar los días difíciles." },
  // Configuración
  "settings.help": {
    title: "Ayudas contextuales",
    description: "Muestra u oculta los iconos ⓘ de explicación en todo Personal OS.",
  },
};

export const TITHE_BASIS_HELP: Record<string, string> = {
  all_income: "Suma todo lo que entra, sin restar costos.",
  net_income: "Suma cada ingreso menos los costos que registraste en él.",
  marked: "Solo los ingresos que marcaste “cuenta para diezmo”, sin restar costos.",
  custom: "Solo ingresos marcados, restando sus costos.",
};