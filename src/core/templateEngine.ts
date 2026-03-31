/**
 * Simple {{VAR}} token replacer for all templates.
 * Only substitutes keys that exist in vars.
 * Unknown {{TOKEN}} placeholders are left intact — never silently replaced with ''.
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return key in vars ? vars[key] : _match   // keep original {{TOKEN}} if key missing
  })
}
