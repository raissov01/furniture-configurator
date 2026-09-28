'use client'

/**
 * Аккаунт: тіркелу, кіру, бұлттағы жобалар.
 *
 * Кірмеген цех бәрібір толық жұмыс істейді — дерек браузерде жатады.
 * Кіргенде профиль мен жобалар СЕРВЕРГЕ көшеді: басқа компьютерден де,
 * қайта орнатқаннан кейін де сол жерде тұрады.
 */

import { t as tr } from '@/lib/i18n'
import { LIBRARY_AUTH_CHANGED_EVENT } from '@/lib/librarySyncUi'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { parseProjectV4, parseShopProfile } from '@/src/core/index'
import { addCloudFolder, moveProjectToFolder, organizeProjects, parseCloudOrg } from '@/src/core/cloudProjectOrganize'
import type { CloudOrg } from '@/src/core/cloudProjectOrganize'
import { CLOUD_SELECTION_KEY, canCreateFolder, cloudCopyProject, cloudSaveOutcome, cloudSavePayload, deleteFolder, parseCloudSelection, renameFolder, shouldMigrateCloudOrg } from '@/lib/f24UiLogic'
import type { CloudSelection } from '@/lib/f24UiLogic'
import { useConfigurator } from '@/store/configurator'
import { Button, Field } from '@/components/ui'
import { CommentsInbox } from '@/components/CommentsInbox'
import { accountFormErrors, canSubmitAccount, inviteShopDisplay, memberRemovalWarning, revokeError, shouldCloseAccountOnKey } from '@/lib/accountPanelState'
import { visibleErrors } from '@/lib/validationVisibility'
import { useModalLayer } from '@/lib/useModalLayer'
import { bindCloudProject } from '@/lib/cloudProjectBinding'
import { installationCreateAction } from '@/lib/installationHandoff'
import Link from 'next/link'
import { can } from '@/lib/permissions'
import { resetEmailError } from '@/lib/passwordResetUi'

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
type InstallationRow = { id: string; projectId: string; status: 'open' | 'closed'; updatedAt: number }
type Member = { userId: string; email: string; joinedAt: number; role: Account['role'] }
type Invite = { token: string; createdAt: number; expiresAt: number; usedBy: string | null; revoked: boolean; role: 'designer' | 'shop' }

const input =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm outline-none ' +
  'focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-300'

export function AccountPanel() {
  const open = useConfigurator((s) => s.accountOpen)
  const setOpen = useConfigurator((s) => s.setAccountOpen)
  const { zIndex, isTop } = useModalLayer(open, 'account')
  const dialogRef = useRef<HTMLDivElement>(null)
  const shop = useConfigurator((s) => s.shop)
  const setShop = useConfigurator((s) => s.setShop)
  const exportProject = useConfigurator((s) => s.exportProject)
  const loadProject = useConfigurator((s) => s.loadProject)
  const projectEpoch = useConfigurator((s) => s.projectEpoch)

  const [account, setAccount] = useState<Account | null>(null)
  const canEditProjects = account ? can(account.role, 'editProject') : false
  const [profileReady, setProfileReady] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetTouched, setResetTouched] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', shopName: '' })
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({})
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [installations, setInstallations] = useState<InstallationRow[]>([])
  const [org, setOrg] = useState<CloudOrg>(() => parseCloudOrg(null))
  const [folderFilter, setFolderFilter] = useState<'all' | 'unfiled' | `folder:${string}`>('all')
  const [newFolder, setNewFolder] = useState('')
  const [renameDraft, setRenameDraft] = useState('')
  const [selectedCloud, setSelectedCloud] = useState<CloudSelection | null>(null)
  const [selectedEpoch, setSelectedEpoch] = useState<number | null>(null)
  const activeCloud = selectedEpoch === projectEpoch ? selectedCloud : null
  const [cloudConflict, setCloudConflict] = useState<{ id: string; revision: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ProjectRow | null>(null)
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
  const [cloudRetry, setCloudRetry] = useState(false)
  const [busy, setBusy] = useState(false)
  const formErrors = accountFormErrors(mode, form, Boolean(invite))
  const visibleFormErrors = visibleErrors(formErrors, formTouched, formSubmitted)
  const formReady = canSubmitAccount(mode, form, Boolean(invite)) && (!invite || mode === 'login' || inviteShopName !== null)
  const inviteShop = inviteShopDisplay(invite, inviteShopName)

  const requestReset = async () => {
    setResetTouched(true)
    if (resetEmailError(form.email) || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/password/request', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: form.email }) })
      const result = (await response.json()) as { error?: string; delivery?: 'smtp' | 'server-log' }
      if (!response.ok) setError(result.error ?? tr('Не получилось'))
      else setNotice(tr(result.delivery === 'server-log' ? 'Ссылка записана на сервере. Обратитесь к администратору.'
        : 'Если адрес зарегистрирован, письмо отправлено.'))
    } catch { setError(tr('Нет связи с сервером')) }
    finally { setBusy(false) }
  }

  const resetMember = async (userId: string) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/team/member/password', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
      const result = (await response.json()) as { error?: string; delivery?: 'smtp' | 'server-log' }
      if (!response.ok) setError(result.error ?? tr('Не получилось'))
      else setNotice(tr(result.delivery === 'server-log' ? 'Ссылка записана на сервере. Обратитесь к администратору.'
        : 'Ссылка для смены пароля отправлена участнику.'))
    } catch { setError(tr('Нет связи с сервером')) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (!open) return
    dialogRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (!shouldCloseAccountOnKey(event.key, isTop, busy)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isTop, busy, setOpen])

  useEffect(() => {
    try {
      const saved = parseCloudSelection(window.sessionStorage.getItem(CLOUD_SELECTION_KEY))
      if (saved) { setSelectedCloud(saved); setSelectedEpoch(useConfigurator.getState().projectEpoch) }
    } catch (cause) { console.warn('Бұлт таңбасын оқу мүмкін болмады', cause) }
  }, [])

  const rememberCloud = (selected: CloudSelection) => {
    setSelectedCloud(selected)
    setSelectedEpoch(useConfigurator.getState().projectEpoch)
    try { window.sessionStorage.setItem(CLOUD_SELECTION_KEY, JSON.stringify(selected)) }
    catch (cause) { console.warn('Бұлт таңбасын сақтау мүмкін болмады', cause) }
  }
  const forgetCloud = () => {
    setSelectedCloud(null)
    try { window.sessionStorage.removeItem(CLOUD_SELECTION_KEY) }
    catch (cause) { console.warn('Бұлт таңбасын өшіру мүмкін болмады', cause) }
  }

  useEffect(() => {
    if (!account) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/api/projects/organize')
        if (!response.ok) throw new Error(tr('Папки не загрузились'))
        const data = await response.json() as { org: CloudOrg }
        let next = parseCloudOrg(JSON.stringify(data.org))
        const legacyKey = `cloud-folders:${account.userId}`
        const legacy = window.localStorage.getItem(legacyKey)
        if (shouldMigrateCloudOrg(next, legacy)) {
          const migrated = parseCloudOrg(legacy)
          const saved = await fetch('/api/projects/organize', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: migrated }) })
          if (!saved.ok) throw new Error(tr('Папки не сохранились'))
          next = migrated
        }
        if (legacy) window.localStorage.removeItem(legacyKey)
        if (!cancelled) setOrg(next)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером'))
      }
    })()
    return () => { cancelled = true }
  }, [account?.userId])

  const saveOrg = async (next: CloudOrg): Promise<boolean> => {
    if (!account) return false
    setCloudRetry(false)
    try {
      const response = await fetch('/api/projects/organize', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ org: next }) })
      if (!response.ok) throw new Error(tr('Папки не сохранились'))
      setOrg(next)
      setError(null)
      return true
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером')); return false }
  }

  const refreshTeam = useCallback(async () => {
    const res = await fetch('/api/team')
    if (!res.ok) return
    setTeam((await res.json()) as { members: Member[]; invites: Invite[]; limit: number | null })
  }, [])

  const refreshProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error(tr('Проекты не загрузились'))
      const data = (await res.json()) as { projects?: ProjectRow[] }
      setProjects(data.projects ?? [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером')) }
  }, [])

  const refreshInstallations = useCallback(async () => {
    const response = await fetch('/api/installation', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error(tr('Не удалось загрузить монтажные задания'))
    const data = await response.json() as { tasks: InstallationRow[] }
    setInstallations(data.tasks)
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
        if (data.account.role === 'owner') void refreshInstallations().catch((cause: unknown) =>
          setError(cause instanceof Error ? cause.message : tr('Не удалось загрузить монтажные задания')))
        void refreshTeam()
        void syncProfile(data.account.role)
      }
    })()
  }, [refreshProjects, refreshTeam, refreshInstallations])

  const startInstallation = async (projectId: string) => {
    setBusy(true)
    setError(null)
    try {
      const action = installationCreateAction(projectId, crypto.randomUUID(), crypto.randomUUID(), Date.now())
      const response = await fetch('/api/installation/sync', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action) })
      const body = await response.json() as { kind?: string; error?: string }
      if (!response.ok || body.kind !== 'applied') throw new Error(body.error ?? tr('Не удалось создать монтажное задание'))
      await refreshInstallations()
      setNotice(tr('Монтажное задание открыто'))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('Не удалось создать монтажное задание'))
    } finally { setBusy(false) }
  }

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
    setFormSubmitted(true)
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
      window.dispatchEvent(new Event(LIBRARY_AUTH_CHANGED_EVENT))
      setForm({ email: '', password: '', shopName: '' })
      setFormTouched({})
      setFormSubmitted(false)
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
        window.dispatchEvent(new Event(LIBRARY_AUTH_CHANGED_EVENT))
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

  const saveToCloud = async (copy = false, useConflictRevision = false) => {
    setBusy(true)
    setError(null)
    setCloudRetry(false)
    const localCopyError = useConfigurator.getState().saveProjectLocally()
    try {
      const selection = useConflictRevision && cloudConflict && activeCloud
        ? { id: cloudConflict.id, revision: cloudConflict.revision }
        : activeCloud
      const project = exportProject()
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudSavePayload(project, selection, copy)),
      })
      const data = (await res.json()) as { id?: string; revision?: number; error?: string }
      const outcome = cloudSaveOutcome(res.status, data, copy ? null : selection)
      if (outcome.kind === 'conflict') {
        setCloudConflict({ id: outcome.id, revision: outcome.revision })
        setError(tr('Проект изменён в другой вкладке. Выберите версию.'))
      } else if (outcome.kind === 'error') {
        setError(outcome.message)
      } else {
        rememberCloud(outcome.selection)
        await bindCloudProject(outcome.selection.id, project)
        setCloudConflict(null)
        await refreshProjects()
      }
    } catch {
      setCloudRetry(true)
      setError(localCopyError
        ? `${tr('Нет связи с сервером. Локальная копия не сохранена.')} ${localCopyError}`
        : tr('Нет связи с сервером. Локальная копия остаётся в браузере. Повторите сохранение.'))
    } finally {
      setBusy(false)
    }
  }

  const openProject = async (id: string) => {
    setCloudRetry(false)
    try {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) throw new Error(tr('Проект не загрузился'))
      const data = (await res.json()) as { project?: unknown; revision?: number }
      if (!Number.isSafeInteger(data.revision)) throw new Error(tr('Нет версии проекта'))
      const parsed = parseProjectV4(data.project)
      loadProject(parsed)
      rememberCloud({ id, revision: data.revision! })
      await bindCloudProject(id, parsed)
      setCloudConflict(null)
      setError(null)
      setOpen(false)
    } catch (e) {
      setError(`Проект не открылся: ${e instanceof Error ? e.message : 'неверная форма'}`)
    }
  }

  const deleteCloudProject = async (project: ProjectRow) => {
    setBusy(true)
    setCloudRetry(false)
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(tr('Проект не удалился'))
      if (activeCloud?.id === project.id) {
        forgetCloud()
      }
      setConfirmDelete(null)
      await refreshProjects()
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером')) }
    finally { setBusy(false) }
  }

  const copyCloudProject = async (project: ProjectRow) => {
    setBusy(true)
    setError(null)
    setCloudRetry(false)
    try {
      const source = await fetch(`/api/projects/${project.id}`)
      if (!source.ok) throw new Error(tr('Проект не загрузился'))
      const data = await source.json() as { project?: unknown }
      const copy = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cloudSavePayload(cloudCopyProject(parseProjectV4(data.project), projects.map((row) => row.name)), null, true)) })
      if (!copy.ok) {
        const failure = await copy.json() as { error?: string }
        throw new Error(failure.error ?? tr('Проект не сохранился'))
      }
      await refreshProjects()
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr('Нет связи с сервером')) }
    finally { setBusy(false) }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 flex items-start justify-center overflow-auto bg-black/40 p-2 sm:p-4"
      style={{ zIndex }}
      onClick={() => { if (isTop && !busy) setOpen(false) }}
    >
      <div
        ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={tr('Аккаунт')}
        className="min-w-0 w-full max-w-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-900 sm:p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{account ? tr(account.shopName) : tr('Вход в аккаунт')}</h2>
          <div className="ml-auto">
            <Button onClick={() => setOpen(false)} disabled={busy}>{tr('Закрыть')}</Button>
          </div>
        </div>

        {error ? (
          <div role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <p>{error}</p>
            {cloudRetry
              ? <Button disabled={busy} onClick={() => void saveToCloud()}>{tr('Повторить сохранение')}</Button> : null}
          </div>
        ) : null}
        {notice ? <p role="status" className="mb-3 border border-neutral-300 px-2.5 py-2 text-xs dark:border-neutral-700">{notice}</p> : null}
        {cloudConflict && activeCloud ? <div role="alert" className="mb-3 flex flex-wrap gap-2 border border-amber-400 p-2 text-xs">
          <span className="w-full">{tr('Серверная версия новее. Выберите, какую версию оставить.')} {tr('Ревизия сервера')}: {cloudConflict.revision}</span>
          <Button disabled={busy} onClick={() => void openProject(cloudConflict.id)}>{tr('Открыть серверную')}</Button>
          <Button disabled={busy} onClick={() => void saveToCloud(true)}>{tr('Сохранить мою копию')}</Button>
          <Button disabled={busy} onClick={() => void saveToCloud(false, true)}>{tr('Заменить серверную')}</Button>
        </div> : null}

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
                        <span className="min-w-0 break-all">
                          {m.email}
                          <span className="ml-1 whitespace-nowrap text-xs text-neutral-600">{owner ? tr('владелец') : m.role === 'shop' ? tr('Цех') : tr('Дизайнер')}</span>
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
                          {account.role === 'owner' && !owner ? <Button disabled={busy} onClick={() => void resetMember(m.userId)}>{tr('Сбросить пароль')}</Button> : null}
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

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                {tr('Проекты в облаке')}
              </span>
              {canEditProjects ? <span className="flex flex-wrap gap-2">
                <Button onClick={() => void saveToCloud()} disabled={busy} active>{tr('Сохранить текущий')}</Button>
                <Button onClick={() => void saveToCloud(true)} disabled={busy}>{tr('Сохранить копию')}</Button>
              </span> : null}
            </div>
            {activeCloud ? <p className="text-xs text-neutral-500">{tr('Открыт облачный проект')}: {projects.find((project) => project.id === activeCloud.id)?.name ?? activeCloud.id}</p> : null}

            <div className="grid gap-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-700 sm:grid-cols-2">
              <label>{tr('Папка')}
                <select className={input} value={folderFilter} onChange={(event) => setFolderFilter(event.target.value as typeof folderFilter)}>
                  <option value="all">{tr('Все папки')}</option>
                  <option value="unfiled">{tr('Без папки')}</option>
                  {org.folders.map((folder) => <option key={folder} value={`folder:${folder}`}>{folder}</option>)}
                </select>
              </label>
              <label>{tr('Сортировка')}
                <select className={input} disabled={!canEditProjects} value={org.sort} onChange={(event) => void saveOrg({ ...org, sort: event.target.value as CloudOrg['sort'] })}>
                  <option value="date">{tr('По дате')}</option>
                  <option value="name">{tr('По названию')}</option>
                </select>
              </label>
              <label className="sm:col-span-2">{tr('Новая папка')}
                <span className="flex gap-2">
                  <input className={input} disabled={!canEditProjects} value={newFolder} maxLength={80} onChange={(event) => setNewFolder(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && canCreateFolder(newFolder)) { event.preventDefault(); try { void saveOrg(addCloudFolder(org, newFolder)).then((saved) => { if (saved) setNewFolder('') }) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) } } }} />
                  <Button onClick={() => {
                    try {
                      const next = addCloudFolder(org, newFolder)
                      void saveOrg(next).then((saved) => { if (saved) setNewFolder('') })
                    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
                  }} disabled={!canEditProjects || !canCreateFolder(newFolder)}>{tr('Добавить')}</Button>
                </span>
              </label>
              {canEditProjects && folderFilter.startsWith('folder:') ? <div className="sm:col-span-2 flex flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1">{tr('Переименовать папку')}
                  <input className={input} value={renameDraft} maxLength={80} onChange={(event) => setRenameDraft(event.target.value)} placeholder={folderFilter.slice(7)} />
                </label>
                <Button disabled={!renameDraft.trim()} onClick={() => { try { void saveOrg(renameFolder(org, folderFilter.slice(7), renameDraft)).then((saved) => { if (saved) { setFolderFilter(`folder:${renameDraft.trim()}`); setRenameDraft('') } }) } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) } }}>{tr('Переименовать')}</Button>
                <Button onClick={() => { void saveOrg(deleteFolder(org, folderFilter.slice(7))).then((saved) => { if (saved) setFolderFilter('all') }) }}>{tr('Удалить папку')}</Button>
              </div> : null}
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
                    className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-xs dark:border-neutral-700"
                  >
                    <button type="button" className="min-w-0 flex-1 basis-full text-left sm:basis-auto" onClick={() => void openProject(p.id)}>
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-2 tabular-nums text-neutral-400">
                        {new Date(p.updatedAt).toLocaleDateString('ru-RU')}
                      </span>
                    </button>
                    {account.role === 'owner' && (() => {
                      const task = installations.find((item) => item.projectId === p.id)
                      return task
                        ? <Link className="min-h-11 border border-neutral-300 bg-white px-2 py-3 dark:bg-neutral-900" href={`/mobile/installation?task=${encodeURIComponent(task.id)}`} onClick={() => setOpen(false)}>
                          {tr('Монтаж')}: {task.status === 'closed' ? tr('Завершён') : tr('Открыт')}
                        </Link>
                        : <Button disabled={busy} onClick={() => void startInstallation(p.id)}>{tr('Отправить в производство → открыть монтаж')}</Button>
                    })()}
                    <select aria-label={`${tr('Папка')}: ${p.name}`} disabled={!canEditProjects} className="max-w-28 rounded border border-neutral-300 bg-white p-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                      value={org.projectFolders[p.id] ?? ''} onChange={(event) => void saveOrg(moveProjectToFolder(org, p.id, event.target.value || null))}>
                      <option value="">{tr('Без папки')}</option>
                      {org.folders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                    </select>
                    {canEditProjects ? <Button disabled={busy} onClick={() => void copyCloudProject(p)}>{tr('Копировать')}</Button> : null}
                    {canEditProjects ? <Button
                      disabled={busy} title={`${tr('Удалить проект')}: ${p.name}`} onClick={() => setConfirmDelete(p)}
                    >
                      {tr('Удалить')}
                    </Button> : null}
                  </li>
                ))}
              </ul>
            )}
            {confirmDelete ? <div role="alertdialog" aria-label={tr('Удалить проект')} className="border border-red-400 p-2 text-xs">
              <p>{tr('Удалить проект')} «{confirmDelete.name}»?</p>
              <div className="mt-2 flex gap-2"><Button disabled={busy} onClick={() => void deleteCloudProject(confirmDelete)}>{tr('Удалить')}</Button><Button onClick={() => setConfirmDelete(null)}>{tr('Отмена')}</Button></div>
            </div> : null}

            {(account.role === 'owner' || account.role === 'designer') ? <CommentsInbox /> : null}
            <div className="border-t border-neutral-200 pt-3 dark:border-neutral-700">
              <Button
                onClick={() => void (async () => {
                  await fetch('/api/auth/logout', { method: 'POST' })
                  setAccount(null)
                  window.dispatchEvent(new Event(LIBRARY_AUTH_CHANGED_EVENT))
                  setProjects([])
                  forgetCloud()
                })()}
              >
                {tr('Выйти')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-1">
              <Button active={!resetOpen && mode === 'login'} onClick={() => { setMode('login'); setResetOpen(false); setFormTouched({}); setFormSubmitted(false) }}>{tr('Вход')}</Button>
              <Button active={!resetOpen && mode === 'register'} onClick={() => { setMode('register'); setResetOpen(false); setFormTouched({}); setFormSubmitted(false) }}>{tr('Регистрация')}</Button>
            </div>

            {resetOpen ? <>
              <Field label={tr('Почта')}>
                <input className={`${input} ${resetTouched && resetEmailError(form.email) ? 'border-red-600' : ''}`}
                  type="email" autoComplete="email" value={form.email}
                  aria-invalid={Boolean(resetTouched && resetEmailError(form.email))}
                  onChange={(event) => { setForm({ ...form, email: event.target.value }); setResetTouched(true) }} />
                {resetTouched && resetEmailError(form.email) ? <span role="alert" className="text-xs text-red-700">{tr(resetEmailError(form.email)!)}</span> : null}
              </Field>
              <Button disabled={busy} onClick={() => void requestReset()}>{tr('Отправить ссылку')}</Button>
              <p className="text-xs text-neutral-600">{tr('Ссылка действует 30 минут и только один раз.')}</p>
            </> : <>

            {mode === 'register' && inviteShop.editable ? (
              <Field label={tr('Название цеха')} hint={tr('Пустое название станет «Мой цех»; до 100 символов')}>
                <input className={`${input} ${visibleFormErrors.shopName ? 'border-red-500 dark:border-red-500' : ''}`} value={form.shopName} placeholder={tr('Цех «Алаш»')}
                  aria-invalid={Boolean(visibleFormErrors.shopName)}
                  onBlur={() => setFormTouched((current) => ({ ...current, shopName: true }))}
                  onChange={(e) => { setFormTouched((current) => ({ ...current, shopName: true })); setForm({ ...form, shopName: e.target.value }) }} />
                {visibleFormErrors.shopName ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(visibleFormErrors.shopName)}</span> : null}
              </Field>
            ) : mode === 'register' ? (
              <Field label={tr('Название цеха')} hint={tr('Цех по приглашению — изменить нельзя')}>
                <input className={input} value={inviteShop.name ?? tr('Проверяется приглашение…')} readOnly />
              </Field>
            ) : null}

            <Field label={tr('Почта')}>
              <input className={`${input} ${visibleFormErrors.email ? 'border-red-500 dark:border-red-500' : ''}`} type="email" autoComplete="email" value={form.email}
                aria-invalid={Boolean(visibleFormErrors.email)}
                onBlur={() => setFormTouched((current) => ({ ...current, email: true }))}
                onChange={(e) => { setFormTouched((current) => ({ ...current, email: true })); setForm({ ...form, email: e.target.value }) }} />
              {visibleFormErrors.email ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(visibleFormErrors.email)}</span> : null}
            </Field>
            <Field label={tr('Пароль')} hint={mode === 'register' ? tr('от 8 символов') : undefined}>
              <input className={`${input} ${visibleFormErrors.password ? 'border-red-500 dark:border-red-500' : ''}`} type="password"
                aria-invalid={Boolean(visibleFormErrors.password)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={form.password}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                onBlur={() => setFormTouched((current) => ({ ...current, password: true }))}
                onChange={(e) => { setFormTouched((current) => ({ ...current, password: true })); setForm({ ...form, password: e.target.value }) }} />
              {visibleFormErrors.password ? <span role="alert" className="block text-xs text-red-700 dark:text-red-400">{tr(visibleFormErrors.password)}</span> : null}
            </Field>

            <Button onClick={() => void submit()} disabled={busy || !formReady} active>
              {mode === 'login' ? tr('Войти') : tr('Создать аккаунт')}
            </Button>
            {mode === 'login' ? <button type="button" className="block text-sm underline" onClick={() => { setResetOpen(true); setError(null); setNotice(null) }}>{tr('Забыли пароль?')}</button> : null}

            <p className="text-[11px] leading-snug text-neutral-400">
              {tr('Без аккаунта конфигуратор работает полностью — данные лежат в этом браузере. Аккаунт нужен, чтобы профиль цеха и проекты были доступны с другого компьютера.')}
            </p>
            </>}
          </div>
        )}
      </div>
    </div>
  )
}
