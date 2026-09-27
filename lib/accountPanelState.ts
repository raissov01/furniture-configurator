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

export function canSubmitAccount(mode: AccountMode, form: AccountForm, invited: boolean): boolean {
  return Object.keys(accountFormErrors(mode, form, invited)).length === 0
}
