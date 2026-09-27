export function templateProjectTitles(projectName: string, rootName: string, defaultName: string, nextName: string) {
  return { projectName: projectName === defaultName ? nextName : projectName,
    rootName: rootName === defaultName ? nextName : rootName }
}
