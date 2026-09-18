import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonCol } from '@ionic/angular/ion-col';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonItem } from '@ionic/angular/ion-item';
import { IonList } from '@ionic/angular/ion-list';
import { IonRow } from '@ionic/angular/ion-row';
import { IonTextarea } from '@ionic/angular/ion-textarea';
import { IonToolbar } from '@ionic/angular/ion-toolbar';
import { TranslatePipe } from '@ngx-translate/core';

import { SupportService } from '../../core/api/content.service';
import { BrandingService } from '../../core/branding/branding.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { phoneValidator } from '../../shared/validators/form-validators';
import { BrandComponent } from '../shell/brand.component';

@Component({
  selector: 'app-footer',
  templateUrl: 'footer.component.html',
  styleUrls: ['footer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ControlMessagesComponent,
    BrandComponent,
    IonToolbar,
    IonRow,
    IonCol,
    IonButton,
    IonIcon,
    IonItem,
    IonList,
    IonInput,
    IonTextarea,
  ],
})
export class FooterComponent {
  private readonly support = inject(SupportService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  private readonly branding = inject(BrandingService);

  /** Enlaces y contacto de la instalación; lo que no esté configurado no se pinta. */
  readonly links = this.branding.links;
  readonly address = computed(() => this.branding.branding().address);

  readonly submitting = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    phone: ['', [phoneValidator()]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      // Marcarlos como tocados es lo que hace aparecer los mensajes de error
      // en los campos que el usuario aún no ha visitado.
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);

    try {
      const { name, phone, email, message } = this.form.getRawValue();

      await this.feedback.withLoading(
        () =>
          this.support.send({
            name,
            email,
            message,
            ...(phone ? { phone } : {}),
            lang: this.language.current(),
          }),
        'SENDING_MESSAGE',
      );

      this.form.reset();
      await this.feedback.toast('MESSAGE_SENT', { color: 'success' });
    } catch (error) {
      await this.feedback.error(error, 'ERRORS.SENDING_MESSAGE');
    } finally {
      this.submitting.set(false);
    }
  }

  goToAbout(): void {
    void this.router.navigateByUrl('/about');
  }

  goToPolitics(segment: string): void {
    void this.router.navigate(['/politics', segment]);
  }
}
