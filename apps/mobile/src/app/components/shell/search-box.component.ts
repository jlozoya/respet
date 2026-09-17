import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import type { Hashtag, PublicProfile } from '@respet/shared';

import { SocialService } from '../../core/api/social.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { UserNameComponent } from '../../shared/components/user-name.component';
import { CompactNumberPipe } from '../../shared/pipes/compact-number.pipe';

/**
 * El buscador de la barra superior.
 *
 * Mientras se escribe enseña personas y etiquetas en un desplegable; Intro
 * lleva a la página de resultados, con publicaciones incluidas.
 */
@Component({
  selector: 'app-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IonIcon, IonSpinner, AvatarComponent, UserNameComponent, CompactNumberPipe],
  template: `
    <label class="rs-pill-input">
      <ion-icon name="search" />
      <input
        type="search"
        [value]="term()"
        [placeholder]="'SEARCH_PAGE.PLACEHOLDER' | translate"
        (input)="onInput($any($event.target).value)"
        (focus)="open.set(true)"
        (keydown.enter)="submit()"
        (keydown.escape)="open.set(false)"
      />
      @if (loading()) {
        <ion-spinner name="crescent" />
      }
    </label>

    @if (open() && term().trim().length > 1) {
      <div class="dropdown">
        @for (user of users(); track user.id) {
          <button type="button" class="rs-row" (click)="go(['/profile', user.name])">
            <app-avatar [user]="user" [size]="36" [ring]="user.hasUnseenStory ? 'unseen' : 'none'" />
            <span class="rs-row-text">
              <app-user-name class="title" [user]="user" [link]="false" />
              <span class="subtitle">&#64;{{ user.name }}</span>
            </span>
          </button>
        }
        @for (tag of hashtags(); track tag.tag) {
          <button type="button" class="rs-row" (click)="go(['/hashtag', tag.tag])">
            <span class="rs-row-icon">#</span>
            <span class="rs-row-text">
              <span class="title">#{{ tag.tag }}</span>
              <span class="subtitle">{{ 'SEARCH_PAGE.POST_COUNT' | translate: { count: (tag.postCount | compactNumber) } }}</span>
            </span>
          </button>
        }
        <button type="button" class="rs-row see-all" (click)="submit()">
          <span class="rs-row-icon"><ion-icon name="search" /></span>
          <span class="rs-row-text">
            <span class="title">{{ 'SEARCH_PAGE.SEARCH_FOR' | translate: { term: term() } }}</span>
          </span>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      position: relative;
      width: 100%;
    }

    ion-spinner {
      height: 16px;
      width: 16px;
    }

    .dropdown {
      background: var(--rs-surface);
      border-radius: var(--rs-radius-sm);
      box-shadow: var(--rs-shadow-2);
      left: 0;
      max-height: 70vh;
      overflow-y: auto;
      padding: 8px;
      position: absolute;
      right: 0;
      top: calc(100% + 6px);
      z-index: 20;
    }

    .rs-row-icon {
      font-weight: 700;
    }
  `,
})
export class SearchBoxComponent {
  private readonly social = inject(SocialService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly term = signal('');
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly users = signal<PublicProfile[]>([]);
  readonly hashtags = signal<Hashtag[]>([]);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private request = 0;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(this.host.nativeElement as HTMLElement).contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  onInput(value: string): void {
    this.term.set(value);
    this.open.set(true);

    if (this.timer) {
      clearTimeout(this.timer);
    }

    if (value.trim().length < 2) {
      this.users.set([]);
      this.hashtags.set([]);

      return;
    }

    this.timer = setTimeout(() => void this.search(value.trim()), 250);
  }

  submit(): void {
    const term = this.term().trim();

    if (term) {
      this.go(['/search'], { q: term });
    }
  }

  go(commands: string[], queryParams?: Record<string, string>): void {
    this.open.set(false);
    void this.router.navigate(commands, { queryParams });
  }

  private async search(term: string): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);

    try {
      const results = await this.social.quickSearch(term, 6);

      // Una respuesta lenta de lo que se escribió antes no pisa a la última.
      if (request === this.request) {
        this.users.set(results.users);
        this.hashtags.set(results.hashtags.slice(0, 4));
      }
    } catch {
      // El desplegable se queda como estaba.
    } finally {
      if (request === this.request) {
        this.loading.set(false);
      }
    }
  }
}
