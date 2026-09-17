import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'hashtag'; value: string; tag: string }
  | { kind: 'mention'; value: string; name: string }
  | { kind: 'url'; value: string; href: string };

const TOKEN =
  /(#[\p{L}\p{N}_]{2,50})|(@[a-z0-9](?:[a-z0-9_-]{1,28}[a-z0-9])?)|(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])/giu;

/**
 * Texto de una publicación, un comentario o una biografía.
 *
 * Convierte en enlaces lo que lo es —las #etiquetas llevan a su página, las
 * @menciones al perfil y las direcciones fuera— sin interpretar HTML: el texto
 * se parte en trozos y cada uno se pinta como texto o como enlace, así que lo
 * que escriba alguien nunca llega a ser marcado.
 *
 * Con `clamp` corta los textos largos y ofrece «Ver más», como Facebook.
 */
@Component({
  selector: 'app-rich-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslatePipe],
  template: `@for (segment of segments(); track $index) {@switch (segment.kind) {@case ('hashtag') {<a class="link" [routerLink]="['/hashtag', segment.tag]">{{ segment.value }}</a>}@case ('mention') {<a class="link" [routerLink]="['/profile', segment.name]">{{ segment.value }}</a>}@case ('url') {<a class="link" [href]="segment.href" target="_blank" rel="noopener noreferrer nofollow">{{ segment.value }}</a>}@default {{{ segment.value }}}}}@if (truncated()) {… <button type="button" class="more" (click)="expand($event)">{{ 'COMMON.SEE_MORE' | translate }}</button>}`,
  styles: `
    :host {
      display: block;
      overflow-wrap: anywhere;
      white-space: pre-line;
    }

    .link {
      color: var(--ion-color-primary);
      font-weight: 500;
    }

    .link:hover {
      text-decoration: underline;
    }

    .more {
      background: none;
      border: 0;
      cursor: pointer;
      font-weight: 600;
      padding: 0;
    }

    .more:hover {
      text-decoration: underline;
    }
  `,
})
export class RichTextComponent {
  readonly text = input<string | null | undefined>('');
  /** Caracteres a partir de los cuales se corta; 0 enseña siempre todo. */
  readonly clamp = input(0);

  readonly expanded = signal(false);

  readonly truncated = computed(() => {
    const limit = this.clamp();

    return limit > 0 && !this.expanded() && (this.text()?.length ?? 0) > limit + 40;
  });

  readonly segments = computed<Segment[]>(() => {
    let text = this.text() ?? '';
    const limit = this.clamp();

    if (this.truncated()) {
      const cut = text.lastIndexOf(' ', limit);
      text = text.slice(0, cut > limit * 0.6 ? cut : limit);
    }

    return tokenize(text);
  });

  expand(event: Event): void {
    // La tarjeta entera abre la publicación; «Ver más» sólo despliega el texto.
    event.stopPropagation();
    this.expanded.set(true);
  }
}

function tokenize(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;

  for (const match of text.matchAll(TOKEN)) {
    const index = match.index;
    const [value, hashtag, mention, url] = match;

    if (index > last) {
      segments.push({ kind: 'text', value: text.slice(last, index) });
    }

    if (hashtag) {
      segments.push({ kind: 'hashtag', value, tag: hashtag.slice(1).toLowerCase() });
    } else if (mention) {
      segments.push({ kind: 'mention', value, name: mention.slice(1) });
    } else if (url) {
      segments.push({ kind: 'url', value: url.replace(/^https?:\/\/(www\.)?/, ''), href: url });
    }

    last = index + value.length;
  }

  if (last < text.length) {
    segments.push({ kind: 'text', value: text.slice(last) });
  }

  return segments;
}
