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
  "global.date": { title: "Fecha global", description: "Esta es la fecha que usan los módulos de Personal OS para registrar y consultar lo que ocurre ese día. Puedes cambiarla aquí o volver a HOY." },
  "dashboard": { title: "Inicio", description: "Resumen del día basado en registros reales de Personal OS." },
  "habits": { title: "Hábitos", description: "Registra constancia diaria, contadores, notas e historial usando la fecha global." },
  "habits.summary": { title: "Resumen de hábitos", description: "Muestra el avance de tus hábitos del día. Las actividades se registran, pero no cuentan para la racha de hábitos." },
  "focus": { title: "Enfoque del día", description: "Elige una sola prioridad para la fecha actual. Puede ser un hábito, un elemento del Planeador o una frase libre." },
  "planner": { title: "Planeador", description: "Organiza tareas y eventos por fecha, hora, prioridad y categoría." },
  "finance.period": { title: "Período", description: "Define las fechas que se incluyen en las cifras, categorías, gráficos y el historial." },
  "finance.history": { title: "Historial", description: "Aquí se muestran juntos los movimientos del período, con búsqueda por nota, categoría o etiquetas." },
  "finance": { title: "Finanzas", description: "Registra ingresos, gastos, cuentas y movimientos con datos persistentes. Usa las pestañas para separar el resumen, la exploración por categorías y el historial." },
  "health": { title: "Salud", description: "Registra métricas, medicamentos, hidratación y seguimiento de salud usando la fecha global." },
  "health.medicationHistory": { title: "Historial de medicamentos", description: "Conserva las tomas registradas aunque un medicamento haya sido suspendido. Aquí puedes revisar qué medicamento se programó, para qué fecha y si fue tomada, omitida, pospuesta o quedó pendiente." },
  "life": { title: "Vida", description: "Centraliza listas, metas, alarmas y otras herramientas prácticas de la vida diaria." },
  "journal": { title: "Diario", description: "Registra experiencias, reflexiones, estado de ánimo y recuerdos por fecha." },
  "profile": { title: "Perfil", description: "Personaliza identidad, apariencia y preferencias globales de Personal OS." },
  "life.alarms": { title: "Alarmas", description: "Recordatorios con fecha, hora y repetición. La notificación se activa con permiso del navegador." },
  "life.shopping": { title: "Lista de mercado", description: "Registra compras pendientes rápidamente. Marcar un artículo no borra su historial." },
  "health.metrics": { title: "Métricas de salud", description: "Guarda mediciones por la fecha global. Puedes registrar peso, estatura, cintura, sueño, ejercicio y agua." },
  "health.body-measures": { title: "Medidas del cuerpo", description: "Registra perímetros corporales por fecha para observar evolución: cuello, hombros, pecho, cintura, brazos, cadera, muslos y pantorrillas." },
  "health.bmi": { title: "IMC", description: "Se calcula automáticamente como peso en kg dividido por estatura en metros al cuadrado." },
  "health.cycle": { title: "Ciclo menstrual", description: "Registra el inicio de cada periodo y Personal OS calcula la próxima fecha según el ciclo registrado. Puede ser tu ciclo o el de otra persona que tú registres." },
  "health.nutrition": { title: "Nutrición", description: "Registra comidas y valores nutricionales. No sustituye asesoría profesional." },
  "learning": { title: "Aprendizaje", description: "Agrupa cursos, libros, idiomas, ajedrez, videos y certificaciones sin crear dominios separados." },
  "learning.books": { title: "Libros", description: "Guarda páginas totales, página actual, restantes, porcentaje, resumen general y notas por sección." },
  "relationships": { title: "Relaciones", description: "Registra personas importantes y señales de seguimiento para cuidar relaciones, no para sustituir una agenda de contactos." },
  "work": { title: "Trabajo", description: "Centraliza tareas, proyectos, tiempo, clientes, objetivos e ideas de trabajo." },
  "spirituality": { title: "Espiritualidad", description: "Espacio opcional y neutral para oración, meditación, lecturas, gratitud o reflexiones." },
  "ai.personal": { title: "IA Personal", description: "Analiza datos que ya existen en Personal OS. No inventa registros ni depende de un chatbot para funcionar." },
  "gamification": { title: "Gamificación", description: "XP y niveles para reforzar constancia y equilibrio, sin castigar los días difíciles." },
  // Configuración
  "life.goals": { title: "Metas", description: "Objetivos con progreso, fecha, área y notas conectados al Life Graph." },
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