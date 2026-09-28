/** Account dialog decisions shared by input, button state and request handlers. */
export const MAX_SHOP_NAME_LENGTH = 100
export const MIN_ACCOUNT_PASSWORD_LENGTH = 8

export type AccountForm = { email: string; password: string; shopName: string }
export type AccountMode = 'login' | 'register'

export function accountFormErrors(mode: AccountMode, form: AccountForm, invited: boolean) {
  const errors: { email?: string; password?: string; shopName?: string } = {}
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
    errors.email = 'Почта: укажите адрес вида name@example.com'
  }
  if (mode === 'register' ? form.password.length < MIN_ACCOUNT_PASSWORD_LENGTH : form.password.length === 0) {
    errors.password = mode === 'register' ? 'Пароль: от 8 символов' : 'Пароль: введите пароль'
  }
  if (mode === 'register' && !invited && form.shopName.trim().length > MAX_SHOP_NAME_LENGTH) {
    errors.shopName = 'Название цеха: от 0 до 100 символов'
  }
  return errors
}

/** Бос алғашқы формада қате көрсетілмейді; өңделген өрістің себебі ғана көрінеді. */
export function visibleAccountErrors(mode: AccountMode, form: AccountForm, invited: boolean,
  touched: Partial<Record<keyof AccountForm, boolean>>, submitted = false) {
  const errors = accountFormErrors(mode, form, invited)
  return {
    ...((submitted || touched.email) && errors.email ? { email: errors.email } : {}),
    ...((submitted || touched.password) && errors.password ? { password: errors.password } : {}),
    ...((submitted || touched.shopName) && errors.shopName ? { shopName: errors.shopName } : {}),
  }

}

export function canSubmitAccount(mode: AccountMode, form: AccountForm, invited: boolean): boolean {
  return Object.keys(accountFormErrors(mode, form, invited)).length === 0
}

export function inviteShopDisplay(token: string | null, shopName: string | null) {
  return token ? { editable: false, name: shopName } : { editable: true, name: null }
}

export function memberRemovalWarning(self: boolean): string {
  return self
    ? 'Ваш аккаунт будет удалён. Вы больше не сможете войти. Удалить аккаунт и уйти?'
    : 'Аккаунт участника будет удалён. Он больше не сможет войти. Удалить аккаунт?'
}

export function revokeError(ok: boolean, serverError: string | null): string | null {
  return ok ? null : serverError || 'Не удалось отозвать приглашение'
}

export function shouldCloseAccountOnKey(key: string, isTop: boolean, busy: boolean): boolean {
  return key === 'Escape' && isTop && !busy
}
