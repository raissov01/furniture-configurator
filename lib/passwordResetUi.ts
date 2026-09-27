export function resetEmailError(value: string): string | null {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim()) && value.length <= 254
    ? null : 'Почта: укажите действительный адрес'
}

export function resetPasswordError(value: string): string | null {
  return value.length >= 8 && value.length <= 1024 ? null : 'Пароль: допустимо 8–1024 символа'
}
