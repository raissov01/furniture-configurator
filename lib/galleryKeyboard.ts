export const shouldCloseGalleryOnKey = (key: string, wizardOpen: boolean) =>
  key === 'Escape' && !wizardOpen
