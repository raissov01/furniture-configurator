/** Shared browser helpers used by the E2E runner and its boundary tests. */
export function makeHelpers({ send }, base) {
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r?.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)
    }
    return r?.result?.value
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const goto = async (path, settleMs = 9000) => {
    await send('Page.navigate', { url: `${base}${path}` })
    await wait(settleMs)
  }

  const text = () => evaluate('document.body.innerText')

  const clickText = async (label, settleMs = 900) => {
    const done = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')]
        .find((x) => x.textContent.trim() === ${JSON.stringify(label)})
      if (!b || b.disabled) return false
      b.click()
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  const clickContains = async (label, settleMs = 900) => {
    const done = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button, a')]
        .find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!b || b.disabled) return false
      b.click()
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  /**
   * Ашылмалы мәзірдегі элемент. 09-06-дан бері тақта топталған: «Смета»,
   * «Шаблоны» т.б. енді «Проект ▾», «Создать ▾» мәзірлерінің ішінде, әрі
   * мәзір жабық тұрғанда элементтері DOM-да ЖОҚ. Мәзір батырмасының мәтіні
   * «Проект ▾» болғандықтан `clickText('Проект')` оны таппайды.
   */
  const menu = async (menuLabel, itemLabel, settleMs = 900) => {
    const opened = await evaluate(`(() => {
      const b = [...document.querySelectorAll('button')]
        .find((x) => x.textContent.trim() === ${JSON.stringify(`${menuLabel} ▾`)})
      if (!b || b.disabled) return false
      b.click()
      return true
    })()`)
    if (!opened) return false
    await wait(300)
    return clickText(itemLabel, settleMs)
  }

  /** Деталировка кестесіндегі жолдар. */
  const cutListRows = () => evaluate(`(() => {
    const table = [...document.querySelectorAll('table')]
      .find((t) => t.textContent.includes('Наименование'))
    if (!table) return []
    return [...table.querySelectorAll('tbody tr')].map((r) =>
      [...r.children].map((c) => c.textContent.trim()))
  })()`)

  const setNumberByLabel = async (label, value, settleMs = 700) => {
    const done = await evaluate(`(() => {
      const l = [...document.querySelectorAll('label')]
        .find((x) => x.textContent.includes(${JSON.stringify(label)}))
      if (!l) return false
      const i = l.querySelector('input[type=number]')
      if (!i) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(i, ${JSON.stringify(String(value))})
      i.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await wait(settleMs)
    return done
  }

  /**
   * Ашық қалған терезені жабу. Бір тест құласа, келесілері оның
   * терезесіне тіреліп қалмауы керек — тестер бір-бірінен тәуелсіз.
   */
  const closeModals = async () => {
    for (let i = 0; i < 3; i += 1) {
      const closed = await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Закрыть')
        if (!b || b.disabled) return false
        b.click()
        return true
      })()`)
      if (!closed) return
      await wait(500)
    }
  }

  /**
   * Шарт орындалғанша күту.
   *
   * Тіркелген `wait(5000)` жарамайды: бұлтқа сақтау жергілікті машинада
   * 300 мс, ал алыс серверде секундтарға созылады — сол себепті аккаунт
   * тесті кейде жалған құлайтын. Енді күту НӘТИЖЕ бойынша.
   */
  const until = async (expression, timeoutMs = 20000, stepMs = 400) => {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      if (await evaluate(expression)) return true
      if (Date.now() > deadline) return false
      await wait(stepMs)
    }
  }

  const numberExpression = (label) => `(() => {
    const l = [...document.querySelectorAll('label')].find((x) => x.textContent.includes(${JSON.stringify(label)}))
    return l?.querySelector('input[type=number]')?.value ?? null
  })()`
  const numberValue = (label) => evaluate(numberExpression(label))

  // SSR initially shows the default width; hydration restores the saved config.
  const waitForNumber = (label, value, timeoutMs = 20000) =>
    until(`${numberExpression(label)} === ${JSON.stringify(String(value))}`, timeoutMs)

  const sceneCenter = async (timeoutMs = 20000) => {
    const ready = await until(`(() => {
      const canvas = document.querySelector('#scene-3d canvas')
      if (!canvas) return false
      const r = canvas.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })()`, timeoutMs)
    if (!ready) throw new Error(`3D canvas дайын болмады (${timeoutMs} мс)`)
    return evaluate(`(() => {
      const r = document.querySelector('#scene-3d canvas').getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })()`)
  }

  // An absent empty-state message is not evidence that a project was saved.
  const waitForCloudProject = (name, timeoutMs = 20000) => until(`
    [...document.querySelectorAll('.fixed.inset-0.z-50 li button > .font-medium')]
      .some((row) => row.textContent.trim() === ${JSON.stringify(name)})
  `, timeoutMs)

  return {
    evaluate, wait, until, goto, text, clickText, clickContains, menu, cutListRows,
    setNumberByLabel, closeModals, numberValue, waitForNumber, sceneCenter, waitForCloudProject,
  }
}
