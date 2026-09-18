import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular/alert-controller';
import { TranslateService } from '@ngx-translate/core';
import type { ReportTarget } from '@social-network/shared';

import { SocialService } from '../api/social.service';
import { FeedbackService } from './feedback.service';

const REASONS = ['SPAM', 'HARASSMENT', 'HATE', 'VIOLENCE', 'NUDITY', 'FALSE_INFO', 'ANIMAL_ABUSE', 'OTHER'] as const;

/**
 * Denunciar algo: una publicación, un comentario, una persona, una historia,
 * un mensaje o un directo.
 *
 * Todas las denuncias pasan por la misma pregunta —¿qué pasa?— con los mismos
 * motivos, y llegan a moderación con el motivo escrito en el idioma de quien
 * denuncia.
 */
@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly alertCtrl = inject(AlertController);
  private readonly translate = inject(TranslateService);
  private readonly social = inject(SocialService);
  private readonly feedback = inject(FeedbackService);

  async report(targetType: ReportTarget, targetId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: this.t('REPORT_FLOW.TITLE'),
      subHeader: this.t('REPORT_FLOW.SUBTITLE'),
      inputs: REASONS.map((reason, index) => ({
        type: 'radio' as const,
        label: this.t(`REPORT_FLOW.REASONS.${reason}`),
        value: reason,
        checked: index === 0,
      })),
      buttons: [
        { text: this.t('CANCEL'), role: 'cancel' },
        { text: this.t('REPORT_FLOW.SEND'), role: 'confirm' },
      ],
    });

    await alert.present();

    const { data, role } = await alert.onWillDismiss<{ values: (typeof REASONS)[number] }>();

    if (role !== 'confirm' || !data?.values) {
      return;
    }

    try {
      await this.social.report(targetType, targetId, this.t(`REPORT_FLOW.REASONS.${data.values}`));
      await this.feedback.toast('REPORT_FLOW.THANKS', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error);
    }
  }

  private t(key: string): string {
    return this.translate.instant(key) as string;
  }
}
