import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../public/embed.js', import.meta.url), 'utf8');

function embed(attributes: Record<string, string>, hasScript = true) {
  const links: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const script = {
    src: 'https://allpaid.example/embed.js',
    getAttribute: (name: string) => attributes[name] ?? null,
    nextSibling: null,
    parentNode: { insertBefore: (link: Record<string, unknown>) => links.push(link) },
  };
  runInNewContext(source, {
    URL,
    location: { href: 'https://team.example/' },
    console: { warn: (message: string) => warnings.push(message) },
    document: {
      currentScript: hasScript ? script : null,
      createElement: () => ({ setAttribute() {} }),
    },
  });
  return { links, warnings };
}

describe('Allpaid embed', () => {
  it.each(['data-allpaid', 'data-jar'])('opens a jar from %s on the embed host', (attribute) => {
    const { links, warnings } = embed({ [attribute]: 'https://team.example/jar#jar_CODE-1' });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      href: 'https://allpaid.example/jar#jar_CODE-1',
      target: '_blank',
      rel: 'noopener',
      textContent: 'Pay this team on BCH',
    });
    expect(warnings).toEqual([]);
  });

  it('prefers data-allpaid and keeps a custom label', () => {
    const { links } = embed({ 'data-allpaid': 'new_code', 'data-jar': 'old_code', 'data-label': 'Tip the show' });
    expect(links[0]).toMatchObject({ href: 'https://allpaid.example/jar#new_code', textContent: 'Tip the show' });
  });

  it.each(['', 'javascript:alert(1)'])('rejects an empty or invalid jar code (%s)', (code) => {
    const { links, warnings } = embed({ 'data-allpaid': code });
    expect(links).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Allpaid embed');
  });

  it('does nothing when there is no current script', () => {
    expect(embed({}, false)).toEqual({ links: [], warnings: [] });
  });
});
