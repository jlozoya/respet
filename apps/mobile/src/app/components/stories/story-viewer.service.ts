import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import type { Story, UserSummary } from '@social-network/shared';

import { StoryViewerComponent } from './story-viewer.component';

/** Un bloque de historias seguidas: las de una persona, o las de una destacada. */
export interface StoryReel {
  user: UserSummary;
  stories: Story[];
  /** Título de la destacada, que sustituye a la fecha en la cabecera. */
  title?: string;
}

/** Abre el visor de historias a pantalla completa. */
@Injectable({ providedIn: 'root' })
export class StoryViewerService {
  private readonly modalCtrl = inject(ModalController);

  async open(reels: readonly StoryReel[], startReel = 0, startStoryId?: string): Promise<void> {
    if (!reels.length) {
      return;
    }

    const modal = await this.modalCtrl.create({
      component: StoryViewerComponent,
      componentProps: {
        reels,
        startReel: Math.max(0, startReel),
        startStoryId: startStoryId ?? null,
      },
      cssClass: 'rs-fullscreen',
      animated: true,
    });

    await modal.present();
    await modal.onWillDismiss();
  }
}
