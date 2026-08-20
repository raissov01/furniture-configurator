/**
 * Валидация қатесі. UI-ға ПАРАМЕТР АТЫ мен РҰҚСАТ ЕТІЛГЕН АРАЛЫҚ жетуі керек —
 * "invalid config" деген хабар цехта ешкімге көмектеспейді.
 */
export class ConfigValidationError extends Error {
  constructor(
    /** Конфигтегі жол: "cabinet.depth", "fronts.count" */
    readonly field: string,
    message: string,
    /** Адам оқитын аралық: "≥ 100 мм", "1..6" */
    readonly allowed?: string,
  ) {
    super(allowed ? `${field}: ${message} (рұқсат етілген: ${allowed})` : `${field}: ${message}`)
    this.name = 'ConfigValidationError'
  }
}
