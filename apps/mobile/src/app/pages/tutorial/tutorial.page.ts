import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonButtons } from '@ionic/angular/ion-buttons';
import { IonContent } from '@ionic/angular/ion-content';
import { IonHeader } from '@ionic/angular/ion-header';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonItem } from '@ionic/angular/ion-item';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { LanguageService } from '../../core/i18n/language.service';
import { StorageKey, StorageService } from '../../core/storage/storage.service';

/** Acción del botón que cierra cada diapositiva. */
type SlideAction = 'language' | 'login' | 'signup' | 'start';

interface TutorialSlide {
  image: string;
  title: string;
  description?: string;
  action: SlideAction;
  buttonLabel?: string;
}

@Component({
  selector: 'app-tutorial',
  templateUrl: 'tutorial.page.html',
  styleUrls: ['tutorial.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslatePipe,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonSelect,
    IonSelectOption,
  ],
})
export class TutorialPage {
  private readonly router = inject(Router);
  private readonly storage = inject(StorageService);
  private readonly language = inject(LanguageService);

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  readonly currentLanguage = signal(this.language.current());
  readonly languages = this.language.available;
  readonly currentIndex = signal(0);

  readonly slides: readonly TutorialSlide[] = [
    {
      image: './assets/imgs/ica-slidebox-img-1.png',
      title: 'TUTORIAL.SLIDE_1.TITLE',
      description: 'TUTORIAL.SLIDE_1.DESCRIPTION',
      action: 'language',
    },
    {
      image: './assets/imgs/ica-slidebox-img-2.png',
      title: 'TUTORIAL.SLIDE_2.TITLE',
      description: 'TUTORIAL.SLIDE_2.DESCRIPTION',
      action: 'login',
      buttonLabel: 'TUTORIAL.LOGIN_BUTTON',
    },
    {
      image: './assets/imgs/ica-slidebox-img-3.png',
      title: 'TUTORIAL.SLIDE_3.TITLE',
      description: 'TUTORIAL.SLIDE_3.DESCRIPTION',
      action: 'signup',
      buttonLabel: 'TUTORIAL.SIGN_UP_BUTTON',
    },
    {
      image: './assets/imgs/ica-slidebox-img-4.png',
      title: 'TUTORIAL.SLIDE_4.TITLE',
      action: 'start',
      buttonLabel: 'TUTORIAL.CONTINUE_BUTTON',
    },
  ];

  async changeLanguage(lang: string): Promise<void> {
    this.currentLanguage.set(this.language.normalize(lang));
    await this.language.use(lang);
  }

  /** Recuerda que el tutorial ya se vio y sigue a la ruta indicada. */
  async finish(target: string): Promise<void> {
    await this.storage.set(StorageKey.HasSeenTutorial, true);
    await this.router.navigateByUrl(target);
  }

  async act(action: SlideAction): Promise<void> {
    switch (action) {
      case 'login':
        await this.finish('/login');
        break;
      case 'signup':
        await this.finish('/signup');
        break;
      case 'start':
      case 'language':
        await this.finish(environment.mainUrl);
        break;
    }
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;

    if (element.clientWidth > 0) {
      this.currentIndex.set(Math.round(element.scrollLeft / element.clientWidth));
    }
  }

  /** Lleva el carrusel a una diapositiva; `currentIndex` lo actualiza el propio scroll. */
  goTo(index: number): void {
    const element = this.track().nativeElement;
    const target = Math.min(Math.max(index, 0), this.slides.length - 1);

    element.scrollTo({ left: target * element.clientWidth, behavior: 'smooth' });
  }

  onKeydown(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;

    if (step === 0) {
      return;
    }

    // El desplazamiento propio del navegador movería píxeles sueltos; aquí
    // interesa saltar de diapositiva completa.
    event.preventDefault();
    this.goTo(this.currentIndex() + step);
  }
}
