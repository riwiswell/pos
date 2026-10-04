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