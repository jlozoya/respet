import { Injectable, inject } from '@angular/core';
import { ModalController } from '@ionic/angular/modal-controller';
import type { Post } from '@social-network/shared';

import { StoryCreatorComponent } from '../stories/story-creator.component';
import { PostComposerComponent } from './post-composer.component';

/**
 * Abre las ventanas de crear: publicación e historia.
 *
 * Se abren desde muchos sitios —la barra superior, la de pestañas, la tarjeta
 * «¿Qué estás pensando?», el menú de una publicación para editarla— y todos
 * lo hacen igual.
 */
@Injectable({ providedIn: 'root' })
export class CreateService {
  private readonly modalCtrl = inject(ModalController);

  /** Publicar, editar o compartir. Devuelve la publicación resultante. */
  async post(
    options: { edit?: Post; share?: Post; openFiles?: boolean } = {},
  ): Promise<Post | null> {
    const modal = await this.modalCtrl.create({
      component: PostComposerComponent,
      componentProps: {
        post: options.edit ?? null,
        sharedPost: options.share ?? null,
        openFiles: options.openFiles ?? false,
      },
      cssClass: 'rs-dialog',
    });

    await modal.present();
    const { data, role } = await modal.onWillDismiss<Post>();

    return role === 'published' && data ? data : null;
  }

  async story(): Promise<boolean> {
    const modal = await this.modalCtrl.create({
      component: StoryCreatorComponent,
      cssClass: 'rs-fullscreen',
    });

    await modal.present();
    const { role } = await modal.onWillDismiss();

    return role === 'published';
  }
}
