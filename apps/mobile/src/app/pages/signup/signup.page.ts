import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonButton } from '@ionic/angular/ion-button';
import { IonContent } from '@ionic/angular/ion-content';
import { IonIcon } from '@ionic/angular/ion-icon';
import { IonInput } from '@ionic/angular/ion-input';
import { IonInputPasswordToggle } from '@ionic/angular/ion-input-password-toggle';
import { IonSelect } from '@ionic/angular/ion-select';
import { IonSelectOption } from '@ionic/angular/ion-select-option';
import { IonSpinner } from '@ionic/angular/ion-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { Gender } from '@respet/shared';
import { toSignal } from '@angular/core/rxjs-interop';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { SocialLoginService, type SocialProvider } from '../../core/auth/social-login.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FeedbackService } from '../../core/ui/feedback.service';
import { ControlMessagesComponent } from '../../shared/components/control-messages.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { passwordValidator } from '../../shared/validators/form-validators';

/** Tope del nombre visible que acepta el servidor. */
const MAX_NAME = 60;

/** Desde qué año se puede haber nacido, según la lista. */
const FIRST_YEAR = 1905;

@Component({
  selector: 'app-signup',
  templateUrl: './signup.page.html',
  styleUrls: ['./signup.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    PageHeaderComponent,
    ControlMessagesComponent,
    IonContent,
    IonInput,
    IonInputPasswordToggle,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonSpinner,
  ],
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly social = inject(SocialLoginService);
  private readonly language = inject(LanguageService);
  private readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);

  readonly genders = [
    { value: Gender.Female, label: 'FEMALE' },
    { value: Gender.Male, label: 'MALE' },
    // El tercer valor del enumerado sigue siendo `other`; lo que cambia es
    // cómo se ofrece: quien no se reconoce en los dos primeros no tiene por
    // qué declararse «otro».
    { value: Gender.Unspecified, label: 'PREFER_NOT_TO_SAY' },
  ];

  /**
   * Ya no se pide un «nombre de usuario» aparte.
   *
   * El nombre visible sale de juntar el nombre y el apellido, que es lo que
   * cualquiera habría escrito en los tres campos; uno menos que rellenar. La
   * contraseña tampoco se pide dos veces: el ojo del propio campo deja
   * comprobar lo escrito, que es a lo que servía repetirla.
   */
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName: ['', [Validators.required, Validators.maxLength(60)]],
    birthDay: [null as number | null, [Validators.required]],
    birthMonth: [null as number | null, [Validators.required]],
    birthYear: [null as number | null, [Validators.required]],
    gender: [null as Gender | null],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(190)]],
    password: ['', [Validators.required, passwordValidator()]],
  });

  /** Años a elegir, del actual hacia atrás, como en cualquier alta. */
  readonly years = Array.from(
    { length: new Date().getFullYear() - FIRST_YEAR + 1 },
    (_, index) => new Date().getFullYear() - index,
  );

  private readonly month = toSignal(this.form.controls.birthMonth.valueChanges, {
    initialValue: this.form.controls.birthMonth.value,
  });
  private readonly year = toSignal(this.form.controls.birthYear.valueChanges, {
    initialValue: this.form.controls.birthYear.value,
  });

  /**
   * Los días del mes elegido, no siempre treinta y uno.
   *
   * Sin el año no se puede saber si febrero tiene veintiocho o veintinueve, así
   * que hasta que se elige se enseñan veintinueve: es preferible ofrecer un día
   * que quizá no exista a esconder uno que sí.
   */
  readonly days = computed(() => {
    const month = this.month();
    const year = this.year();
    const total = month === null ? 31 : new Date(year ?? 2000, month, 0).getDate();

    return Array.from({ length: total }, (_, index) => index + 1);
  });

  /** Los meses con el nombre que les da el idioma en uso. */
  readonly months = computed(() => {
    const formato = new Intl.DateTimeFormat(this.language.current(), { month: 'long' });

    return Array.from({ length: 12 }, (_, index) => ({
      value: index + 1,
      label: formato.format(new Date(2000, index, 1)),
    }));
  });

  async signup(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();

      return;
    }

    this.submitting.set(true);

    try {
      const { firstName, lastName, email, password, gender } = this.form.getRawValue();

      await this.auth.register({
        // El servidor no acepta nombres de más de sesenta caracteres; con dos
        // apellidos largos se llega, y cortar aquí evita un error por algo que
        // la persona no ha escrito.
        name: `${firstName} ${lastName}`.slice(0, MAX_NAME),
        firstName,
        lastName,
        email,
        password,
        lang: this.language.current(),
        birthday: this.birthday(),
        ...(gender ? { gender } : {}),
      });

      await this.feedback.toast('SIGNUP_SUCCESS', { color: 'success' });
      await this.router.navigateByUrl(environment.mainUrl);
    } catch (error) {
      await this.feedback.error(error, 'SERVER.USER_ALREADY_EXISTS');
    } finally {
      this.submitting.set(false);
    }
  }

  async signupWith(provider: SocialProvider): Promise<void> {
    this.submitting.set(true);

    try {
      await this.social.signIn(provider, this.language.current());
      await this.router.navigateByUrl(environment.mainUrl);
    } catch (error) {
      await this.feedback.error(error);
    } finally {
      this.submitting.set(false);
    }
  }

  goToPolitics(segment: string): void {
    void this.router.navigate(['/politics', segment]);
  }

  /** La fecha que se manda al servidor, en el formato que espera. */
  private birthday(): string {
    const { birthDay, birthMonth, birthYear } = this.form.getRawValue();
    const mes = String(birthMonth).padStart(2, '0');
    const dia = String(birthDay).padStart(2, '0');

    return `${birthYear}-${mes}-${dia}`;
  }
}
