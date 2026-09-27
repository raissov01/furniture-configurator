'use client'

/**
 * Аккаунт: тіркелу, кіру, бұлттағы жобалар.
 *
 * Кірмеген цех бәрібір толық жұмыс істейді — дерек браузерде жатады.
 * Кіргенде профиль мен жобалар СЕРВЕРГЕ көшеді: басқа компьютерден де,
 * қайта орнатқаннан кейін де сол жерде тұрады.
 */

import { t as tr } from '@/lib/i18n'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseProjectV4, parseShopProfile } from '@/src/core/index'
import { addCloudFolder, moveProjectToFolder, organizeProjects, parseCloudOrg } from '@/src/core/cloudProjectOrganize'
import type { CloudOrg } from '@/src/core/cloudProjectOrganize'
import { useConfigurator } from '@/store/configurator'
import { Button, Field } from '@/components/ui'
import { CommentsInbox } from '@/components/CommentsInbox'
import { accountFormErrors, canSubmitAccount, inviteShopDisplay, memberRemovalWarning, revokeError } from '@/lib/accountPanelState'

// `userId` серверден бұрыннан келеді — командадағы «мен қайсымын» деген
// сұраққа жауап беру үшін керек (өз жолыңда «Шығу» тұрады).
type Account = { userId: string; email: string; shopName: string; role: 'owner' | 'designer' | 'shop' | 'client' }
type PlanInfo = {
  id: string
  name: string
  note: string
  /** `null` — шексіз */
  projects: number | null
  members: number | null
  /** Тиынмен; `null` — қойылмаған («келісіледі») */
  price: number | null
  until: number | null
  expired: boolean
}
type ProjectRow = { id: string; name: string; updatedAt: number }
type Member = { userId: string; email: string; joinedAt: number; role: Account['role'] }
type Invite = { token: string; createdAt: number; expiresAt: number; usedBy: string | null; revoked: boolean; role: 'designer' | 'shop' }

const input =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ' +
  'focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300'

export function AccountPanel() {
  const open = useConfigurator((s) => s.accountOpen)
  const setOpen = useConfigurator((s) => s.setAccountOpen)
  const shop = useConfigurator((s) => s.shop)
  const setShop = useConfigurator((s) => s.setShop)
  const exportProject = useConfigurator((s) => s.exportProject)
  const loadProject = useConfigurator((s) => s.loadProject)

  const [account, setAccount] = useState<Account | null>(null)
  const [profileReady, setProfileReady] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ email: '', password: '', shopName: '' })
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [org, setOrg] = useState<CloudOrg>(() => parseCloudOrg(null))
  const [folderFilter, setFolderFilter] = useState<'all' | 'unfiled' | `folder:${string}`>('all')
  const [newFolder, setNewFolder] = useState('')
  const visibleProjects = useMemo(() => organizeProjects(projects, org, folderFilter), [projects, org, folderFilter])
  const [plan, setPlan] = useState<PlanInfo | null>(null)
  /** Ақы алу қосулы ма (сервер айтады). Тегін кезеңде тариф көрсетілмейді. */
  const [billing, setBilling] = useState(false)
  const [team, setTeam] = useState<{ members: Member[]; invites: Invite[]; limit: number | null } | null>(null)
  /** Жаңа шақырудың сілтемесі — көшіріп алу үшін бір рет көрсетіледі. */
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviteRole, setInviteRole] = useState<'designer' | 'shop'>('designer')
  /**
   * Шығарылуы РАСТАЛУЫН күтіп тұрған адам.
   *
   * Екі басу: адамды цехтан шығару — қайтарылмайтын әрекет, ал батырма
   * тізімде, тінтуірдің астында тұр. Бірінші басу сұрақ қояды, екіншісі
   * орындайды.
   */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  /**
   * Шақыру сілтемесімен келген адамның токені (`?invite=…`).
   *
   * URL тек БРАУЗЕРДЕ бар, сондықтан оны эффектіде оқимыз: серверде оқысақ,
   * гидратация сәйкессіздігі шығады.
   */
  const [invite, setInvite] = useState<string | null>(null)
  const [inviteShopName, setInviteShopName] = useState<string | null>(null)
  const [usage, setUsage] = useState<{ projects: number; members: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const formErrors = accountFormErrors(mode, form, Boolean(invite))
  const formReady = canSubmitAccount(mode, form, Boolean(invite)) && (!invite || mode === 'login' || inviteShopName !== null)
  const inviteShop = inviteShopDisplay(invite, inviteShopName)

  useEffect(() => {
    if (!account) return
    try {
      setOrg(parseCloudOrg(window.localStorage.getItem(`cloud-folders:${account.userId}`)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setOrg(parseCloudOrg(null))
    }
  }, [account?.userId])

  const saveOrg = (next: CloudOrg) => {
    if (!account) return
    try {
      window.localStorage.setItem(`cloud-folders:${account.userId}`, JSON.stringify(next))
      setOrg(next)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    }
  }

  const refreshTeam = useCallback(async () => {
    const res = await fetch('/api/team')
    if (!res.ok) return
    setTeam((await res.json()) as { members: Member[]; invites: Invite[]; limit: number | null })
  }, [])

  const refreshProjects = useCallback(async () => {
    const res = await fetch('/api/projects')
    if (!res.ok) return
    const data = (await res.json()) as { projects?: ProjectRow[] }
    setProjects(data.projects ?? [])
  }, [])

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite')
    if (!token) return
    setInvite(token)
    // Шақырумен келген адамға тіркелу қосымшасы бірден ашылады: оның
    // аккаунты әлі жоқ, ал әдепкі «кіру» қосымшасы оны шатастырар еді.
    setMode('register')
    setOpen(true)
    void fetch(`/api/team/invite?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = (await res.json()) as { shopName?: string; error?: string }
        if (!res.ok || !data.shopName) throw new Error(data.error ?? tr('Приглашение не найдено'))
        setInviteShopName(data.shopName)
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером')))
  }, [setOpen])

  // Кім кіргенін бет ашылғанда бір рет сұраймыз.
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/me')
      const data = (await res.json()) as {
        account?: Account | null
        billing?: boolean
        plan?: PlanInfo
        usage?: { projects: number; members: number }
      }
      if (data.account) {
        setProfileReady(false)
        setAccount(data.account)
        setBilling(data.billing === true)
        setPlan(data.plan ?? null)
        setUsage(data.usage ?? null)
        void refreshProjects()
        void refreshTeam()
        void syncProfile(data.account.role)
      }
    })()
  }, [refreshProjects, refreshTeam])

  /**
   * Кіргеннен кейінгі бірінші синхрондау: серверде профиль бар болса —
   * оны аламыз, жоқ болса — өзіміздікін жібереміз. Осылайша бұрын
   * браузерде толтырылған бағалар жоғалмайды.
   */
  const syncProfile = useCallback(async (role: Account['role']) => {
    if (role === 'client') return
    try {
      const res = await fetch('/api/shop')
      if (!res.ok) { setError(tr('Профиль не загрузился')); return }
      const data = (await res.json()) as { profile?: unknown }
      if (data.profile) {
        try {
          setShop(parseShopProfile(data.profile))
          setProfileReady(true)
          return
        } catch {
          setError(tr('Профиль на сервере повреждён'))
          return
        }
      }
      if (role !== 'owner') return
      const saved = await fetch('/api/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: shop }),
      })
      if (!saved.ok) { setError(tr('Профиль не сохранился')); return }
      setProfileReady(true)
    } catch {
      setError(tr('Нет связи с сервером'))
    }
  }, [setShop, shop])

  // Кірген кезде профильдің әр өзгерісі серверге де жазылады.
  useEffect(() => {
    if (account?.role !== 'owner' || !profileReady) return
    const timer = setTimeout(() => {
      void fetch('/api/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: shop }),
      }).then((res) => {
        if (!res.ok) setError(tr('Профиль не сохранился'))
      }).catch(() => setError(tr('Нет связи с сервером')))
    }, 800)
    return () => clearTimeout(timer)
  }, [account, shop, profileReady])

  const submit = async () => {
    if (busy || !formReady) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Шақыру сілтемесімен келген адам ЖАҢА цех ашпайды, барына қосылады.
        body: JSON.stringify(mode === 'register' && invite ? { ...form, invite } : form),
      })
      const data = (await res.json()) as { account?: Account; error?: string }
      if (!res.ok || !data.account) {
        setError(data.error ?? 'Не получилось')
        return
      }
      setProfileReady(false)
      setAccount(data.account)
      setForm({ email: '', password: '', shopName: '' })
      /*
       * Үшеуі ҚАТАР жүреді. Бұрын кезекпен күтетін, ал әрқайсысы бөлек
       * баруы серверге дейінгі кідірісті ҮШ ЕСЕЛЕЙТІН: жақын тұрған дев
       * серверде байқалмайды, ал VPS-те адам «Сохранить» батырмасын
       * басқанда тізім әлі жаңармай тұрады.
       */
      await Promise.all([syncProfile(data.account.role), refreshProjects(), refreshTeam()])
    } finally {
      setBusy(false)
    }
  }

  const makeInvite = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/team', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: inviteRole }) })
      const data = (await res.json()) as { invite?: Invite; error?: string }
      if (!res.ok || !data.invite) {
        setError(data.error ?? 'Не получилось')
        return
      }
      setInviteLink(`${window.location.origin}/configurator?invite=${data.invite.token}`)
      await refreshTeam()
    } finally {
      setBusy(false)
    }
  }

  const dropInvite = async (token: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { error?: string }
      const problem = revokeError(res.ok, data.error ?? null)
      if (problem) {
        setError(tr(problem))
        return
      }
      setInviteLink(null)
      setTeam((current) => current ? {
        ...current,
        invites: current.invites.map((item) => item.token === token ? { ...item, revoked: true } : item),
      } : null)
      setNotice(tr('Приглашение отозвано.'))
    } catch {
      setError(tr('Нет связи с сервером'))
    } finally {
      setBusy(false)
    }
  }

  const removeMember = async (userId: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch('/api/team/member', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = (await res.json()) as { members?: Member[]; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Не получилось')
        setConfirmRemove(null)
        return
      }
      setConfirmRemove(null)
      setNotice(userId === account?.userId ? tr('Аккаунт удалён. Вы вышли.') : tr('Аккаунт участника удалён.'))
      // Өзін шығарған адам цехтан айырылады: сеансы серверде жойылды,
      // сондықтан терезені кірмеген күйге қайтарамыз.
      if (userId === account?.userId) {
        setAccount(null)
        setTeam(null)
        setProjects([])
        return
      }
      if (data.members) setTeam((current) => current ? { ...current, members: data.members! } : null)
      else await refreshTeam()
    } catch {
      setError(tr('Нет связи с сервером'))
      setConfirmRemove(null)
    } finally {
      setBusy(false)
    }
  }

  const saveToCloud = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project: exportProject() }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) setError(data.error ?? 'Не сохранилось')
      else await refreshProjects()
    } finally {
      setBusy(false)
    }
  }

  const openProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}`)
    if (!res.ok) return
    const data = (await res.json()) as { project?: unknown }
    try {
      loadProject(parseProjectV4(data.project))
      setOpen(false)
    } catch (e) {
      setError(`Проект не открылся: ${e instanceof Error ? e.message : 'неверная форма'}`)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-4 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{account ? account.shopName : 'Вход в аккаунт'}</h2>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {error ? (
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {error}
          </p>
        ) : null}
        {notice ? <p role="status" className="mb-3 border border-neutral-300 px-2.5 py-2 text-xs dark:border-neutral-700">{notice}</p> : null}

        {account ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-500">{account.email}</p>

            {/*
              Тариф САҚТАУ СӘТІНЕ ДЕЙІН көрінеді: цех шегіне жеткенін
              жобасын жоғалтып емес, алдын ала білуі керек.
            */}
            {billing && plan ? (
              <div className="rounded-lg border border-neutral-200 px-2.5 py-2 dark:border-neutral-800">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-medium">{tr('Тариф')}: {plan.name}</span>
                  <span className="text-[10px] tabular-nums text-neutral-400">
                    {plan.price === null
                      ? tr('цена по договорённости')
                      : `${(plan.price / 100).toLocaleString('ru-RU')} ₸`}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-400">{plan.note}</p>
                {usage ? (
                  <p className="mt-1 text-[11px] tabular-nums text-neutral-500">
                    {tr('Проектов')}: {usage.projects}
                    {plan.projects === null ? ` / ${tr('без предела')}` : ` / ${plan.projects}`}
                  </p>
                ) : null}
                {plan.expired ? (
                  <p className="mt-1 text-[11px] leading-snug text-amber-600 dark:text-amber-400">
                    {tr('Срок тарифа истёк — действуют пробные пределы. Проекты на месте.')}
                  </p>
                ) : plan.until !== null ? (
                  <p className="mt-1 text-[11px] tabular-nums text-neutral-400">
                    {tr('До')} {new Date(plan.until).toLocaleDateString('ru-RU')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {team ? (
              <div className="rounded-lg border border-neutral-200 px-2.5 py-2 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                    {tr('Команда')}
                    <span className="ml-1 tabular-nums normal-case">
                      {team.members.length}{!billing || team.limit === null ? '' : ` / ${team.limit}`}
                    </span>
                  </span>
                  {account.role === 'owner' ? (
                    <>
                      <select aria-label={tr('Роль приглашения')} value={inviteRole}
                        className="rounded border border-neutral-300 bg-white px-1 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                        onChange={(event) => setInviteRole(event.target.value as 'designer' | 'shop')}>
                        <option value="designer">{tr('Дизайнер')}</option>
                        <option value="shop">{tr('Цех')}</option>
                      </select>
                      <Button onClick={() => void makeInvite()} disabled={busy}>
                        {tr('Пригласить')}
                      </Button>
                    </>
                  ) : null}
                </div>

                {/*
                  Иесі — тізімдегі БІРІНШІ адам (цехты сол тіркеген). Оны
                  шығаруға болмайды, әрі шығара алатын да сол ғана — ережені
                  сервер де тексереді (`removeMember`).
                */}
                <ul className="mt-1.5 space-y-0.5">
                  {team.members.map((m, i) => {
                    const owner = i === 0
                    const self = m.userId === account?.userId
                    const iAmOwner = team.members[0]?.userId === account?.userId
                    const canRemove = !owner && (iAmOwner || self)
                    return (
                      <li key={m.userId} className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate">
                          {m.email}
                          <span className="ml-1 text-[10px] text-neutral-400">{owner ? tr('владелец') : m.role === 'shop' ? tr('Цех') : tr('Дизайнер')}</span>
                        </span>
                        <span className="flex shrink-0 items-baseline gap-2">
                          <span className="text-[10px] tabular-nums text-neutral-400">
                            {new Date(m.joinedAt).toLocaleDateString('ru-RU')}
                          </span>
                          {account.role === 'owner' && !owner ? <select aria-label={tr('Роль участника')} value={m.role}
                            className="rounded border border-neutral-300 bg-white px-1 dark:border-neutral-700 dark:bg-neutral-900"
                            onChange={(event) => void (async () => {
                              const res = await fetch('/api/team/member', { method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: m.userId, role: event.target.value }),
                              })
                              if (res.ok) await refreshTeam()
                              else setError(tr('Роль не изменена'))
                            })()}>
                            <option value="designer">{tr('Дизайнер')}</option>
                            <option value="shop">{tr('Цех')}</option>
                          </select> : null}
                          {canRemove ? (
                            <Button
                              disabled={busy}
                              title={self ? tr('Удалить свой аккаунт и уйти') : tr('Удалить аккаунт участника')}
                              onClick={() => {
                                if (confirmRemove === m.userId) void removeMember(m.userId)
                                else setConfirmRemove(m.userId)
                              }}
                            >
                              {confirmRemove === m.userId
                                ? busy ? tr('Удаляется…') : tr('Удалить аккаунт')
                                // «Выйти» ЕМЕС: тақтада шығудың өз батырмасы
                                // бар, екеуі бір аталса адам да, тест те
                                // шатасады.
                                : self ? tr('Уйти') : tr('Убрать')}
                            </Button>
                          ) : null}
                        </span>
                        {confirmRemove === m.userId ? (
                          <p role="alert" className="w-full min-w-0 border border-red-300 px-2 py-1 text-red-800 dark:border-red-800 dark:text-red-300">
                            {tr(memberRemovalWarning(self))}
                          </p>
                        ) : null}
                      </li>
                    )
                  })}
                </ul>

                {/*
                  Сілтеме ТЕК ЖАСАЛҒАН СӘТТЕ көрсетіледі: токен — құпия, оны
                  тізімде тұрақты ұстаудың қажеті жоқ.
                */}
                {account.role === 'owner' && inviteLink ? (
                  <div className="mt-2 space-y-1">
                    <p className="text-[11px] text-neutral-500">
                      {tr('Ссылка одноразовая и живёт 7 дней. Отправьте её сотруднику.')}
                    </p>
                    <input
                      className={input}
                      readOnly
                      value={inviteLink}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                ) : null}

                {account.role === 'owner' && team.invites.filter((i) => !i.usedBy && !i.revoked && i.expiresAt > Date.now()).length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {team.invites
                      .filter((i) => !i.usedBy && !i.revoked && i.expiresAt > Date.now())
                      .map((i) => (
                        <li key={i.token} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-neutral-500">
                            {tr('Приглашение до')} {new Date(i.expiresAt).toLocaleDateString('ru-RU')}
                          </span>
                          <Button onClick={() => void dropInvite(i.token)} disabled={busy}>
                            {tr('Отозвать')}
                          </Button>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                Проекты в облаке
              </span>
              {account.role !== 'shop' ? <Button onClick={() => void saveToCloud()} disabled={busy} active>
                Сохранить текущий
              </Button> : null}
            </div>

            <div className="grid gap-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-700 sm:grid-cols-2">
              <label>{tr('Папка')}
                <select className={input} value={folderFilter} onChange={(event) => setFolderFilter(event.target.value as typeof folderFilter)}>
                  <option value="all">{tr('Все папки')}</option>
                  <option value="unfiled">{tr('Без папки')}</option>
                  {org.folders.map((folder) => <option key={folder} value={`folder:${folder}`}>{folder}</option>)}
                </select>
              </label>
              <label>{tr('Сортировка')}
                <select className={input} value={org.sort} onChange={(event) => saveOrg({ ...org, sort: event.target.value as CloudOrg['sort'] })}>
                  <option value="date">{tr('По дате')}</option>
                  <option value="name">{tr('По названию')}</option>
                </select>
              </label>
              <label className="sm:col-span-2">{tr('Новая папка')}
                <span className="flex gap-2">
                  <input className={input} value={newFolder} maxLength={80} onChange={(event) => setNewFolder(event.target.value)} />
                  <Button onClick={() => {
                    try {
                      const next = addCloudFolder(org, newFolder)
                      saveOrg(next)
                      setNewFolder('')
                    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
                  }}>{tr('Добавить')}</Button>
                </span>
              </label>
            </div>

            {projects.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Пока пусто. Сохраните текущий проект — он откроется на любом компьютере.
              </p>
            ) : visibleProjects.length === 0 ? (
              <p className="text-xs text-neutral-500">{tr('В этой папке нет проектов.')}</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto">
                {visibleProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-700"
                  >
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openProject(p.id)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 tabular-nums text-neutral-400">
                        {new Date(p.updatedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </button>
                    <select aria-label={`${tr('Папка')}: ${p.name}`} className="max-w-28 rounded border border-neutral-300 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      value={org.projectFolders[p.id] ?? ''} onChange={(event) => saveOrg(moveProjectToFolder(org, p.id, event.target.value || null))}>
                      <option value="">{tr('Без папки')}</option>
                      {org.folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                    </select>
                    {account.role !== 'shop' ? <Button
                      onClick={() => void (async () => {
                        await fetch(`/api/projects/${p.id}`, { method: 'DELETE' })
                        await refreshProjects()
                      })()}
                    >
                      ✕
                    </Button> : null}
                  </li>
                ))}
              </ul>
            )}

            {(account.role === 'owner' || account.role === 'designer') ? <CommentsInbox /> : null}
            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Button
                onClick={() => void (async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  setAccount(null)
                  setProjects([])
                })()}
              >
                Выйти
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              <Button active={mode === 'login'} onClick={() => setMode('login')}>{tr('Вход')}</Button>
              <Button active={mode === 'register'} onClick={() => setMode('register')}>{tr('Регистрация')}</Button>
            </div>

            {mode === 'register' && inviteShop.editable ? (
              <Field label={tr('Название цеха')} hint={tr('Пустое название станет «Мой цех»; до 100 символов')}>
                <input className={`${input} ${formErrors.shopName ? 'border-red-500 dark:border-red-500' : ''}`} value={form.shopName} placeholder={tr('Цех «Алаш»')}
                  aria-invalid={Boolean(formErrors.shopName)}
                  onChange={(e) => setForm({ ...form, shopName: e.target.value })} />
                {formErrors.shopName ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(formErrors.shopName)}</span> : null}
              </Field>
            ) : mode === 'register' ? (
              <Field label={tr('Название цеха')} hint={tr('Цех по приглашению — изменить нельзя')}>
                <input className={input} value={inviteShop.name ?? tr('Проверяется приглашение…')} readOnly />
              </Field>
            ) : null}

            <Field label={tr('Почта')}>
              <input className={`${input} ${formErrors.email ? 'border-red-500 dark:border-red-500' : ''}`} type="email" autoComplete="email" value={form.email}
                aria-invalid={Boolean(formErrors.email)}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
              {formErrors.email ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(formErrors.email)}</span> : null}
            </Field>
            <Field label={tr('Пароль')} hint={mode === 'register' ? 'от 8 символов' : undefined}>
              <input className={`${input} ${formErrors.password ? 'border-red-500 dark:border-red-500' : ''}`} type="password"
                aria-invalid={Boolean(formErrors.password)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={form.password}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                onChange={(e) => setForm({ ...form, password: e.target.value })} />
              {formErrors.password ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(formErrors.password)}</span> : null}
            </Field>

            <Button onClick={() => void submit()} disabled={busy || !formReady} active>
              {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>

            <p className="text-[11px] leading-snug text-neutral-400">
              Без аккаунта конфигуратор работает полностью — данные лежат в этом браузере.
              Аккаунт нужен, чтобы профиль цеха и проекты были доступны с другого компьютера.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
